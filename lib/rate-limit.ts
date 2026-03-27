import { logger } from './logger';

// In-memory fallback store for development
const memoryStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

function getMemoryStore(key: string): { count: number; resetAt: number } | undefined {
  const entry = memoryStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.resetAt) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry;
}

function setMemoryStore(key: string, resetAt: number): { count: number; resetAt: number } {
  const existing = getMemoryStore(key);
  if (existing) {
    existing.count++;
    return existing;
  }
  const entry = { count: 1, resetAt };
  memoryStore.set(key, entry);
  return entry;
}

export async function rateLimit(opts: {
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { identifier, limit, windowMs } = opts;
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetAt = now + windowMs;

  try {
    // Try Redis first via BullMQ's connection
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });

      try {
        // Sliding window: increment and set expiry atomically
        const multi = redis.multi();
        multi.zadd(key, now, `${now}-${Math.random()}`);
        multi.zremrangebyscore(key, 0, windowStart);
        multi.zcard(key);
        multi.expire(key, Math.ceil(windowMs / 1000));
        const results = await multi.exec();

        if (results) {
          const count = results[2][1] as number;
          if (count > limit) {
            await redis.quit();
            const retryAfter = Math.ceil(windowMs / 1000);
            logger.rateLimit.warn('Rate limit exceeded', { identifier, count, limit });
            return { success: false, remaining: 0, resetAt, retryAfter };
          }
          await redis.quit();
          return { success: true, remaining: limit - count, resetAt };
        }
      } catch (redisErr) {
        logger.rateLimit.warn('Redis rate limit error, falling back to memory', { error: (redisErr as Error).message });
        await redis.quit();
      }
    }
  } catch {
    // Redis unavailable, fall through to memory
  }

  // In-memory fallback
  const entry = getMemoryStore(key);
  if (entry) {
    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - Date.now()) / 1000);
      logger.rateLimit.warn('Rate limit exceeded (memory)', { identifier, count: entry.count, limit });
      return { success: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
    }
    entry.count++;
    return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
  }

  setMemoryStore(key, resetAt);
  return { success: true, remaining: limit - 1, resetAt };
}
