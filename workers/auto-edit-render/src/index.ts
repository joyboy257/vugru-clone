import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { processRenderJob } from './processor.js';
import type { AutoEditRenderJob } from './types.js';
import { closeQueue } from './queue.js';
import { closeDb } from './db.js';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const QUEUE_NAME = 'propframe:auto-edit-render';

const worker = new Worker<AutoEditRenderJob>(
  QUEUE_NAME,
  async (job) => {
    console.log(JSON.stringify({
      job: 'auto-edit-render',
      jobId: job.id,
      autoEditId: job.data.autoEditId,
      status: 'processing',
    }));
    await processRenderJob(job.data);
  },
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
  }
);

worker.on('completed', (job) => {
  console.log(JSON.stringify({
    job: 'auto-edit-render',
    jobId: job.id,
    autoEditId: job.data.autoEditId,
    status: 'completed',
  }));
});

worker.on('failed', (job, err) => {
  console.error(JSON.stringify({
    job: 'auto-edit-render',
    jobId: job?.id,
    autoEditId: job?.data.autoEditId,
    status: 'failed',
    error: err.message,
  }));
});

worker.on('error', (err) => {
  console.error(JSON.stringify({
    job: 'auto-edit-render',
    status: 'worker-error',
    error: err.message,
  }));
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  console.log(JSON.stringify({ job: 'auto-edit-render', status: 'shutting-down', signal }));
  await worker.close();
  await closeQueue();
  await closeDb();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log(JSON.stringify({
  job: 'auto-edit-render',
  status: 'started',
  queue: QUEUE_NAME,
  concurrency: process.env.WORKER_CONCURRENCY || 2,
}));
