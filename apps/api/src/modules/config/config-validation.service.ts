import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, getRequiredVariables } from './env.validation';

/**
 * Service for validating configuration at runtime
 * Provides additional validation beyond schema validation
 */
@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Validating configuration...');

    const env = this.configService.get<Environment>('NODE_ENV', Environment.Development);
    
    // Check required variables for the current environment
    this.validateRequiredVariables(env);
    
    // Perform security-related validations
    this.validateSecurityConfig(env);

    // Check for potentially unsafe configurations in production
    if (env === Environment.Production) {
      this.validateProductionConfig();
    }

    this.logger.log('Configuration validation completed successfully');
  }

  /**
   * Validate that all required variables are present
   */
  private validateRequiredVariables(env: Environment): void {
    const required = getRequiredVariables(env);
    const missing: string[] = [];

    for (const varName of required) {
      const value = this.configService.get(varName);
      if (value === undefined || value === null || value === '') {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      const message = `Missing required environment variables for ${env}:\n  - ${missing.join('\n  - ')}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  /**
   * Validate security-related configuration
   */
  private validateSecurityConfig(env: Environment): void {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    // Check JWT secret strength
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        const message = 'JWT_SECRET must be at least 32 characters long for security';
        if (env === Environment.Production) {
          throw new Error(message);
        }
        this.logger.warn(message);
      }

      // Check for common weak secrets
      const weakSecrets = ['secret', 'password', 'jwt_secret', 'change_me', 'development'];
      if (weakSecrets.some(weak => jwtSecret.toLowerCase().includes(weak))) {
        const message = 'JWT_SECRET appears to be a weak/default value';
        if (env === Environment.Production) {
          throw new Error(message);
        }
        this.logger.warn(message);
      }
    }
  }

  /**
   * Additional validations for production environment
   */
  private validateProductionConfig(): void {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Ensure secure cookies are enabled
    const secureCookies = this.configService.get<boolean>('SECURE_COOKIES');
    if (!secureCookies) {
      errors.push('SECURE_COOKIES must be true in production');
    }

    // Ensure debug mode is disabled
    const debug = this.configService.get<boolean>('DEBUG');
    if (debug) {
      errors.push('DEBUG must be false in production');
    }

    // Check that we're not using localhost URLs
    const apiUrl = this.configService.get<string>('API_URL', '');
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      warnings.push('API_URL contains localhost - ensure this is intentional for production');
    }

    // Ensure Redis password is set if Redis is configured
    const redisHost = this.configService.get<string>('REDIS_HOST');
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    if (redisHost && redisHost !== 'localhost' && !redisPassword) {
      warnings.push('REDIS_PASSWORD should be set when using a remote Redis server');
    }

    // Log warnings
    for (const warning of warnings) {
      this.logger.warn(`[PRODUCTION CONFIG] ${warning}`);
    }

    // Throw on errors
    if (errors.length > 0) {
      throw new Error(
        `Production configuration errors:\n  - ${errors.join('\n  - ')}`
      );
    }
  }

  /**
   * Get a typed configuration value
   */
  get<T>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }

  /**
   * Get a required configuration value (throws if not found)
   */
  getRequired<T>(key: string): T {
    const value = this.configService.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Required configuration missing: ${key}`);
    }
    return value;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.configService.get<Environment>('NODE_ENV') === Environment.Production;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.configService.get<Environment>('NODE_ENV') === Environment.Development;
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.configService.get<Environment>('NODE_ENV', Environment.Development);
  }
}
