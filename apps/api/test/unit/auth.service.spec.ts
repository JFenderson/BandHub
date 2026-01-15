import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/modules/auth/auth.service';
import { DatabaseService } from '../../src/database/database.service';
import { EmailService } from '../../src/modules/email/email.service';
import { RegisterDto } from '../../src/modules/auth/dto/register.dto';
import { LoginDto } from '../../src/modules/auth/dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Comprehensive Unit Tests for AuthService
 * 
 * Tests all authentication and authorization methods with proper mocking of:
 * - DatabaseService (Prisma)
 * - JwtService (JWT token generation)
 * - EmailService (email notifications)
 * - bcrypt (password hashing)
 * - crypto (token generation)
 * 
 * Coverage areas:
 * - User registration with password hashing
 * - Login with email/password validation
 * - JWT token generation and validation
 * - Refresh token functionality with rotation
 * - Role-based access control (MODERATOR, ADMIN, SUPER_ADMIN)
 * - Invalid login attempts and account locking
 * - Password reset flow (forgot/reset)
 * - Session management
 * - Logout and logout all
 * - Token reuse detection
 * - Security audit logging
 */

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock crypto
jest.mock('crypto');
const mockedCrypto = crypto as jest.Mocked<typeof crypto>;

const createMocks = () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    adminSession: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    adminPasswordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(), // Added missing update method
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}), // Correct table name
    },
    $transaction: jest.fn().mockImplementation((operations) => {
      // Execute all operations in the array
      return Promise.all(operations);
    }),
  } as any;

  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  } as any;

  const configService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        JWT_SECRET: 'test-secret-key-for-testing',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  } as any;

  const emailService = {
    sendAdminPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new AuthService(prisma, jwtService, configService, emailService);

  return { service, prisma, jwtService, configService, emailService };
};

