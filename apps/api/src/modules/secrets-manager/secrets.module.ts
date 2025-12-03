import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecretsService } from './secrets.service';
import { EnvSecretsProvider } from './providers/env.provider';
import { DopplerSecretsProvider } from './providers/doppler.provider';
import { AwsSecretsProvider } from './providers/aws.provider';
import { VaultSecretsProvider } from './providers/vault.provider';

/**
 * SecretsModule provides centralized secrets management
 * 
 * The module is global, so SecretsService can be injected anywhere without importing the module.
 * 
 * Configuration:
 * - SECRETS_PROVIDER: 'env' | 'doppler' | 'aws' | 'vault' (default: 'env')
 * - SECRETS_CACHE_TTL: Cache TTL in milliseconds (default: 300000 = 5 minutes)
 * - SECRETS_CACHE_ENABLED: Enable/disable caching (default: true)
 * 
 * Provider-specific configuration:
 * 
 * Doppler:
 * - DOPPLER_TOKEN: API token
 * - DOPPLER_PROJECT: Project name
 * - DOPPLER_CONFIG: Config/environment name
 * 
 * AWS Secrets Manager:
 * - AWS_REGION: AWS region
 * - AWS_ACCESS_KEY_ID: Access key (optional if using IAM role)
 * - AWS_SECRET_ACCESS_KEY: Secret key (optional if using IAM role)
 * - AWS_SECRETS_PREFIX: Prefix for secret names
 * 
 * HashiCorp Vault:
 * - VAULT_ADDR: Vault server address
 * - VAULT_TOKEN: Authentication token
 * - VAULT_NAMESPACE: Enterprise namespace (optional)
 * - VAULT_MOUNT_PATH: KV engine mount path (default: 'secret')
 * - VAULT_SECRET_PATH: Path within mount (optional)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SecretsService,
    EnvSecretsProvider,
    DopplerSecretsProvider,
    AwsSecretsProvider,
    VaultSecretsProvider,
  ],
  exports: [SecretsService],
})
export class SecretsModule {}
