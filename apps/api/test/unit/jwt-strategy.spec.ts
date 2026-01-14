import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from '../../src/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '@bandhub/database';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'ADMIN',
    isActive: true,
    sessionVersion: 1,
  };

  beforeEach(async () => {
    const mockPrisma = {
      adminUser: {
        findUnique: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') {
          return 'test-secret-key-for-testing';
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with JWT_SECRET from config', () => {
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(strategy).toBeDefined();
    });

    it('should throw error if JWT_SECRET is not set', () => {
      const mockConfigService = {
        get: jest.fn().mockReturnValue(null),
      };

      expect(() => {
        new JwtStrategy(mockConfigService as any, prisma as any);
      }).toThrow('JWT_SECRET environment variable is required');
    });
  });

  describe('validate', () => {
    const validPayload: JwtPayload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: 'ADMIN',
      sessionVersion: 1,
    };

    it('should validate and return user for valid token payload', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser as any);

      const result = await strategy.validate(validPayload);

      expect(result).toEqual({
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
      });

      expect(prisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { id: validPayload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          sessionVersion: true,
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid or inactive user')
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid or inactive user')
      );
    });

    it('should validate session version when provided', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser as any);

      const result = await strategy.validate({
        ...validPayload,
        sessionVersion: 1,
      });

      expect(result).toBeDefined();
      expect(result.sub).toBe(mockUser.id);
    });

    it('should throw UnauthorizedException if session version mismatch', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        sessionVersion: 2,
      } as any);

      await expect(
        strategy.validate({
          ...validPayload,
          sessionVersion: 1,
        })
      ).rejects.toThrow(new UnauthorizedException('Session invalidated'));
    });

    it('should work without session version in payload', async () => {
      const payloadWithoutVersion: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      prisma.adminUser.findUnique.mockResolvedValue(mockUser as any);

      const result = await strategy.validate(payloadWithoutVersion);

      expect(result).toBeDefined();
      expect(result.sub).toBe(mockUser.id);
    });

    it('should handle null sessionVersion in database', async () => {
      const userWithNullVersion = {
        ...mockUser,
        sessionVersion: null,
      };

      prisma.adminUser.findUnique.mockResolvedValue(userWithNullVersion as any);

      const result = await strategy.validate({
        ...validPayload,
        sessionVersion: 0,
      });

      expect(result).toBeDefined();
    });

    it('should validate different user roles', async () => {
      const roles = ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'];

      for (const role of roles) {
        const userWithRole = { ...mockUser, role };
        prisma.adminUser.findUnique.mockResolvedValue(userWithRole as any);

        const result = await strategy.validate({
          ...validPayload,
          role,
        });

        expect(result.role).toBe(role);
      }
    });

    it('should handle database errors gracefully', async () => {
      prisma.adminUser.findUnique.mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(strategy.validate(validPayload)).rejects.toThrow(
        'Database connection error'
      );
    });

    it('should validate email format in payload', async () => {
      const payloadWithEmail = {
        ...validPayload,
        email: 'admin@bandhub.com',
      };

      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'admin@bandhub.com',
      } as any);

      const result = await strategy.validate(payloadWithEmail);

      expect(result.email).toBe('admin@bandhub.com');
    });

    it('should return minimal user info for security', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        password: 'hashed_password',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await strategy.validate(validPayload);

      // Should not include sensitive fields
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('sessionVersion');
      expect(result).not.toHaveProperty('isActive');

      // Should only include necessary fields
      expect(Object.keys(result)).toEqual(['sub', 'email', 'name', 'role']);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in email', async () => {
      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test+special@example.com',
        role: 'ADMIN',
      };

      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'test+special@example.com',
      } as any);

      const result = await strategy.validate(payload);

      expect(result.email).toBe('test+special@example.com');
    });

    it('should handle very long user IDs', async () => {
      const longId = 'user-' + 'a'.repeat(100);
      const payload: JwtPayload = {
        sub: longId,
        email: 'test@example.com',
        role: 'ADMIN',
      };

      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        id: longId,
      } as any);

      const result = await strategy.validate(payload);

      expect(result.sub).toBe(longId);
    });

    it('should handle concurrent validation requests', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser as any);

      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
      };

      // Simulate concurrent validations
      const validations = Array(10)
        .fill(null)
        .map(() => strategy.validate(payload));

      const results = await Promise.all(validations);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result.sub).toBe(mockUser.id);
      });
    });
  });

  describe('security tests', () => {
    it('should not validate token with tampered user ID', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      const tamperedPayload: JwtPayload = {
        sub: 'tampered-user-id',
        email: 'hacker@example.com',
        role: 'SUPER_ADMIN',
      };

      await expect(strategy.validate(tamperedPayload)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should not allow privilege escalation via role in payload', async () => {
      const regularUser = {
        ...mockUser,
        role: 'MODERATOR',
      };

      prisma.adminUser.findUnique.mockResolvedValue(regularUser as any);

      const payloadWithAdminRole: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'SUPER_ADMIN', // Attempting to escalate
      };

      const result = await strategy.validate(payloadWithAdminRole);

      // Should use role from database, not payload
      expect(result.role).toBe('MODERATOR');
    });

    it('should invalidate all tokens after session version bump', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        ...mockUser,
        sessionVersion: 5, // User changed password
      } as any);

      const oldTokenPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'ADMIN',
        sessionVersion: 4, // Old session version
      };

      await expect(strategy.validate(oldTokenPayload)).rejects.toThrow(
        new UnauthorizedException('Session invalidated')
      );
    });
  });
});
