import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiKeyService } from '../../src/modules/auth/services/api-key.service';

const createMocks = () => {
  const prisma = {
    apiKey: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  } as any;

  const service = new ApiKeyService(prisma);
  return { service, prisma };
};

describe('ApiKeyService (unit)', () => {
  describe('createApiKey', () => {
    it('creates an API key with correct format', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.create.mockImplementation(({ data }: any) => ({
        id: 'key-1',
        key: data.key,
        name: data.name,
        description: data.description,
        isActive: true,
        createdAt: new Date(),
      }));

      const result = await service.createApiKey({
        name: 'Test Key',
        description: 'A test API key',
      });

      expect(result.name).toBe('Test Key');
      expect(prisma.apiKey.create).toHaveBeenCalled();
      
      // Verify key format
      const createdKey = prisma.apiKey.create.mock.calls[0][0].data.key;
      expect(createdKey).toMatch(/^bhub_live_[a-f0-9]{64}$/);
    });

    it('creates an API key with expiration date from expiresInDays', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.create.mockImplementation(({ data }: any) => ({
        id: 'key-1',
        ...data,
        isActive: true,
        createdAt: new Date(),
      }));

      const now = Date.now();
      await service.createApiKey({
        name: 'Expiring Key',
        expiresInDays: 30,
      });

      const createdData = prisma.apiKey.create.mock.calls[0][0].data;
      expect(createdData.expiresAt).toBeDefined();
      
      // Should be approximately 30 days in the future
      const expiresAt = new Date(createdData.expiresAt).getTime();
      const expectedExpiry = now + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('validateApiKey', () => {
    it('returns null for non-existent key', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.findUnique.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid-key');
      expect(result).toBeNull();
    });

    it('returns null for inactive key', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        name: 'Inactive Key',
        isActive: false,
        expiresAt: null,
      });

      const result = await service.validateApiKey('some-key');
      expect(result).toBeNull();
    });

    it('returns null for expired key', async () => {
      const { service, prisma } = createMocks();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        name: 'Expired Key',
        isActive: true,
        expiresAt: pastDate,
      });

      const result = await service.validateApiKey('some-key');
      expect(result).toBeNull();
    });

    it('returns key info for valid key and updates usage', async () => {
      const { service, prisma } = createMocks();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        name: 'Valid Key',
        isActive: true,
        expiresAt: futureDate,
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey('some-key');
      
      expect(result).toEqual({ id: 'key-1', name: 'Valid Key' });
    });
  });

  describe('rotateApiKey', () => {
    it('throws NotFoundException for non-existent key', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.rotateApiKey('non-existent'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('generates a new key and updates rotation timestamp', async () => {
      const { service, prisma } = createMocks();
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        key: 'old-key',
        name: 'Rotation Test',
        createdAt,
        expiresAt,
      });
      prisma.apiKey.update.mockImplementation(({ data }: any) => ({
        id: 'key-1',
        ...data,
        name: 'Rotation Test',
      }));

      const result = await service.rotateApiKey('key-1');

      expect(result.key).toMatch(/^bhub_live_[a-f0-9]{64}$/);
      expect(result.key).not.toBe('old-key');
      
      const updateData = prisma.apiKey.update.mock.calls[0][0].data;
      expect(updateData.lastRotatedAt).toBeDefined();
      expect(updateData.rotationWarningsSent).toBe(0);
    });
  });

  describe('extendExpiration', () => {
    it('throws BadRequestException for non-positive days', async () => {
      const { service } = createMocks();

      await expect(service.extendExpiration('key-1', 0))
        .rejects.toBeInstanceOf(BadRequestException);
      
      await expect(service.extendExpiration('key-1', -5))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for non-existent key', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.extendExpiration('non-existent', 30))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('extends expiration by the specified days', async () => {
      const { service, prisma } = createMocks();
      const currentExpiry = new Date();
      currentExpiry.setDate(currentExpiry.getDate() + 10);
      
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        expiresAt: currentExpiry,
      });
      prisma.apiKey.update.mockImplementation(({ data }: any) => ({
        id: 'key-1',
        ...data,
      }));

      await service.extendExpiration('key-1', 30);

      const updateData = prisma.apiKey.update.mock.calls[0][0].data;
      const newExpiry = new Date(updateData.expiresAt);
      
      // New expiry should be approximately 40 days from now (10 + 30)
      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 40);
      
      expect(Math.abs(newExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
      expect(updateData.rotationWarningsSent).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    it('throws NotFoundException for non-existent key', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(service.getUsageStats('non-existent'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('calculates usage statistics correctly', async () => {
      const { service, prisma } = createMocks();
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - 10); // Created 10 days ago
      
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        name: 'Stats Key',
        usageCount: 100,
        lastUsedAt: new Date(),
        createdAt,
        lastRotatedAt: null,
      });

      const result = await service.getUsageStats('key-1');

      expect(result.usageCount).toBe(100);
      expect(result.usagePerDay).toBe(10); // 100 uses over 10 days = 10 per day
      expect(result.daysSinceCreation).toBe(10);
    });
  });

  describe('revokeApiKey', () => {
    it('sets isActive to false', async () => {
      const { service, prisma } = createMocks();
      prisma.apiKey.update.mockResolvedValue({
        id: 'key-1',
        name: 'Revoked Key',
        isActive: false,
      });

      await service.revokeApiKey('key-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { isActive: false },
      });
    });
  });
});
