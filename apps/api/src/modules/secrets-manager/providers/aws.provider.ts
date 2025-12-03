import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretsProvider } from '../interfaces';

/**
 * AWS Secrets Manager provider
 * Integrates with AWS Secrets Manager for secrets management
 * 
 * Required environment variables:
 * - AWS_REGION: AWS region (e.g., 'us-east-1')
 * - AWS_ACCESS_KEY_ID: AWS access key (or use IAM role)
 * - AWS_SECRET_ACCESS_KEY: AWS secret key (or use IAM role)
 * - AWS_SECRETS_PREFIX: Optional prefix for secret names
 * 
 * Note: Requires @aws-sdk/client-secrets-manager to be installed
 * 
 * @see https://docs.aws.amazon.com/secretsmanager/
 */
@Injectable()
export class AwsSecretsProvider implements SecretsProvider {
  readonly name = 'aws-secrets-manager';
  private readonly logger = new Logger(AwsSecretsProvider.name);
  private secretsClient: any = null;
  private awsSdk: any = null;
  private initialized = false;
  private readonly secretsCache: Map<string, { value: string; expiry: number }> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  async initialize(): Promise<void> {
    const region = this.configService.get<string>('AWS_REGION');
    
    if (!region) {
      this.logger.warn('AWS_REGION not configured, AWS Secrets Manager provider will not be available');
      return;
    }

    try {
      // Dynamic import to avoid requiring AWS SDK if not used
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.awsSdk = await this.loadAwsSdk();
      
      if (!this.awsSdk) {
        return;
      }

      this.secretsClient = new this.awsSdk.SecretsManagerClient({
        region,
        credentials: this.getAwsCredentials(),
      });

      this.initialized = true;
      this.logger.log('AWS Secrets Manager provider initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize AWS Secrets Manager provider:', error);
    }
  }

  private async loadAwsSdk(): Promise<any> {
    try {
      // Try to dynamically require the AWS SDK
      const sdk = require('@aws-sdk/client-secrets-manager');
      return sdk;
    } catch {
      this.logger.warn('AWS SDK not available. Install @aws-sdk/client-secrets-manager to use AWS Secrets Manager.');
      return null;
    }
  }

  private getAwsCredentials(): any {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (accessKeyId && secretAccessKey) {
      return {
        accessKeyId,
        secretAccessKey,
      };
    }

    // Return undefined to use default credential chain (IAM role, etc.)
    return undefined;
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.initialized || !this.secretsClient || !this.awsSdk) {
      return null;
    }

    // Check cache first
    const cached = this.secretsCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    const prefix = this.configService.get<string>('AWS_SECRETS_PREFIX', '');
    const secretName = prefix ? `${prefix}/${key}` : key;

    try {
      const command = new this.awsSdk.GetSecretValueCommand({ SecretId: secretName });
      const response = await this.secretsClient.send(command);

      const value = response.SecretString || null;
      
      if (value) {
        // Try to parse as JSON (AWS Secrets Manager often stores JSON objects)
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed[key]) {
            const secretValue = parsed[key];
            this.secretsCache.set(key, { value: secretValue, expiry: Date.now() + this.cacheTtlMs });
            return secretValue;
          }
        } catch {
          // Not JSON, use as-is
        }

        this.secretsCache.set(key, { value, expiry: Date.now() + this.cacheTtlMs });
      }

      return value;
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        this.logger.debug(`Secret not found: ${secretName}`);
        return null;
      }
      this.logger.error(`Error fetching secret ${secretName}:`, error.message);
      return null;
    }
  }

  async getSecrets(keys: string[]): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    
    // Fetch secrets in parallel
    await Promise.all(
      keys.map(async (key) => {
        result[key] = await this.getSecret(key);
      })
    );

    return result;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized || !this.secretsClient || !this.awsSdk) {
      return false;
    }

    try {
      const command = new this.awsSdk.ListSecretsCommand({ MaxResults: 1 });
      await this.secretsClient.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.secretsCache.clear();
    this.secretsClient = null;
    this.awsSdk = null;
    this.initialized = false;
    this.logger.log('AWS Secrets Manager provider destroyed');
  }
}
