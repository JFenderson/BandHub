import { SecurityAuditService, SecurityEventType, AuditSeverity } from '../../src/modules/auth/services/security-audit.service';

const createMocks = () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as any;

  const service = new SecurityAuditService(prisma);
  return { service, prisma };
};

describe('SecurityAuditService (unit)', () => {
  describe('log', () => {
    it('creates an audit log entry with all fields', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: SecurityEventType.LOGIN_SUCCESS,
        entityType: 'auth',
        entityId: 'user-1',
        userId: 'user-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        severity: 'info',
        details: { method: 'password' },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'login_success',
          entityType: 'auth',
          entityId: 'user-1',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          severity: 'info',
          changes: { method: 'password' },
        },
      });
    });

    it('defaults severity to info', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.log({
        action: 'custom_action',
        entityType: 'custom',
        entityId: 'entity-1',
      });

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.severity).toBe('info');
    });

    it('does not throw if audit logging fails', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(
        service.log({
          action: 'test',
          entityType: 'test',
          entityId: 'test',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('logAuth', () => {
    it('logs login success with info severity', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.logAuth(
        SecurityEventType.LOGIN_SUCCESS,
        'user-1',
        { method: 'password' },
        { ip: '127.0.0.1', userAgent: 'test' },
      );

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.action).toBe('login_success');
      expect(createData.severity).toBe('info');
    });

    it('logs login failure with warning severity', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.logAuth(
        SecurityEventType.LOGIN_FAILED,
        'user-1',
        { reason: 'Invalid password' },
      );

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.action).toBe('login_failed');
      expect(createData.severity).toBe('warning');
    });

    it('logs account locked with error severity', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.logAuth(
        SecurityEventType.ACCOUNT_LOCKED,
        'user-1',
      );

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.action).toBe('account_locked');
      expect(createData.severity).toBe('error');
    });

    it('logs token reuse with critical severity', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.logAuth(
        SecurityEventType.TOKEN_REUSE_DETECTED,
        'user-1',
      );

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.action).toBe('token_reuse_detected');
      expect(createData.severity).toBe('critical');
    });
  });

  describe('logUnauthorizedAccess', () => {
    it('logs unauthorized access attempts', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      await service.logUnauthorizedAccess(
        '/api/admin/users',
        'Invalid token',
        { ip: '10.0.0.1', userAgent: 'curl', userId: 'attacker' },
      );

      const createData = prisma.auditLog.create.mock.calls[0][0].data;
      expect(createData.action).toBe('unauthorized_access_attempt');
      expect(createData.entityType).toBe('access');
      expect(createData.entityId).toBe('/api/admin/users');
      expect(createData.severity).toBe('warning');
      expect(createData.changes).toEqual({
        reason: 'Invalid token',
        path: '/api/admin/users',
      });
    });
  });

  describe('query', () => {
    it('queries with all filters', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.query({
        action: 'login_success',
        entityType: 'auth',
        entityId: 'user-1',
        userId: 'user-1',
        severity: 'info',
        startDate,
        endDate,
        limit: 50,
        offset: 10,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: 'login_success',
          entityType: 'auth',
          entityId: 'user-1',
          userId: 'user-1',
          severity: 'info',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 10,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });
    });

    it('limits maximum results to 1000', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.query({ limit: 5000 });

      const findManyCall = prisma.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(1000);
    });

    it('defaults limit to 100', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.query({});

      const findManyCall = prisma.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.take).toBe(100);
    });
  });

  describe('getSecuritySummary', () => {
    it('returns security metrics for the specified period', async () => {
      const { service, prisma } = createMocks();
      
      // Mock the count calls in order
      prisma.auditLog.count
        .mockResolvedValueOnce(1000)  // total
        .mockResolvedValueOnce(5)     // critical
        .mockResolvedValueOnce(20)    // error
        .mockResolvedValueOnce(100)   // warning
        .mockResolvedValueOnce(50)    // failed logins
        .mockResolvedValueOnce(500)   // successful logins
        .mockResolvedValueOnce(30)    // API key events
        .mockResolvedValueOnce(10);   // unauthorized

      const summary = await service.getSecuritySummary(7);

      expect(summary).toEqual({
        totalEvents: 1000,
        criticalEvents: 5,
        errorEvents: 20,
        warningEvents: 100,
        failedLogins: 50,
        successfulLogins: 500,
        apiKeyEvents: 30,
        unauthorizedAttempts: 10,
      });
    });
  });

  describe('exportToJson', () => {
    it('exports audit logs as JSON string', async () => {
      const { service, prisma } = createMocks();
      const now = new Date();
      const mockLogs = [
        { id: 'log-1', action: 'login_success', createdAt: now },
        { id: 'log-2', action: 'login_failed', createdAt: now },
      ];
      prisma.auditLog.findMany.mockResolvedValue(mockLogs);
      prisma.auditLog.count.mockResolvedValue(2);

      const json = await service.exportToJson({});
      const parsed = JSON.parse(json);

      // Verify structure (dates are serialized to strings in JSON)
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('log-1');
      expect(parsed[0].action).toBe('login_success');
      expect(parsed[1].id).toBe('log-2');
      expect(parsed[1].action).toBe('login_failed');
    });

    it('uses large limit for export', async () => {
      const { service, prisma } = createMocks();
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.exportToJson({ limit: 100 });

      const findManyCall = prisma.auditLog.findMany.mock.calls[0][0];
      // Export should use a larger limit (up to 10000) compared to normal queries
      expect(findManyCall.take).toBeGreaterThanOrEqual(1000);
    });
  });
});
