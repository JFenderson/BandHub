import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { DatabaseModule } from '../../database/database.module';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeysController } from './controllers/api-keys.controller';
import { SessionService } from './services/session.service';
import { MfaService } from './services/mfa.service';
import { SecurityService } from './services/security.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { MagicLinkService } from './services/magic-link.service';
import { OAuthService } from './services/oauth.service';
import { DeviceFingerprintService } from './services/device-fingerprint.service';
import { SessionController } from './controllers/session.controller';
import { MfaController } from './controllers/mfa.controller';
import { PasswordController } from './controllers/password.controller';
import { MagicLinkController } from './controllers/magic-link.controller';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return{
        secret,
        signOptions: {
          expiresIn: '15m', // Reduced from 7d for better security
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
  controllers: [
    AuthController,
    ApiKeysController,
    SessionController,
    MfaController,
    PasswordController,
    MagicLinkController,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyService,
    SessionService,
    MfaService,
    SecurityService,
    PasswordPolicyService,
    MagicLinkService,
    OAuthService,
    DeviceFingerprintService,
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule,
    ApiKeyService,
    SessionService,
    MfaService,
    SecurityService,
    PasswordPolicyService,
    MagicLinkService,
    OAuthService,
    DeviceFingerprintService,
  ],
})
export class AuthModule {}