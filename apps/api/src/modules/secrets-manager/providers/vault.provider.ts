import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from '../interfaces';

/**
 * HashiCorp Vault secrets provider
 * Integrates with HashiCorp Vault for secrets management
 * 
 * Required environment variables:
 * - VAULT_ADDR: Vault server address (e.g., 'https://vault.example.com')
 * - VAULT_TOKEN: Vault authentication token
 * - VAULT_NAMESPACE: (Optional) Vault Enterprise namespace
 * - VAULT_MOUNT_PATH: (Optional) KV secrets engine mount path (default: 'secret')
 * - VAULT_SECRET_PATH: (Optional) Path to secrets within the mount
 * 
 * @see https://www.vaultproject.io/docs
 */
@Injectable()
export class VaultSecretsProvider implements SecretsProvider {
  readonly name = 'hashicorp-vault';
  private readonly logger = new Logger(VaultSecretsProvider.name);
  private initialized = false;
  private vaultAddr: string = '';
  private vaultToken: string = '';
  private namespace: string | undefined;
  private mountPath: string = 'secret';
  private secretPath: string = '';
  private readonly secretsCache: Map<string, { value: string; expiry: number }> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  async initialize(): Promise<void> {
    this.vaultAddr = this.configService.get<string>('VAULT_ADDR', '');
    this.vaultToken = this.configService.get<string>('VAULT_TOKEN', '');
    this.namespace = this.configService.get<string>('VAULT_NAMESPACE');
    this.mountPath = this.configService.get<string>('VAULT_MOUNT_PATH', 'secret');
    this.secretPath = this.configService.get<string>('VAULT_SECRET_PATH', '');

    if (!this.vaultAddr || !this.vaultToken) {
      this.logger.warn('VAULT_ADDR or VAULT_TOKEN not configured, Vault provider will not be available');
      return;
    }

    try {
      // Test connection
      const healthy = await this.healthCheck();
      if (healthy) {
        this.initialized = true;
        this.logger.log('HashiCorp Vault provider initialized');
      } else {
        this.logger.warn('Vault health check failed during initialization');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Vault provider', error);
    }
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Vault-Token': this.vaultToken,
      'Content-Type': 'application/json',
    };

    if (this.namespace) {
      headers['X-Vault-Namespace'] = this.namespace;
    }

    return headers;
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.initialized) {
      return null;
    }

    // Check cache first
    const cached = this.secretsCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      // Build the path - for KV v2, we need to insert 'data' after mount path
      const path = this.secretPath
        ? `${this.mountPath}/data/${this.secretPath}/${key}`
        : `${this.mountPath}/data/${key}`;

      const url = `${this.vaultAddr}/v1/${path}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.debug(`Secret not found in Vault: ${key}`);
          return null;
        }
        throw new Error(`Vault API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // KV v2 returns secrets under data.data
      const secrets = data?.data?.data;
      if (!secrets) {
        return null;
      }

      // Try to get the value by key name first, then 'value' key, then first value as fallback
      let value: string | undefined;
      let fallbackStrategy: string | undefined;
      
      if (secrets[key] && typeof secrets[key] === 'string') {
        value = secrets[key];
        fallbackStrategy = 'exact-key-match';
      } else if (secrets.value && typeof secrets.value === 'string') {
        value = secrets.value;
        fallbackStrategy = 'value-key';
      } else {
        const firstValue = Object.values(secrets)[0];
        if (typeof firstValue === 'string') {
          value = firstValue;
          fallbackStrategy = 'first-value';
          this.logger.debug(`Using first value fallback for secret ${key} (actual key: ${Object.keys(secrets)[0]})`);
        }
      }
      
      if (value) {
        this.secretsCache.set(key, { value, expiry: Date.now() + this.cacheTtlMs });
        return value;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error fetching secret ${key} from Vault:`, error);
      return null;
    }
  }

  async getSecrets(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        result[key] = await this.getSecret(key);
      })
    );

    return result;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.vaultAddr || !this.vaultToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.vaultAddr}/v1/sys/health`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });

      // Vault returns different status codes for different states
      // 200 = initialized, unsealed, active
      // 429 = standby
      // 472 = performance standby
      // 501 = not initialized
      // 503 = sealed
      return response.status === 200 || response.status === 429 || response.status === 472;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.secretsCache.clear();
    this.initialized = false;
    this.vaultToken = '';
    this.logger.log('HashiCorp Vault provider destroyed');
  }
}
