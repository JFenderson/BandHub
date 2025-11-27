import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VideosService } from '../../src/modules/videos/videos.service';
import { buildVideo } from '../helpers/factories';

const createMocks = () => {
  const videosRepository = {
    findMany: jest.fn(),
    findById: jest.fn(),
    findByYoutubeId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delPattern: jest.fn(),
  };
  const configService = { get: jest.fn() } as any;
  const prismaService = { video: { findUnique: jest.fn(), update: jest.fn() } } as any;

  const service = new VideosService(
    videosRepository as any,
    cacheService as any,
    configService,
    prismaService,
  );

  return { service, videosRepository, cacheService };
};

describe('VideosService (unit)', () => {
  it('throws on duplicate YouTube IDs', async () => {
    const { service, videosRepository } = createMocks();
    const video = buildVideo({ youtubeId: 'abc123' });
    videosRepository.findByYoutubeId.mockResolvedValue({ id: 'existing' });

    await expect(service.create(video as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sets cache on findAll cache miss', async () => {
    const { service, videosRepository, cacheService } = createMocks();
    cacheService.get.mockResolvedValue(undefined);
    videosRepository.findMany.mockResolvedValue({ data: [buildVideo()] });

    await service.findAll({ page: 1, limit: 10 });

    expect(cacheService.set).toHaveBeenCalled();
  });

  it('hides and unhides videos through update helper', async () => {
    const { service, videosRepository } = createMocks();
    videosRepository.update.mockResolvedValue({ id: 'v1', isHidden: true });

    const hidden = await service.hideVideo('v1', 'inappropriate');
    expect(videosRepository.update).toHaveBeenCalledWith('v1', {
      isHidden: true,
      hideReason: 'inappropriate',
    });

    videosRepository.update.mockResolvedValue({ id: 'v1', isHidden: false });
    const visible = await service.unhideVideo('v1');
    expect(videosRepository.update).toHaveBeenCalledWith('v1', {
      isHidden: false,
      hideReason: null,
    });
    expect(visible.isHidden).toBe(false);
  });

  it('throws when video missing on findById', async () => {
    const { service, videosRepository } = createMocks();
    videosRepository.findById.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
