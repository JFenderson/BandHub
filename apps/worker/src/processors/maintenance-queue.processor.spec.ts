import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { MaintenanceQueueProcessor } from './maintenance-queue.processor';

describe('MaintenanceQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      cleanupHandler: { handle: jest.fn().mockResolvedValue(undefined) },
      notificationHandler: { handle: jest.fn().mockResolvedValue(undefined) },
      backfillCategoriesHandler: { handle: jest.fn().mockResolvedValue('categorize-result') },
    };
    const processor = new MaintenanceQueueProcessor(
      handlers.cleanupHandler as any,
      handlers.notificationHandler as any,
      handlers.backfillCategoriesHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a cleanup-videos job only to CleanupHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.CLEANUP_VIDEOS);

    await processor.process(job);

    expect(handlers.cleanupHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.notificationHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
  });

  it('routes a categorize-videos job only to BackfillCategoriesHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.CATEGORIZE_VIDEOS);

    const result = await processor.process(job);

    expect(handlers.backfillCategoriesHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('categorize-result');
  });

  it('routes both notification job names only to NotificationHandler', async () => {
    const { processor, handlers } = buildProcessor();

    await processor.process(jobNamed('NEW_VIDEO_NOTIFICATION'));
    await processor.process(jobNamed('WEEKLY_DIGEST'));

    expect(handlers.notificationHandler.handle).toHaveBeenCalledTimes(2);
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.cleanupHandler.handle).not.toHaveBeenCalled();
    expect(handlers.notificationHandler.handle).not.toHaveBeenCalled();
    expect(handlers.backfillCategoriesHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('some-unrelated-job'));
  });
});
