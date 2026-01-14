/**
 * Integration tests for Admin Login Security Features
 * 
 * Tests the new security implementations:
 * - Account lockout after failed attempts
 * - Inactive account rejection
 * - Failed login attempt tracking
 * - Last login tracking
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@bandhub/database';
import { CacheStrategyService } from '@bandhub/cache';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService - Security Features (Integration)', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let cacheStrategy: CacheStrategyService;

  const mockUser = {
    id: 'user-test-id',
    email: 'security-test@bandhub.com',
    passwordHash: '', // Will be set in beforeEach
    name: 'Security Test User',
    role: AdminRole.ADMIN,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    sessionVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    mfaEnabled: false,
    mfaSecret: null,
    mfaEnabledAt: null,
    mfaBackupCodes: [],
    mustChangePassword: false,
    passwordChangedAt: null,
    passwordExpiresAt: null,
  };

  beforeEach(async () => {
    // Hash a test password
    mockUser.passwordHash = await bcrypt.hash('SecurePass123!', 10);

    // Create mock implementations
    const mockPrismaService = {
      adminUser: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          JWT_ACCESS_EXPIRY: '15m',
          JWT_REFRESH_EXPIRY: '7d',
        };
        return config[key] || defaultValue;
      }),
    };

    const mockCacheStrategy = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      invalidateUserCaches: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheStrategyService,
          useValue: mockCacheStrategy,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    cacheStrategy = module.get<CacheStrategyService>(CacheStrategyService);

    jest.clearAllMocks();
  });

  describe('Account Active Status Check', () => {
    it('should reject login for inactive accounts', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(
        service.login({
          email: inactiveUser.email,
          password: 'SecurePass123!',
        })
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({
          email: inactiveUser.email,
          password: 'SecurePass123!',
        })
      ).rejects.toThrow('Invalid credentials');

      // Should not update the user record
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it('should allow login for active accounts with correct password', async () => {
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({
        email: mockUser.email,
        password: 'SecurePass123!',
        ipAddress: '192.168.1.1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(mockUser.email);

      // Should update last login info
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
            lastLoginIp: '192.168.1.1',
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });
  });

  describe('Account Lockout', () => {
    it('should reject login for locked accounts', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // Locked for 15 more minutes
        failedLoginAttempts: 5,
      };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(lockedUser);

      await expect(
        service.login({
          email: lockedUser.email,
          password: 'SecurePass123!',
        })
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({
          email: lockedUser.email,
          password: 'SecurePass123!',
        })
      ).rejects.toThrow(/Account is temporarily locked/);

      // Should not update the user record when account is locked
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it('should allow login after lockout period expires', async () => {
      const expiredLockUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() - 1000), // Locked but expired
        failedLoginAttempts: 5,
      };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(expiredLockUser);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({
        email: expiredLockUser.email,
        password: 'SecurePass123!',
        ipAddress: '192.168.1.1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');

      // Should clear lockout and reset failed attempts
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });
  });

  describe('Failed Login Attempts Tracking', () => {
    it('should increment failed login attempts on wrong password', async () => {
      const userWith2Failures = { ...mockUser, failedLoginAttempts: 2 };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(userWith2Failures);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.login({
          email: userWith2Failures.email,
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow(UnauthorizedException);

      // Should increment failed attempts
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userWith2Failures.id },
          data: expect.objectContaining({
            failedLoginAttempts: 3,
          }),
        })
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Failures = { ...mockUser, failedLoginAttempts: 4 };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(userWith4Failures);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.login({
          email: userWith4Failures.email,
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow(UnauthorizedException);

      // Should set lockout
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userWith4Failures.id },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );

      // Check that lockout is approximately 15 minutes
      const updateCall = (prisma.adminUser.update as jest.Mock).mock.calls[0][0];
      const lockedUntil = updateCall.data.lockedUntil as Date;
      const lockoutDuration = lockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(14 * 60 * 1000); // At least 14 minutes
      expect(lockoutDuration).toBeLessThan(16 * 60 * 1000); // At most 16 minutes
    });

    it('should reset failed attempts on successful login', async () => {
      const userWith3Failures = { ...mockUser, failedLoginAttempts: 3 };
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(userWith3Failures);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login({
        email: userWith3Failures.email,
        password: 'SecurePass123!',
        ipAddress: '10.0.0.1',
      });

      expect(result).toHaveProperty('accessToken');

      // Should reset failed attempts
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });
  });

  describe('Last Login Tracking', () => {
    it('should update lastLoginAt and lastLoginIp on successful login', async () => {
      const beforeLogin = Date.now();
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue(mockUser);

      await service.login({
        email: mockUser.email,
        password: 'SecurePass123!',
        ipAddress: '203.0.113.45',
      });

      // Should update last login info
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            lastLoginAt: expect.any(Date),
            lastLoginIp: '203.0.113.45',
          }),
        })
      );

      // Verify timestamp is recent
      const updateCall = (prisma.adminUser.update as jest.Mock).mock.calls[0][0];
      const lastLoginAt = updateCall.data.lastLoginAt as Date;
      expect(lastLoginAt.getTime()).toBeGreaterThanOrEqual(beforeLogin);
      expect(lastLoginAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle missing IP address gracefully', async () => {
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.adminUser.update as jest.Mock).mockResolvedValue(mockUser);

      await service.login({
        email: mockUser.email,
        password: 'SecurePass123!',
        // No ipAddress provided
      });

      // Should update with null IP
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            lastLoginIp: null,
          }),
        })
      );
    });
  });

  describe('Non-existent User', () => {
    it('should not reveal if user exists', async () => {
      (prisma.adminUser.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow('Invalid credentials');

      // Should not attempt to update anything
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });
  });
});
