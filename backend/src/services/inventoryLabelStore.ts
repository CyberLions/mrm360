import Redis from 'ioredis';
import { logger } from '@/utils/logger';

// Finished PDFs live in Redis because the API and worker run in separate
// containers with no shared filesystem. They are only needed until the user
// downloads them, so they expire on their own.
const KEY_PREFIX = 'inventory-labels:pdf:';
export const LABEL_PDF_TTL_SECONDS = 60 * 60;

let redis: Redis | null = null;

function connection(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('error', (error) => logger.error('Inventory label store Redis error', { error }));
  }
  return redis;
}

export async function saveLabelPdf(jobId: string, pdf: Uint8Array): Promise<void> {
  await connection().set(KEY_PREFIX + jobId, Buffer.from(pdf), 'EX', LABEL_PDF_TTL_SECONDS);
}

export async function loadLabelPdf(jobId: string): Promise<Buffer | null> {
  return connection().getBuffer(KEY_PREFIX + jobId);
}
