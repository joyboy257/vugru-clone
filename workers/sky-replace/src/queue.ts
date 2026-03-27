import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { SkyReplaceJob } from './types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const skyReplaceQueue = new Queue<SkyReplaceJob>('propframe:sky-replace', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export async function enqueueSkyReplaceJob(job: SkyReplaceJob): Promise<void> {
  await skyReplaceQueue.add('sky-replace', job, {
    jobId: `sky-replace-${job.photoId}-${Date.now()}`,
  });
}