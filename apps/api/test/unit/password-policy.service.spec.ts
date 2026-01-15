import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasswordPolicyService } from '../../src/modules/auth/services/password-policy.service';
import { PrismaService } from '@bandhub/database';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPolicy = {
    id: 'policy-1',
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    expirationDays: 90,
    historyCount: 5,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 15,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      passwordPolicy: {
        findFirst: jest.fn().mockResolvedValue(mockPolicy),
        create: jest.fn().mockResolvedValue(mockPolicy),
        update: jest.fn().mockResolvedValue(mockPolicy),
      },
      adminUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      passwordHistory: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordPolicyService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PasswordPolicyService>(PasswordPolicyService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getActivePolicy', () => {
    it('should return active password policy', async () => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);

      const result = await service.getActivePolicy();

      expect(result).toEqual({
        minLength: mockPolicy.minLength,
        maxLength: mockPolicy.maxLength,
        requireUppercase: mockPolicy.requireUppercase,
        requireLowercase: mockPolicy.requireLowercase,
        requireNumbers: mockPolicy.requireNumbers,
        requireSymbols: mockPolicy.requireSymbols,
        expirationDays: mockPolicy.expirationDays,
        historyCount: mockPolicy.historyCount,
        maxFailedAttempts: mockPolicy.maxFailedAttempts,
        lockoutDurationMinutes: mockPolicy.lockoutDurationMinutes,
      });
      expect(prisma.passwordPolicy.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('should use cached policy within TTL', async () => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);

      // First call
      await service.getActivePolicy();
      // Second call within cache TTL
      await service.getActivePolicy();

      // Should only call database once
      expect(prisma.passwordPolicy.findFirst).toHaveBeenCalledTimes(1);
    });

    it('should return default policy if none exists', async () => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(null);

      const result = await service.getActivePolicy();

      expect(result).toEqual({
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        expirationDays: 90,
        historyCount: 5,
        maxFailedAttempts: 5,
        lockoutDurationMinutes: 15,
      });
    });
  });

  describe('validatePassword', () => {
    beforeEach(() => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);
    });

    it('should validate a strong password', async () => {
      const result = await service.validatePassword('StrongP@ss123');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than minLength', async () => {
      const result = await service.validatePassword('Short1!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password longer than maxLength', async () => {
      const longPassword = 'A'.repeat(129) + 'a1!';
      const result = await service.validatePassword(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at most 128 characters long');
    });

    it('should reject password without uppercase letter', async () => {
      const result = await service.validatePassword('weakpass123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', async () => {
      const result = await service.validatePassword('WEAKPASS123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', async () => {
      const result = await service.validatePassword('WeakPass!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without symbol', async () => {
      const result = await service.validatePassword('WeakPass123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one symbol');
    });

    it('should return multiple errors for weak password', async () => {
      const result = await service.validatePassword('weak');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('checkPasswordHistory', () => {
    const userId = 'user-123';
    const newPassword = 'NewP@ssw0rd123';

    beforeEach(() => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);
    });

    it('should allow password not in history', async () => {
      const oldHashes = [
        { passwordHash: 'hash1', createdAt: new Date() },
        { passwordHash: 'hash2', createdAt: new Date() },
      ];
      prisma.passwordHistory.findMany.mockResolvedValue(oldHashes);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.checkPasswordHistory(userId, newPassword)
      ).resolves.not.toThrow();

      expect(prisma.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: mockPolicy.historyCount,
      });
    });

    it('should reject password in history', async () => {
      const oldHashes = [
        { passwordHash: 'hash1', createdAt: new Date() },
        { passwordHash: 'hash2', createdAt: new Date() },
      ];
      prisma.passwordHistory.findMany.mockResolvedValue(oldHashes);
      mockedBcrypt.compare
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(true as never);

      await expect(
        service.checkPasswordHistory(userId, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip history check if historyCount is 0', async () => {
      prisma.passwordPolicy.findFirst.mockResolvedValue({
        ...mockPolicy,
        historyCount: 0,
      });

      await expect(
        service.checkPasswordHistory(userId, newPassword)
      ).resolves.not.toThrow();

      expect(prisma.passwordHistory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const password = 'TestP@ss123';
      const hashedPassword = 'hashed_password';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('addToPasswordHistory', () => {
    const userId = 'user-123';
    const passwordHash = 'hash123';

    beforeEach(() => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);
    });

    it('should add password to history', async () => {
      prisma.passwordHistory.create.mockResolvedValue({
        id: 'history-1',
        userId,
        passwordHash,
        createdAt: new Date(),
      });

      await service.addToPasswordHistory(userId, passwordHash);

      expect(prisma.passwordHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          passwordHash,
        },
      });
    });

    it('should cleanup old history entries', async () => {
      const oldHistories = Array.from({ length: 6 }, (_, i) => ({
        id: `history-${i}`,
        userId,
        passwordHash: `hash-${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }));

      prisma.passwordHistory.findMany.mockResolvedValue(oldHistories);
      prisma.passwordHistory.create.mockResolvedValue({
        id: 'history-new',
        userId,
        passwordHash,
        createdAt: new Date(),
      });
      prisma.passwordHistory.deleteMany.mockResolvedValue({ count: 1 });

      await service.addToPasswordHistory(userId, passwordHash);

      expect(prisma.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [oldHistories[5].id] },
        },
      });
    });
  });

  describe('isPasswordExpired', () => {
    const userId = 'user-123';

    beforeEach(() => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);
    });

    it('should return true if password is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 100); // 100 days ago

      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        passwordChangedAt: expiredDate,
      } as any);

      const result = await service.isPasswordExpired(userId);

      expect(result).toBe(true);
    });

    it('should return false if password is not expired', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30 days ago

      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        passwordChangedAt: recentDate,
      } as any);

      const result = await service.isPasswordExpired(userId);

      expect(result).toBe(false);
    });

    it('should return false if passwordChangedAt is null', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        passwordChangedAt: null,
      } as any);

      const result = await service.isPasswordExpired(userId);

      expect(result).toBe(false);
    });

    it('should return false if expirationDays is 0 (no expiration)', async () => {
      prisma.passwordPolicy.findFirst.mockResolvedValue({
        ...mockPolicy,
        expirationDays: 0,
      });

      const result = await service.isPasswordExpired(userId);

      expect(result).toBe(false);
      expect(prisma.adminUser.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('recordFailedAttempt', () => {
    const userId = 'user-123';

    beforeEach(() => {
      prisma.passwordPolicy.findFirst.mockResolvedValue(mockPolicy);
    });

    it('should increment failed attempts', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        failedLoginAttempts: 2,
        lockedUntil: null,
      } as any);

      prisma.adminUser.update.mockResolvedValue({
        id: userId,
        failedLoginAttempts: 3,
      } as any);

      await service.recordFailedAttempt(userId);

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 3,
          lastFailedLoginAt: expect.any(Date),
        },
      });
    });

    it('should lock account after max failed attempts', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        failedLoginAttempts: 4,
        lockedUntil: null,
      } as any);

      await service.recordFailedAttempt(userId);

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 5,
          lastFailedLoginAt: expect.any(Date),
          lockedUntil: expect.any(Date),
        },
      });
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts and unlock account', async () => {
      const userId = 'user-123';

      await service.resetFailedAttempts(userId);

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        },
      });
    });
  });

  describe('isAccountLocked', () => {
    const userId = 'user-123';

    it('should return true if account is locked', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);

      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: futureDate,
      } as any);

      const result = await service.isAccountLocked(userId);

      expect(result).toBe(true);
    });

    it('should return false if lockout has expired', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);

      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: pastDate,
      } as any);

      const result = await service.isAccountLocked(userId);

      expect(result).toBe(false);
    });

    it('should return false if lockedUntil is null', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: null,
      } as any);

      const result = await service.isAccountLocked(userId);

      expect(result).toBe(false);
    });

    it('should auto-unlock if lockout period has expired', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);

      prisma.adminUser.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: pastDate,
      } as any);

      await service.isAccountLocked(userId);

      expect(prisma.adminUser.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      });
    });
  });
});
