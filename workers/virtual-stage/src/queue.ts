import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { VirtualStageJob } from './types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const virtualStageQueue = new Queue<VirtualStageJob>('propframe:virtual-stage', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export async function enqueueStageJob(job: VirtualStageJob): Promise<void> {
  await virtualStageQueue.add('stage', job, {
    jobId: `virtual-stage-${job.photoId}-${Date.now()}`,
  });
}
