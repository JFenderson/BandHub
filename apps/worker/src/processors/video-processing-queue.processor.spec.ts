import { Job } from 'bullmq';
import { JobType } from '@hbcu-band-hub/shared-types';
import { VideoProcessingQueueProcessor } from './video-processing-queue.processor';

describe('VideoProcessingQueueProcessor', () => {
  function buildProcessor() {
    const handlers = {
      processVideoHandler: { handle: jest.fn().mockResolvedValue('process-video-result') },
      classifyVideosHandler: { handle: jest.fn().mockResolvedValue('classify-videos-result') },
      matchVideosHandler: { handle: jest.fn().mockResolvedValue('match-videos-result') },
      promoteVideosHandler: { handle: jest.fn().mockResolvedValue('promote-videos-result') },
      rematchVideosHandler: { handle: jest.fn().mockResolvedValue('rematch-videos-result') },
    };
    const processor = new VideoProcessingQueueProcessor(
      handlers.processVideoHandler as any,
      handlers.classifyVideosHandler as any,
      handlers.matchVideosHandler as any,
      handlers.promoteVideosHandler as any,
      handlers.rematchVideosHandler as any,
    );
    return { processor, handlers };
  }

  function jobNamed(name: string): Job {
    return { id: 'job-1', name, data: {} } as unknown as Job;
  }

  it('routes a process-video job only to ProcessVideoHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.PROCESS_VIDEO);

    const result = await processor.process(job);

    expect(handlers.processVideoHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.classifyVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.rematchVideosHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('process-video-result');
  });

  it('routes a match-videos job only to MatchVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.MATCH_VIDEOS);

    await processor.process(job);

    expect(handlers.matchVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
  });

  it('routes a promote-videos job only to PromoteVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.PROMOTE_VIDEOS);

    await processor.process(job);

    expect(handlers.promoteVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
  });

  it('routes a classify-videos job only to ClassifyVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.CLASSIFY_VIDEOS);

    const result = await processor.process(job);

    expect(handlers.classifyVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.rematchVideosHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('classify-videos-result');
  });

  it('routes a rematch-videos job only to RematchVideosHandler', async () => {
    const { processor, handlers } = buildProcessor();
    const job = jobNamed(JobType.REMATCH_VIDEOS);

    const result = await processor.process(job);

    expect(handlers.rematchVideosHandler.handle).toHaveBeenCalledWith(job);
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
    expect(handlers.classifyVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(result).toBe('rematch-videos-result');
  });

  it('logs a warning and calls no handler for an unknown job name', async () => {
    const { processor, handlers } = buildProcessor();
    const warnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation(() => undefined);
    const job = jobNamed('some-unrelated-job');

    const result = await processor.process(job);

    expect(result).toBeUndefined();
    expect(handlers.processVideoHandler.handle).not.toHaveBeenCalled();
    expect(handlers.classifyVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.matchVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.promoteVideosHandler.handle).not.toHaveBeenCalled();
    expect(handlers.rematchVideosHandler.handle).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('some-unrelated-job'),
    );
  });
});
