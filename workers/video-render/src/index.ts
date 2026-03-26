import { Worker, Job } from 'bullmq';
import { getRedisConnection, closeQueue } from './queue.js';
import { ClipJob, ClipJobResult } from './types.js';
import { processClipJob } from './processor.js';

const QUEUE_NAME = 'propframe:clips';

async function main() {
  console.log('🚀 PropFrame Video Worker starting...');

  const connection = getRedisConnection();

  const worker = new Worker<ClipJob, ClipJobResult>(
    QUEUE_NAME,
    async (job: Job<ClipJob, ClipJobResult>) => {
      console.log(`[${job.id}] Processing clip ${job.data.clipId}`);

      try {
        const result = await processClipJob(job.data);
        console.log(`[${job.id}] ✅ Clip ${job.data.clipId} done → ${result.publicUrl}`);
        return result;
      } catch (err) {
        console.error(`[${job.id}] ❌ Clip ${job.data.clipId} failed:`, err);
        throw err;
      }
    },
    {
      connection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
      limiter: {
        max: parseInt(process.env.WORKER_RATE_LIMIT || '10', 10),
        duration: 60000, // per minute
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[${job.id}] ✔ Completed clip ${job.data.clipId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${job?.id}] ✘ Failed clip ${job?.data.clipId}: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down worker...`);
    await worker.close();
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`📡 Worker listening on queue "${QUEUE_NAME}" (concurrency: ${process.env.WORKER_CONCURRENCY || 2})`);
  console.log(`🔗 Replicate token: ${process.env.REPLICATE_API_TOKEN ? 'set' : 'MISSING — using mock mode'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'connected' : 'MISSING — check DATABASE_URL'}`);
}

main().catch(err => {
  console.error('Worker startup error:', err);
  process.exit(1);
});
