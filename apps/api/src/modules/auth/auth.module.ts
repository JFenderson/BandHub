import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '@bandhub/database';
import { ApiKeyService } from './services/api-key.service';
import { JwtRotationService } from './services/jwt-rotation.service';
import { SecurityAuditService } from './services/security-audit.service';
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
import { EmailModule } from '../email/email.module';
import { RolesGuard, ApiKeyGuard } from 'src/common';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { UserAuthGuard } from '../users/guards/user-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
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
            expiresIn: '15m', // Reduced from 7d for better security
          },
        } as JwtModuleOptions;
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
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
    JwtRotationService,
    SecurityAuditService,
      JwtStrategy,
    JwtAuthGuard,
    OptionalAuthGuard, // Add this
    RolesGuard,
    ApiKeyGuard,
    UserAuthGuard,
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
    JwtRotationService,
    SecurityAuditService,
        JwtModule,
    JwtAuthGuard,
    OptionalAuthGuard, // Add this
    RolesGuard,
    ApiKeyGuard,
    UserAuthGuard,
  ],
})
export class AuthModule {}