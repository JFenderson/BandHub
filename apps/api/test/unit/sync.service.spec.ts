import { SyncService } from '../../src/modules/sync/sync.service';

const createMocks = () => {
  const queueService = { addJob: jest.fn(), getQueueStatus: jest.fn() } as any;
  const database = {
   contentCreator: { 
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({ id: 'creator-1' }),
  },
    video: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    band: { findUnique: jest.fn() },
  } as any;
  const youtubeService = { getChannelVideos: jest.fn() } as any;

  const service = new SyncService(queueService, database, youtubeService);
  return { service, queueService, database, youtubeService };
};

describe('SyncService utilities', () => {
  it('detectBands ranks matches based on names and abbreviations', () => {
    const sample = 'The Marching Wildcats of Bethune-Cookman perform';
    const result = SyncService.detectBands(sample);

    expect(result.bandId).toBe('marching-wildcats');
    expect(result.matchDetails?.length).toBeGreaterThan(0);
  });

  it('queues sync jobs for creators', async () => {
    const { service, queueService, youtubeService, database } = createMocks();
    database.contentCreator.findUnique.mockResolvedValue({
      id: 'creator-1',
      name: 'Creator',
      youtubeChannelId: 'channel-1',
    });
    youtubeService.getChannelVideos.mockResolvedValue([]);

    await service.syncCreatorChannel('creator-1', { maxVideos: 1 });

    expect(youtubeService.getChannelVideos).toHaveBeenCalledWith('channel-1', 1);
  });
});