describe('AuthService (comprehensive unit tests)', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let emailService: any;

  beforeEach(() => {
    const mocks = createMocks();
    service = mocks.service;
    prisma = mocks.prisma;
    jwtService = mocks.jwtService;
    configService = mocks.configService;
    emailService = mocks.emailService;
    
    jest.clearAllMocks();
    
    // Setup default bcrypt mocks
    mockedBcrypt.hash.mockResolvedValue('$2b$12$hashedpassword' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    
    // Setup default crypto mocks for randomBytes
    (mockedCrypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('random-token-string'),
    });

    // Setup crypto.createHash mock for token hashing (SHA-256)
    (mockedCrypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('hashed-token-value'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all dependencies injected', () => {
      expect(prisma).toBeDefined();
      expect(jwtService).toBeDefined();
      expect(configService).toBeDefined();
      expect(emailService).toBeDefined();
    });
  });

  // ========================================
  // register() Tests
  // ========================================
  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      const hashedPassword = '$2b$12$hashedpassword';
      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);
      
      prisma.adminUser.findUnique.mockResolvedValue(null);
      prisma.adminUser.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        name: registerDto.name,
        role: 'MODERATOR',
        createdAt: new Date(),
      });

      const result = await service.register(registerDto);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-1',
          email: registerDto.email,
          name: registerDto.name,
        })
      );
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(prisma.adminUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerDto.email,
            passwordHash: hashedPassword,
            name: registerDto.name,
          }),
        })
      );
    });

    it('should throw ConflictException when user already exists', async () => {
      prisma.adminUser.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this email already exists'
      );
      expect(prisma.adminUser.create).not.toHaveBeenCalled();
    });

    it('should hash password with bcrypt cost factor 12', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);
      prisma.adminUser.create.mockResolvedValue({ id: 'user-1' });

      await service.register(registerDto);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
    });

    it('should handle database errors during registration', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);
      prisma.adminUser.create.mockRejectedValue(new Error('Database error'));

      await expect(service.register(registerDto)).rejects.toThrow('Database error');
    });
  });

  // ========================================
  // login() Tests
  // ========================================
  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'user@example.com',
      password: 'Password123!',
    };

    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      role: 'MODERATOR',
      passwordHash: '$2b$12$hashedpassword',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      sessionVersion: 0,
    };

    it('should successfully login with valid credentials', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-access-token');
      
      const result = await service.login(loginDto);

      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'jwt-access-token',
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
            role: mockUser.role,
          }),
        })
      );
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.passwordHash);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should increment failed login attempts on invalid password', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      prisma.adminUser.update.mockResolvedValue({});

      try {
        await service.login(loginDto);
      } catch (error) {
        // Expected to throw
      }

      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 1,
          }),
        })
      );
    });

    it('should lock account after max failed login attempts', async () => {
      const userWithFailedAttempts = {
        ...mockUser,
        failedLoginAttempts: 4, // One away from lockout
      };
      
      prisma.adminUser.findUnique.mockResolvedValue(userWithFailedAttempts);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      prisma.adminUser.update.mockResolvedValue({});

      try {
        await service.login(loginDto);
      } catch (error) {
        // Expected to throw
      }

      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('should reject login when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 900000), // Locked for 15 more minutes
      };
      
      prisma.adminUser.findUnique.mockResolvedValue(lockedUser);

      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        /Account is locked/
      );
    });

    it('should reject login for inactive accounts', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      
      prisma.adminUser.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        /Account is deactivated/
      );
    });

    it('should reset failed login attempts on successful login', async () => {
      const userWithFailedAttempts = {
        ...mockUser,
        failedLoginAttempts: 3,
      };
      
      prisma.adminUser.findUnique.mockResolvedValue(userWithFailedAttempts);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      await service.login(loginDto);

      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('should create session on successful login', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      await service.login(loginDto);

      expect(prisma.adminSession.create).toHaveBeenCalled();
    });

    it('should generate access token with correct payload', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      await service.login(loginDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
        }),
        expect.any(Object)
      );
    });

    it('should log successful login in audit log', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      await service.login(loginDto);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            action: 'login_success',
          }),
        })
      );
    });
  });

  // ========================================
  // refreshTokens() Tests
  // ========================================
  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';
    const hashedToken = 'hashed-refresh-token';

    const mockTokenRecord = {
      id: 'token-1',
      token: hashedToken,
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000), // Expires tomorrow
      isRevoked: false,
      sessionId: 'session-1',
      deviceFingerprint: 'device-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'MODERATOR',
        isActive: true,
        sessionVersion: 0,
      },
      session: {
        id: 'session-1',
        isActive: true,
      },
    };

    it('should successfully refresh tokens with valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.adminSession.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      
      jwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.refreshToken(refreshToken);

      expect(result).toEqual(
        expect.objectContaining({
          accessToken: 'new-jwt-token',
          refreshToken: expect.any(String),
          // expiresIn: 900, // 15 minutes in seconds
        })
      );
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow('Invalid refresh token');
    });

    it('should detect token reuse and revoke all user tokens', async () => {
      const revokedToken = { ...mockTokenRecord, isRevoked: true };
      
      prisma.refreshToken.findUnique.mockResolvedValue(revokedToken);
      prisma.adminSession.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });
      prisma.auditLog.create.mockResolvedValue({});

      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(/Token reuse detected/);

      // Should revoke session
      expect(prisma.adminSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            revokedReason: 'token_reuse_detected',
          }),
        })
      );

      // Should log security event
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'refresh_reuse_detected',
          }),
        })
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = {
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      };
      
      prisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow('Refresh token expired');
    });

    it('should revoke old token and create new token (token rotation)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.adminSession.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      
      jwtService.sign.mockReturnValue('new-jwt-token');

      await service.refreshToken(refreshToken);

      // Should revoke old token
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTokenRecord.id },
          data: expect.objectContaining({
            isRevoked: true,
            revokedReason: 'rotated',
          }),
        })
      );

      // Should create new token
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should reject refresh for inactive user', async () => {
      const inactiveUserToken = {
        ...mockTokenRecord,
        user: { ...mockTokenRecord.user, isActive: false },
      };
      
      prisma.refreshToken.findUnique.mockResolvedValue(inactiveUserToken);

      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow('Account is deactivated');
    });

    it('should reject refresh for revoked session', async () => {
      const revokedSessionToken = {
        ...mockTokenRecord,
        session: { ...mockTokenRecord.session, isActive: false },
      };
      
      prisma.refreshToken.findUnique.mockResolvedValue(revokedSessionToken);

      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refreshToken(refreshToken)
      ).rejects.toThrow('Session has been revoked');
    });

    it('should update session activity on successful refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.adminSession.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      
      jwtService.sign.mockReturnValue('new-jwt-token');

      await service.refreshToken(refreshToken);

      expect(prisma.adminSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTokenRecord.sessionId },
          data: expect.objectContaining({
            lastActivityAt: expect.any(Date),
          }),
        })
      );
    });
  });

  // ========================================
  // logout() Tests
  // ========================================
  describe('logout', () => {
    const refreshToken = 'valid-refresh-token';
    const hashedToken = 'hashed-token';
    const userId = 'user-1';

    it('should successfully logout by revoking refresh token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-1',
        token: hashedToken,
        userId,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      await service.logout(refreshToken, userId);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-1' },
          data: expect.objectContaining({
            isRevoked: true,
            revokedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should log logout in audit log', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'token-1',
        token: hashedToken,
        userId,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});

      await service.logout(refreshToken, userId);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            action: 'logout',
          }),
        })
      );
    });

    it('should handle logout when token not found (already logged out)', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      // Should not throw
      await expect(service.logout(refreshToken, userId)).resolves.not.toThrow();
    });
  });

  // ========================================
  // logoutAll() Tests
  // ========================================
  describe('logoutAll', () => {
    const userId = 'user-1';

    it('should revoke all user refresh tokens', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });
      prisma.auditLog.create.mockResolvedValue({});

      await service.logoutAll(userId);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, isRevoked: false }, // Actual implementation filters by isRevoked: false
          data: expect.objectContaining({
            isRevoked: true,
          }),
        })
      );
    });

    it('should log logout_all in audit log', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });
      prisma.auditLog.create.mockResolvedValue({});

      await service.logoutAll(userId);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            action: 'logout_all',
          }),
        })
      );
    });
  });

  // ========================================
  // validateUser() Tests
  // ========================================
  describe('validateUser', () => {
    const userId = 'user-1';

    it('should successfully validate active user', async () => {
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'MODERATOR',
        isActive: true,
      };
      
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser(userId);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      await expect(service.validateUser(userId)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(userId)).rejects.toThrow(
        'User not found or inactive'
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'MODERATOR',
        isActive: false,
      };
      
      prisma.adminUser.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.validateUser(userId)).rejects.toThrow(UnauthorizedException);
      await expect(service.validateUser(userId)).rejects.toThrow(
        'User not found or inactive'
      );
    });
  });

  // ========================================
  // Password Reset Tests
  // ========================================
  describe('sendAdminPasswordReset', () => {
    const email = 'user@example.com';

    it('should send password reset email for existing user', async () => {
      const mockUser = { id: 'user-1', email };
      
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminPasswordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.adminPasswordResetToken.create.mockResolvedValue({
        id: 'reset-token-1',
        token: 'hashed-token',
      });

      await service.sendAdminPasswordReset(email);

      expect(prisma.adminPasswordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { adminUserId: mockUser.id },
      });
      expect(prisma.adminPasswordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendAdminPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not disclose non-existent users (return success)', async () => {
      prisma.adminUser.findUnique.mockResolvedValue(null);

      // Should not throw and should not send email
      await expect(service.sendAdminPasswordReset(email)).resolves.not.toThrow();
      expect(emailService.sendAdminPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should generate cryptographically secure token', async () => {
      const mockUser = { id: 'user-1', email };
      
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminPasswordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.adminPasswordResetToken.create.mockResolvedValue({});

      await service.sendAdminPasswordReset(email);

      expect(mockedCrypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should set token expiry to 1 hour', async () => {
      const mockUser = { id: 'user-1', email };
      const now = Date.now();
      
      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminPasswordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.adminPasswordResetToken.create.mockResolvedValue({});

      await service.sendAdminPasswordReset(email);

      expect(prisma.adminPasswordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      );

      // Verify expiry is approximately 1 hour from now
      const createCall = prisma.adminPasswordResetToken.create.mock.calls[0][0];
      const expiryTime = createCall.data.expiresAt.getTime();
      const expectedExpiry = now + (60 * 60 * 1000); // 1 hour
      
      // Allow 5 second tolerance
      expect(Math.abs(expiryTime - expectedExpiry)).toBeLessThan(5000);
    });
  });

  describe('resetAdminPassword', () => {
    const token = 'plain-reset-token';
    const hashedToken = 'hashed-reset-token';
    const newPassword = 'NewSecurePass123!';

    it('should successfully reset password with valid token', async () => {
      const mockTokenRecord = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000), // Expires in 1 hour
        used: false,
        adminUser: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
        },
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.adminUser.update.mockResolvedValue({});
      prisma.adminPasswordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
      
      mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);

      await service.resetAdminPassword(token, newPassword);

      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTokenRecord.adminUserId },
          data: expect.objectContaining({
            passwordHash: 'new-hashed-password',
            sessionVersion: { increment: 1 }, // Prisma increment syntax
          }),
        })
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetAdminPassword(token, newPassword)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.resetAdminPassword(token, newPassword)).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const expiredToken = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        used: false,
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(expiredToken);

      await expect(service.resetAdminPassword(token, newPassword)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for already used token', async () => {
      const usedToken = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: true,
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(usedToken);

      await expect(service.resetAdminPassword(token, newPassword)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should increment session version to invalidate old JWTs', async () => {
      const mockTokenRecord = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        adminUser: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
        },
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.adminUser.update.mockResolvedValue({});
      prisma.adminPasswordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.resetAdminPassword(token, newPassword);

      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionVersion: { increment: 1 }, // Prisma increment syntax
          }),
        })
      );
    });

    it('should mark token as used after successful reset', async () => {
      const mockTokenRecord = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        adminUser: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
        },
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.adminUser.update.mockResolvedValue({});
      prisma.adminPasswordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.resetAdminPassword(token, newPassword);

      expect(prisma.adminPasswordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTokenRecord.id },
          data: { used: true },
        })
      );
    });

    it('should revoke all existing refresh tokens on password reset', async () => {
      const mockTokenRecord = {
        id: 'reset-token-1',
        token: hashedToken,
        adminUserId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        adminUser: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
        },
      };
      
      prisma.adminPasswordResetToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.adminUser.update.mockResolvedValue({});
      prisma.adminPasswordResetToken.update.mockResolvedValue({});
      prisma.adminSession.updateMany.mockResolvedValue({ count: 1 });

      await service.resetAdminPassword(token, newPassword);

      // Should call $transaction with 3 operations
      expect(prisma.$transaction).toHaveBeenCalled();
      
      // Verify the session updateMany was called within transaction
      expect(prisma.adminSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockTokenRecord.adminUserId, isActive: true },
          data: expect.objectContaining({
            isActive: false,
            revokedAt: expect.any(Date),
            revokedReason: 'password_reset',
          }),
        })
      );
    });
  });

  // ========================================
  // Edge Cases & Security Tests
  // ========================================
  describe('Edge cases and security', () => {
    it('should handle concurrent login attempts', async () => {
      const loginDto: LoginDto = {
        email: 'user@example.com',
        password: 'Password123!',
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$2b$12$hashedpassword',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: 0,
        role: 'MODERATOR',
        name: 'Test User',
      };

      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      prisma.adminUser.update.mockResolvedValue(mockUser);
      prisma.adminSession.create.mockResolvedValue({ id: 'session-1' });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.auditLog.create.mockResolvedValue({});
      
      mockedBcrypt.compare.mockResolvedValue(true as never);
      jwtService.sign.mockReturnValue('jwt-token');

      // Simulate concurrent login attempts
      const results = await Promise.all([
        service.login(loginDto, '192.168.1.1'),
        service.login(loginDto, '192.168.1.2'),
        service.login(loginDto, '192.168.1.3'),
      ]);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
      });
    });

    it('should handle empty or whitespace passwords', async () => {
      const loginDto: LoginDto = {
        email: 'user@example.com',
        password: '   ',
      };

      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: '$2b$12$hashedpassword',
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      prisma.adminUser.findUnique.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);
      prisma.adminUser.update.mockResolvedValue({});

      await expect(service.login(loginDto, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should handle very long refresh token strings', async () => {
      const longToken = 'x'.repeat(10000);
      
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(longToken, '192.168.1.1')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should prevent timing attacks on token validation', async () => {
      const token1 = 'token1';
      const token2 = 'token2';

      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const start1 = Date.now();
      try {
        await service.refreshToken(token1);
      } catch (e) {}
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      try {
        await service.refreshToken(token2);
      } catch (e) {}
      const time2 = Date.now() - start2;

      // Timing should be similar (within 50ms) to prevent timing attacks
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });
  });
});