import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BandsService } from '../../src/modules/bands/bands.service';
import { buildBand } from '../helpers/factories';

const createMocks = () => {
  const bandsRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getBandStats: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  };
  const configService = { get: jest.fn() } as any;
  const prismaService = {
    band: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const service = new BandsService(
    bandsRepository as any,
    cacheService as any,
    configService,
    prismaService,
  );

  return { service, bandsRepository, cacheService, prismaService };
};

describe('BandsService (unit)', () => {
  describe('findAll', () => {
    it('returns cached results when present', async () => {
      const { service, bandsRepository, cacheService } = createMocks();
      cacheService.get.mockResolvedValue({ data: ['cached'] });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({ data: ['cached'] });
      expect(bandsRepository.findMany).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('caches database results when cache is cold', async () => {
      const { service, bandsRepository, cacheService } = createMocks();
      const payload = { data: ['db'] };
      cacheService.get.mockResolvedValue(undefined);
      bandsRepository.findMany.mockResolvedValue(payload);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(payload);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('bands:'),
        payload,
        600,
      );
    });
  });

  describe('create', () => {
    it('rejects duplicate slugs', async () => {
      const { service, bandsRepository } = createMocks();
      const band = buildBand();
      bandsRepository.findBySlug.mockResolvedValue({ id: 'conflict', ...band });

      await expect(service.create(band as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates band and clears caches when slug available', async () => {
      const { service, bandsRepository, cacheService } = createMocks();
      const band = buildBand();
      bandsRepository.findBySlug.mockResolvedValue(null);
      bandsRepository.create.mockResolvedValue({ id: 'new-band', ...band });

      const created = await service.create(band as any);

      expect(created.id).toBe('new-band');
      expect(cacheService.delPattern).toHaveBeenCalledWith('bands:*');
    });
  });

  describe('update', () => {
    it('throws when band not found', async () => {
      const { service, bandsRepository } = createMocks();
      bandsRepository.findById.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'x' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('prevents slug conflicts when renaming', async () => {
      const { service, bandsRepository } = createMocks();
      bandsRepository.findById.mockResolvedValue({ id: '1', name: 'Old', slug: 'old' });
      bandsRepository.findBySlug.mockResolvedValue({ id: '2', name: 'Other', slug: 'other' });

      await expect(
        service.update('1', { name: 'Other Band' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clears caches after successful update', async () => {
      const { service, bandsRepository, cacheService } = createMocks();
      bandsRepository.findById.mockResolvedValue({ id: '1', name: 'Old', slug: 'old' });
      bandsRepository.findBySlug.mockResolvedValue(null);
      bandsRepository.update.mockResolvedValue({ id: '1', name: 'New', slug: 'new' });

      await service.update('1', { name: 'New' } as any);

      expect(cacheService.del).toHaveBeenCalledWith('band:1');
      expect(cacheService.delPattern).toHaveBeenCalledWith('bands:*');
    });
  });
});
