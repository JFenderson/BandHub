import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, Min, Max, validateSync, ValidatorOptions } from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';

/**
 * Environment types for the application
 */
export enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Test = 'test',
}

/**
 * Environment variable validation schema
 * Uses class-validator decorators for validation
 */
export class EnvironmentVariables {
  // ============ Core Configuration ============
  
  @IsEnum(Environment)
  @Transform(({ value }) => value?.toLowerCase())
  NODE_ENV: Environment = Environment.Development;

  // ============ Database Configuration ============
  
  @IsString()
  DATABASE_URL: string;

  // ============ Redis Configuration ============
  
  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // ============ API Configuration ============
  
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  @Max(65535)
  API_PORT: number = 3001;

  @IsString()
  @IsOptional()
  API_URL: string = 'http://localhost:3001';

  // ============ Authentication ============
  
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRY: string = '7d';

  // Support for JWT key rotation
  @IsString()
  @IsOptional()
  JWT_PREVIOUS_SECRET?: string; // For key rotation

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  JWT_ROTATION_INTERVAL_DAYS: number = 30; // Days between rotations

  // ============ YouTube API ============
  
  @IsString()
  @IsOptional()
  YOUTUBE_API_KEY?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  YOUTUBE_QUOTA_LIMIT: number = 10000;

  // ============ Worker Configuration ============
  
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @Min(1)
  WORKER_CONCURRENCY: number = 3;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  MAX_YOUTUBE_CALLS_PER_MINUTE: number = 60;

  // ============ Secrets Management ============
  
  @IsString()
  @IsOptional()
  SECRETS_PROVIDER: 'env' | 'doppler' | 'aws' | 'vault' = 'env';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  SECRETS_CACHE_TTL: number = 300000; // 5 minutes

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  SECRETS_CACHE_ENABLED: boolean = true;

  // Doppler
  @IsString()
  @IsOptional()
  DOPPLER_TOKEN?: string;

  @IsString()
  @IsOptional()
  DOPPLER_PROJECT?: string;

  @IsString()
  @IsOptional()
  DOPPLER_CONFIG?: string;

  // AWS
  @IsString()
  @IsOptional()
  AWS_REGION?: string;

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  AWS_SECRETS_PREFIX?: string;

  // Vault
  @IsString()
  @IsOptional()
  VAULT_ADDR?: string;

  @IsString()
  @IsOptional()
  VAULT_TOKEN?: string;

  @IsString()
  @IsOptional()
  VAULT_NAMESPACE?: string;

  @IsString()
  @IsOptional()
  VAULT_MOUNT_PATH: string = 'secret';

  @IsString()
  @IsOptional()
  VAULT_SECRET_PATH?: string;

  // ============ Security Configuration ============
  
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  DEBUG: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  SECURE_COOKIES: boolean = true;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  // ============ Logging ============
  
  @IsString()
  @IsOptional()
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' = 'info';

  @IsString()
  @IsOptional()
  LOG_FORMAT: 'pretty' | 'json' = 'json';
}

/**
 * Validate environment variables at startup
 * @param config Environment variables object
 * @returns Validated configuration object
 * @throws Error with validation details if validation fails
 */
export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatorOptions: ValidatorOptions = {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  };

  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, validatorOptions);

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = error.constraints
        ? Object.values(error.constraints).join(', ')
        : 'Unknown validation error';
      return `  - ${error.property}: ${constraints}`;
    });

    throw new Error(
      `Environment validation failed:\n${errorMessages.join('\n')}\n\n` +
      `Please check your .env file or environment variables.`
    );
  }

  return validatedConfig;
}

/**
 * Get list of required environment variables based on environment
 */
export function getRequiredVariables(env: Environment): string[] {
  const common = ['DATABASE_URL', 'JWT_SECRET'];

  const envSpecific: Record<Environment, string[]> = {
    [Environment.Development]: [],
    [Environment.Staging]: [],
    [Environment.Production]: [
      'REDIS_PASSWORD',
    ],
    [Environment.Test]: [],
  };

  return [...common, ...(envSpecific[env] || [])];
}
