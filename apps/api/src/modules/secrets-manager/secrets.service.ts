import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider, CachedSecret } from './interfaces';
import { EnvSecretsProvider } from './providers/env.provider';
import { DopplerSecretsProvider } from './providers/doppler.provider';
import { AwsSecretsProvider } from './providers/aws.provider';
import { VaultSecretsProvider } from './providers/vault.provider';

export type SecretsProviderType = 'env' | 'doppler' | 'aws' | 'vault';

/**
 * Unified secrets management service
 * Provides a facade over multiple secrets providers with caching and fallback support
 */
@Injectable()
export class SecretsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SecretsService.name);
  private readonly cache: Map<string, CachedSecret> = new Map();
  private readonly cacheTtl: number;
  private readonly enableCache: boolean;
  private activeProvider: SecretsProvider;
  private fallbackProvider: SecretsProvider;
  private readonly providers: Map<SecretsProviderType, SecretsProvider> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly envProvider: EnvSecretsProvider,
    private readonly dopplerProvider: DopplerSecretsProvider,
    private readonly awsProvider: AwsSecretsProvider,
    private readonly vaultProvider: VaultSecretsProvider,
  ) {
    // Default cache TTL: 5 minutes
    this.cacheTtl = this.configService.get<number>('SECRETS_CACHE_TTL', 5 * 60 * 1000);
    this.enableCache = this.configService.get<boolean>('SECRETS_CACHE_ENABLED', true);

    // Register all providers
    this.providers.set('env', envProvider);
    this.providers.set('doppler', dopplerProvider);
    this.providers.set('aws', awsProvider);
    this.providers.set('vault', vaultProvider);

    // Default to env provider as fallback
    this.fallbackProvider = envProvider;
    this.activeProvider = envProvider;
  }

  async onModuleInit(): Promise<void> {
    // Determine which provider to use based on configuration
    const providerType = this.configService.get<SecretsProviderType>('SECRETS_PROVIDER', 'env');
    
    this.logger.log(`Initializing secrets service with provider: ${providerType}`);

    // Initialize the fallback (env) provider first
    await this.envProvider.initialize?.();

    // Initialize the configured provider
    const provider = this.providers.get(providerType);
    if (provider && provider !== this.envProvider) {
      try {
        await provider.initialize?.();
        const healthy = await provider.healthCheck();
        
        if (healthy) {
          this.activeProvider = provider;
          this.logger.log(`Active secrets provider: ${provider.name}`);
        } else {
          this.logger.warn(`Provider ${providerType} health check failed, falling back to env`);
          this.activeProvider = this.fallbackProvider;
        }
      } catch (error) {
        this.logger.error(`Failed to initialize ${providerType} provider, falling back to env`, error);
        this.activeProvider = this.fallbackProvider;
      }
    }

    this.logger.log(`Secrets service initialized with provider: ${this.activeProvider.name}`);
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup all providers
    for (const provider of this.providers.values()) {
      try {
        await provider.destroy?.();
      } catch (error) {
        this.logger.warn(`Error destroying provider ${provider.name}:`, error);
      }
    }
    this.cache.clear();
  }

  /**
   * Get a secret by key
   * Returns cached value if available and not expired
   */
  async get(key: string): Promise<string | null> {
    // Check cache first
    if (this.enableCache) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    // Try active provider
    let value = await this.activeProvider.getSecret(key);

    // Fallback to env provider if not found and active isn't env
    if (value === null && this.activeProvider !== this.fallbackProvider) {
      value = await this.fallbackProvider.getSecret(key);
    }

    // Cache the result
    if (this.enableCache && value !== null) {
      this.cache.set(key, {
        value,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return value;
  }

  /**
   * Get a secret with a default value
   */
  async getOrDefault(key: string, defaultValue: string): Promise<string> {
    const value = await this.get(key);
    return value ?? defaultValue;
  }

  /**
   * Get a required secret (throws if not found)
   */
  async getRequired(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) {
      throw new Error(`Required secret not found: ${key}`);
    }
    return value;
  }

  /**
   * Get multiple secrets at once
   */
  async getMany(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};

    for (const key of keys) {
      result[key] = await this.get(key);
    }

    return result;
  }

  /**
   * Invalidate cached secret
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cached secrets
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Get the name of the active provider
   */
  getActiveProviderName(): string {
    return this.activeProvider.name;
  }

  /**
   * Health check for the secrets service
   */
  async healthCheck(): Promise<{ provider: string; healthy: boolean }> {
    const healthy = await this.activeProvider.healthCheck();
    return {
      provider: this.activeProvider.name,
      healthy,
    };
  }
}
