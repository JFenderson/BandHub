import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { VideoSyncQueueProcessor } from './video-sync-queue.processor';

describe('VideoSyncQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      syncBandHandler: { handle: jest.fn().mockResolvedValue('sync-band-result') },
      syncAllBandsHandler: { handle: jest.fn().mockResolvedValue('sync-all-bands-result') },
      backfillCreatorsHandler: { handle: jest.fn().mockResolvedValue('backfill-creators-result') },
      backfillBandsHandler: { handle: jest.fn().mockResolvedValue('backfill-bands-result') },
    };
    const processor = new VideoSyncQueueProcessor(
      handlers.syncBandHandler as any,
      handlers.syncAllBandsHandler as any,
      handlers.backfillCreatorsHandler as any,
      handlers.backfillBandsHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a sync-band job only to SyncBandHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.SYNC_BAND);

    const result = await processor.process(job);

    expect(handlers.syncBandHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.syncAllBandsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCreatorsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillBandsHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('sync-band-result');
  });

  it('routes a backfill-creators job only to BackfillCreatorsHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.BACKFILL_CREATORS);

    await processor.process(job);

    expect(handlers.backfillCreatorsHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.syncBandHandler.handle).not.toHaveBeenCalled();
  });

  it('logs and skips an update-stats job without calling any handler', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed(JobType.UPDATE_STATS);

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.syncBandHandler.handle).not.toHaveBeenCalled();
    expect(handlers.syncAllBandsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCreatorsHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillBandsHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('some-unrelated-job'));
  });
});
