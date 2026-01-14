import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionService } from '../../src/modules/auth/services/session.service';
import { PrismaService } from '@bandhub/database';
import * as crypto from 'crypto';

jest.mock('crypto');
const mockedCrypto = crypto as jest.Mocked<typeof crypto>;

describe('SessionService', () => {
  let service: SessionService;
  let prisma: jest.Mocked<PrismaService>;

  const mockSession = {
    id: 'session-123',
    userId: 'user-123',
    tokenChainId: 'chain-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    deviceType: 'Desktop',
    browser: 'Chrome',
    os: 'Windows',
    country: 'US',
    city: 'New York',
    isActive: true,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    const mockPrisma = {
      adminSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      adminUser: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session with default expiry', async () => {
      const sessionId = 'new-session-id';
      const tokenChainId = 'new-chain-id';
      
      mockedCrypto.randomUUID = jest.fn()
        .mockReturnValueOnce(sessionId)
        .mockReturnValueOnce(tokenChainId);

      prisma.adminSession.create.mockResolvedValue({
        ...mockSession,
        id: sessionId,
        tokenChainId,
      });

      const result = await service.createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).toEqual({
        sessionId,
        tokenChainId,
      });

      expect(prisma.adminSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: sessionId,
          userId: 'user-123',
          tokenChainId,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          isActive: true,
        }),
      });
    });

    it('should create session with custom expiry', async () => {
      const sessionId = 'new-session-id';
      const tokenChainId = 'new-chain-id';
      
      mockedCrypto.randomUUID = jest.fn()
        .mockReturnValueOnce(sessionId)
        .mockReturnValueOnce(tokenChainId);

      prisma.adminSession.create.mockResolvedValue({
        ...mockSession,
        id: sessionId,
        tokenChainId,
      });

      await service.createSession({
        userId: 'user-123',
        expiresInDays: 7,
      });

      expect(prisma.adminSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should parse device information from user agent', async () => {
      const sessionId = 'new-session-id';
      const tokenChainId = 'new-chain-id';
      
      mockedCrypto.randomUUID = jest.fn()
        .mockReturnValueOnce(sessionId)
        .mockReturnValueOnce(tokenChainId);

      prisma.adminSession.create.mockResolvedValue({
        ...mockSession,
        id: sessionId,
        tokenChainId,
      });

      await service.createSession({
        userId: 'user-123',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      });

      expect(prisma.adminSession.create).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return session by id', async () => {
      prisma.adminSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.getSession('session-123');

      expect(result).toEqual({
        id: mockSession.id,
        ipAddress: mockSession.ipAddress,
        userAgent: mockSession.userAgent,
        deviceType: mockSession.deviceType,
        browser: mockSession.browser,
        os: mockSession.os,
        country: mockSession.country,
        city: mockSession.city,
        isActive: mockSession.isActive,
        lastActivityAt: mockSession.lastActivityAt,
        createdAt: mockSession.createdAt,
        expiresAt: mockSession.expiresAt,
      });

      expect(prisma.adminSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
    });

    it('should throw NotFoundException if session does not exist', async () => {
      prisma.adminSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession('non-existent')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getUserSessions', () => {
    it('should return all active sessions for user', async () => {
      const sessions = [mockSession, { ...mockSession, id: 'session-456' }];
      prisma.adminSession.findMany.mockResolvedValue(sessions);

      const result = await service.getUserSessions('user-123');

      expect(result).toHaveLength(2);
      expect(prisma.adminSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastActivityAt: 'desc' },
      });
    });

    it('should mark current session', async () => {
      const sessions = [
        mockSession,
        { ...mockSession, id: 'session-456' },
      ];
      prisma.adminSession.findMany.mockResolvedValue(sessions);

      const result = await service.getUserSessions('user-123', 'session-123');

      expect(result[0].isCurrent).toBe(true);
      expect(result[1].isCurrent).toBe(false);
    });

    it('should return empty array if no sessions', async () => {
      prisma.adminSession.findMany.mockResolvedValue([]);

      const result = await service.getUserSessions('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('updateSessionActivity', () => {
    it('should update last activity time', async () => {
      prisma.adminSession.update.mockResolvedValue({
        ...mockSession,
        lastActivityAt: new Date(),
      });

      await service.updateSessionActivity('session-123');

      expect(prisma.adminSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          lastActivityAt: expect.any(Date),
        },
      });
    });

    it('should update with new IP and user agent', async () => {
      prisma.adminSession.update.mockResolvedValue(mockSession);

      await service.updateSessionActivity('session-123', {
        ipAddress: '192.168.1.2',
        userAgent: 'New Agent',
      });

      expect(prisma.adminSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: expect.objectContaining({
          ipAddress: '192.168.1.2',
          userAgent: 'New Agent',
        }),
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke session by id', async () => {
      prisma.adminSession.update.mockResolvedValue({
        ...mockSession,
        isActive: false,
      });

      await service.revokeSession('session-123');

      expect(prisma.adminSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if session does not exist', async () => {
      prisma.adminSession.update.mockRejectedValue(
        new Error('Record to update not found')
      );

      await expect(service.revokeSession('non-existent')).rejects.toThrow();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all sessions for user', async () => {
      prisma.adminSession.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserSessions('user-123');

      expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should exclude specific session when provided', async () => {
      prisma.adminSession.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeAllUserSessions('user-123', 'session-123');

      expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          id: { not: 'session-123' },
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('revokeSessionsByTokenChain', () => {
    it('should revoke all sessions with token chain', async () => {
      prisma.adminSession.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeSessionsByTokenChain('chain-123');

      expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
        where: {
          tokenChainId: 'chain-123',
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('deleteExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      prisma.adminSession.count.mockResolvedValue(5);
      prisma.adminSession.deleteMany = jest.fn().mockResolvedValue({ count: 5 });

      const result = await service.deleteExpiredSessions();

      expect(result).toEqual({ deletedCount: 5 });
      expect(prisma.adminSession.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            {
              isActive: false,
              revokedAt: { lt: expect.any(Date) },
            },
          ],
        },
      });
    });

    it('should return 0 if no sessions to delete', async () => {
      prisma.adminSession.count.mockResolvedValue(0);
      prisma.adminSession.deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      const result = await service.deleteExpiredSessions();

      expect(result).toEqual({ deletedCount: 0 });
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid active session', async () => {
      prisma.adminSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.isSessionValid('session-123');

      expect(result).toBe(true);
    });

    it('should return false for inactive session', async () => {
      prisma.adminSession.findUnique.mockResolvedValue({
        ...mockSession,
        isActive: false,
      });

      const result = await service.isSessionValid('session-123');

      expect(result).toBe(false);
    });

    it('should return false for expired session', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      prisma.adminSession.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: expiredDate,
      });

      const result = await service.isSessionValid('session-123');

      expect(result).toBe(false);
    });

    it('should return false if session does not exist', async () => {
      prisma.adminSession.findUnique.mockResolvedValue(null);

      const result = await service.isSessionValid('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return count of active sessions', async () => {
      prisma.adminSession.count.mockResolvedValue(3);

      const result = await service.getActiveSessionCount('user-123');

      expect(result).toBe(3);
      expect(prisma.adminSession.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should return 0 if no active sessions', async () => {
      prisma.adminSession.count.mockResolvedValue(0);

      const result = await service.getActiveSessionCount('user-123');

      expect(result).toBe(0);
    });
  });

  describe('enforceSessionLimit', () => {
    it('should not revoke sessions if under limit', async () => {
      prisma.adminSession.count.mockResolvedValue(3);

      await service.enforceSessionLimit('user-123', 5);

      expect(prisma.adminSession.updateMany).not.toHaveBeenCalled();
    });

    it('should revoke oldest sessions if over limit', async () => {
      const oldestSessions = [
        { ...mockSession, id: 'old-1', lastActivityAt: new Date('2023-01-01') },
        { ...mockSession, id: 'old-2', lastActivityAt: new Date('2023-01-02') },
      ];

      prisma.adminSession.count.mockResolvedValue(7);
      prisma.adminSession.findMany.mockResolvedValue(oldestSessions);
      prisma.adminSession.updateMany.mockResolvedValue({ count: 2 });

      await service.enforceSessionLimit('user-123', 5);

      expect(prisma.adminSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
        },
        orderBy: { lastActivityAt: 'asc' },
        take: 2,
        select: { id: true },
      });

      expect(prisma.adminSession.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['old-1', 'old-2'] },
        },
        data: {
          isActive: false,
          revokedAt: expect.any(Date),
        },
      });
    });

    it('should exclude current session from limit enforcement', async () => {
      const oldestSessions = [
        { ...mockSession, id: 'old-1', lastActivityAt: new Date('2023-01-01') },
      ];

      prisma.adminSession.count.mockResolvedValue(6);
      prisma.adminSession.findMany.mockResolvedValue(oldestSessions);
      prisma.adminSession.updateMany.mockResolvedValue({ count: 1 });

      await service.enforceSessionLimit('user-123', 5, 'current-session');

      expect(prisma.adminSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          id: { not: 'current-session' },
        },
        orderBy: { lastActivityAt: 'asc' },
        take: 1,
        select: { id: true },
      });
    });
  });
});
