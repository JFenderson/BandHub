import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from '../interfaces';

/**
 * Environment variables-based secrets provider
 * Used as a fallback for local development or when no external secrets manager is configured
 */
@Injectable()
export class EnvSecretsProvider implements SecretsProvider {
  readonly name = 'env';
  private readonly logger = new Logger(EnvSecretsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async getSecret(key: string): Promise<string | null> {
    const value = this.configService.get<string>(key);
    return value ?? null;
  }

  async getSecrets(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = await this.getSecret(key);
    }
    return result;
  }

  async healthCheck(): Promise<boolean> {
    // Env provider is always healthy
    return true;
  }

  async initialize(): Promise<void> {
    this.logger.log('Environment secrets provider initialized');
  }
}
