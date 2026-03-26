import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processStageJob } from './processor.js';
import type { VirtualStageJob } from './types.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker<VirtualStageJob>(
  'propframe:virtual-stage',
  async (job) => {
    console.log(`Processing virtual stage job ${job.id} for photo ${job.data.photoId}`);
    await processStageJob(job.data);
    console.log(`Virtual stage job ${job.id} completed. Result URL logged.`);
  },
  {
    connection,
    concurrency: 3,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Virtual stage worker started. Listening for jobs...');

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing worker...');
  await worker.close();
  process.exit(0);
});
