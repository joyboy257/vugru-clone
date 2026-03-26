# PropFrame Video Worker

Standalone GPU worker process for clip generation. Runs independently of the Next.js app.

## Stack

- **BullMQ** + **Redis** — job queue with retries, rate limiting, dead-letter handling
- **Replicate (CogVideoX)** — image-to-video generation
- **Cloudflare R2** — photo input and video output storage
- **TypeScript + tsx** — runs natively, no Docker required

## Architecture

```
POST /api/clips/generate
    → creates DB record (status: queued)
    → enqueues BullMQ job

BullMQ Worker (separate process)
    → picks up job
    → gets signed R2 URL for photo
    → calls Replicate (CogVideoX)
    → polls until video ready
    → uploads result to R2
    → updates DB (status: done/error)
```

## Quick Start

```bash
cd workers/video-render
cp .env.example ../../.env.local   # fill in your keys
npm install
npm run dev
```

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry point |
| `src/queue.ts` | BullMQ queue + connection management |
| `src/processor.ts` | Main job handler — orchestrates the pipeline |
| `src/replicate.ts` | Replicate API client + prediction polling |
| `src/r2.ts` | R2 operations — download input, upload output |
| `src/clips.ts` | DB writes to update clip status |
| `src/types.ts` | Zod schemas for job data |

## Environment Variables

See `.env.example` for all required variables.

## Scaling

Increase `WORKER_CONCURRENCY` for more parallel clips (memory/GPU limited).
Add more worker instances behind the same Redis URL to scale horizontally.
