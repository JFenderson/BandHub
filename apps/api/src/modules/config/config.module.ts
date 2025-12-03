import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigValidationService } from './config-validation.service';
import { validateEnvironment } from './env.validation';

/**
 * AppConfigModule provides configuration management with validation
 * 
 * Features:
 * - Environment variable validation at startup
 * - Type-safe configuration access
 * - Environment-specific validation rules
 * - Production security checks
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: [
        '../../.env', // Root .env for monorepo
        '.env',       // Local .env fallback
      ],
      expandVariables: true,
    }),
  ],
  providers: [ConfigValidationService],
  exports: [ConfigValidationService],
})
export class AppConfigModule {}
