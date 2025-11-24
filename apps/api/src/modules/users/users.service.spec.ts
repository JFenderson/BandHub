import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '@hbcu-band-hub/prisma';

// Mock bcrypt module
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Import bcrypt after mocking
import * as bcrypt from 'bcrypt';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  emailVerificationToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((operations) => Promise.all(operations)),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test-secret'),
};

const mockEmailService = {
  sendWelcomeEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendPasswordChangedEmail: jest.fn(),
  sendAccountDeletedEmail: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'TestPass123',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: registerDto.email,
        name: registerDto.name,
        createdAt: new Date(),
      });
      mockPrismaService.emailVerificationToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'hashed-token',
      });

      const result = await service.register(registerDto);

      expect(result.message).toContain('Registration successful');
      expect(result.user.email).toBe(registerDto.email.toLowerCase());
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'TestPass123',
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: '$2b$12$hashedpassword',
      avatar: null,
      emailVerified: true,
    };

    it('should successfully login a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        token: 'hashed-session-token',
      });

      const result = await service.login(loginDto);

      expect(result.accessToken).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });
      mockPrismaService.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({
        id: 'token-1',
        token: 'hashed-token',
      });

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not throw error for non-existing user (prevent email enumeration)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword({ email: 'nonexistent@example.com' })).resolves.not.toThrow();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      mockPrismaService.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn;
      });

      await expect(service.verifyEmail('valid-token')).resolves.not.toThrow();
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrismaService.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    const changePasswordDto = {
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    };

    it('should successfully change password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: '$2b$12$hashedpassword',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$12$newhashedpassword');
      mockPrismaService.$transaction.mockImplementation(async (operations) => {
        return operations;
      });

      await expect(service.changePassword('user-1', changePasswordDto)).resolves.not.toThrow();
      expect(mockEmailService.sendPasswordChangedEmail).toHaveBeenCalled();
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$2b$12$hashedpassword',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.changePassword('user-1', changePasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSessions', () => {
    it('should return user sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          deviceType: 'Desktop',
          browser: 'Chrome',
          ipAddress: '127.0.0.1',
          lastActiveAt: new Date(),
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ];

      mockPrismaService.userSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.getSessions('user-1');

      expect(result).toEqual(mockSessions);
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account and send confirmation email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await service.deleteAccount('user-1');

      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockEmailService.sendAccountDeletedEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
      );
    });
  });
});
