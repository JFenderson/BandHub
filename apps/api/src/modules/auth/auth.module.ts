import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../../database/database.module';
import { ApiKeyService } from './services/api-key.service';
import { JwtRotationService } from './services/jwt-rotation.service';
import { SecurityAuditService } from './services/security-audit.service';
import { ApiKeysController } from './controllers/api-keys.controller';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '7d', // Use literal value instead of config for type compatibility
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute (general)
      },
    ]),
  ],
  controllers: [AuthController, ApiKeysController],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyService,
    JwtRotationService,
    SecurityAuditService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule,
    ApiKeyService,
    JwtRotationService,
    SecurityAuditService,
  ],
})
export class AuthModule {}