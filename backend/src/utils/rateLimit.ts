import Redis from 'ioredis';
import { NextApiRequest } from 'next';
import { logger } from './logger';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: 1 });
    redis.on('error', (error) => logger.error('Rate limiter Redis error', { error }));
  }
  return redis;
}

/**
 * Best-effort client address. Behind the ingress the last X-Forwarded-For entry is the one
 * the proxy appended; earlier entries are client-supplied and must not be trusted.
 */
export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return chain[chain.length - 1] || req.socket?.remoteAddress || 'unknown';
}

/**
 * Fixed-window counter. Returns true when the caller is over the limit. Fails open
 * if Redis is unreachable so an outage doesn't lock legitimate users out.
 */
export async function isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const client = getRedis();
    const redisKey = `ratelimit:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) await client.expire(redisKey, windowSeconds);
    return count > limit;
  } catch (error) {
    logger.error('Rate limit check failed; allowing request', { error, key });
    return false;
  }
}
