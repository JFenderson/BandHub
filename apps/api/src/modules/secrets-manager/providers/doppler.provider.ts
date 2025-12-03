import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from '../interfaces';

/**
 * Doppler secrets provider
 * Integrates with Doppler's secrets management service
 * 
 * Required environment variables:
 * - DOPPLER_TOKEN: API token for Doppler
 * - DOPPLER_PROJECT: Project name (optional, uses default if not set)
 * - DOPPLER_CONFIG: Config/environment name (optional)
 * 
 * @see https://docs.doppler.com/docs/api
 */
@Injectable()
export class DopplerSecretsProvider implements SecretsProvider {
  readonly name = 'doppler';
  private readonly logger = new Logger(DopplerSecretsProvider.name);
  private secrets: Map<string, string> = new Map();
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async initialize(): Promise<void> {
    const token = this.configService.get<string>('DOPPLER_TOKEN');
    
    if (!token) {
      this.logger.warn('DOPPLER_TOKEN not configured, provider will not fetch secrets');
      return;
    }

    try {
      await this.fetchSecrets(token);
      this.initialized = true;
      this.logger.log('Doppler secrets provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Doppler provider', error);
      throw error;
    }
  }

  private async fetchSecrets(token: string): Promise<void> {
    const project = this.configService.get<string>('DOPPLER_PROJECT');
    const config = this.configService.get<string>('DOPPLER_CONFIG');

    // Build the API URL
    let apiUrl = 'https://api.doppler.com/v3/configs/config/secrets/download';
    const params = new URLSearchParams({ format: 'json' });
    
    if (project) params.append('project', project);
    if (config) params.append('config', config);

    try {
      const response = await fetch(`${apiUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Doppler API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store all secrets in memory
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          this.secrets.set(key, value);
        }
      }

      this.logger.log(`Loaded ${this.secrets.size} secrets from Doppler`);
    } catch (error) {
      this.logger.error('Failed to fetch secrets from Doppler', error);
      throw error;
    }
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.initialized) {
      return null;
    }
    return this.secrets.get(key) ?? null;
  }

  async getSecrets(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = await this.getSecret(key);
    }
    return result;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    const token = this.configService.get<string>('DOPPLER_TOKEN');
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://api.doppler.com/v3/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.secrets.clear();
    this.initialized = false;
    this.logger.log('Doppler secrets provider destroyed');
  }
}
