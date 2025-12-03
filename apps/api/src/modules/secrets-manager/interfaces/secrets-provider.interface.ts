/**
 * Interface for secrets management providers
 * Allows for multiple implementations (Doppler, AWS Secrets Manager, HashiCorp Vault, etc.)
 */
export interface SecretsProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Get a secret by key
   * @param key The secret key
   * @returns The secret value or null if not found
   */
  getSecret(key: string): Promise<string | null>;

  /**
   * Get multiple secrets at once
   * @param keys Array of secret keys
   * @returns Object mapping keys to their values
   */
  getSecrets(keys: string[]): Promise<Record<string, string | null>>;

  /**
   * Check if the provider is healthy/connected
   */
  healthCheck(): Promise<boolean>;

  /**
   * Initialize the provider (called once at startup)
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup/disconnect the provider
   */
  destroy?(): Promise<void>;
}

/**
 * Configuration options for secrets providers
 */
export interface SecretsProviderConfig {
  /**
   * Cache TTL in milliseconds (default: 5 minutes)
   */
  cacheTtl?: number;

  /**
   * Whether to enable caching (default: true)
   */
  enableCache?: boolean;

  /**
   * Provider-specific configuration
   */
  providerConfig?: Record<string, any>;
}

/**
 * Cached secret entry
 */
export interface CachedSecret {
  value: string | null;
  expiresAt: number;
}
