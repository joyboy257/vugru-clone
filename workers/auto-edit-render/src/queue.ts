import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { AutoEditRenderJob } from './types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const AUTO_EDIT_RENDER_QUEUE_NAME = 'propframe:auto-edit-render';

const autoEditQueue = new Queue<AutoEditRenderJob>(AUTO_EDIT_RENDER_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export async function enqueueAutoEditRenderJob(job: AutoEditRenderJob): Promise<void> {
  await autoEditQueue.add('render', job, {
    jobId: `auto-edit-${job.autoEditId}-${Date.now()}`,
  });
}

export async function closeQueue(): Promise<void> {
  await autoEditQueue.close();
  await connection.quit();
}
