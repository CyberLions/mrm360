import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@/utils/logger';

// Redis connection with BullMQ-compatible options
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

// Queue names
export const QUEUE_NAMES = {
  EMAIL: 'email',
  QR_CODE: 'qr-code',
  SYNC_GROUPS: 'sync-groups',
  PROVISION: 'provision',
  TEAM_PROVISIONING: 'team-provisioning',
  DISCORD: 'discord',
  LISTMONK: 'listmonk',
  AUTHENTIK: 'authentik',
  PAYMENT_STATUS: 'payment-status',
  WIRETAP: 'wiretap',
  BADGE_CHECK: 'badge-check',
  INVENTORY_LABELS: 'inventory-labels'
} as const;

// Create queues
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const qrCodeQueue = new Queue(QUEUE_NAMES.QR_CODE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

export const syncGroupsQueue = new Queue(QUEUE_NAMES.SYNC_GROUPS, {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

export const provisionQueue = new Queue(QUEUE_NAMES.PROVISION, {
  connection: redis,
  defaultJobOptions: {
    attempts: 1
  }
});

export const teamProvisioningQueue = new Queue(QUEUE_NAMES.TEAM_PROVISIONING, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

export const discordQueue = new Queue(QUEUE_NAMES.DISCORD, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const listmonkQueue = new Queue(QUEUE_NAMES.LISTMONK, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
});

export const authentikQueue = new Queue(QUEUE_NAMES.AUTHENTIK, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const paymentStatusQueue = new Queue(QUEUE_NAMES.PAYMENT_STATUS, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const wiretapQueue = new Queue(QUEUE_NAMES.WIRETAP, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const badgeCheckQueue = new Queue(QUEUE_NAMES.BADGE_CHECK, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  }
});

// Label PDFs are deterministic, so a retry would just fail the same way.
export const inventoryLabelQueue = new Queue(QUEUE_NAMES.INVENTORY_LABELS, {
  connection: redis,
  defaultJobOptions: {
    attempts: 1
  }
});

// Note: Not using QueueScheduler due to BullMQ version constraints
// Note: BullMQ event handlers may need to be configured differently
// For now, we'll log queue status through other means
logger.info('All queues created and configured');

// Helper function to add jobs to queues
export async function addJobToQueue(
  queueName: keyof typeof QUEUE_NAMES,
  data: any,
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
  }
) {
  const queue = getQueueByName(queueName);
  if (!queue) {
    throw new Error(`Unknown queue: ${queueName}`);
  }

  const job = await queue.add(
    queueName,
    data,
    {
      delay: options?.delay,
      priority: options?.priority,
      attempts: options?.attempts
    }
  );

  logger.info(`Added job ${job.id} to ${queueName} queue`);
  return job;
}

function getQueueByName(queueName: keyof typeof QUEUE_NAMES) {
  switch (queueName) {
    case 'EMAIL':
      return emailQueue;
    case 'QR_CODE':
      return qrCodeQueue;
    case 'SYNC_GROUPS':
      return syncGroupsQueue;
    case 'PROVISION':
      return provisionQueue;
    case 'TEAM_PROVISIONING':
      return teamProvisioningQueue;
    case 'DISCORD':
      return discordQueue;
    case 'LISTMONK':
      return listmonkQueue;
    case 'AUTHENTIK':
      return authentikQueue;
    case 'PAYMENT_STATUS':
      return paymentStatusQueue;
    case 'WIRETAP':
      return wiretapQueue;
    case 'BADGE_CHECK':
      return badgeCheckQueue;
    case 'INVENTORY_LABELS':
      return inventoryLabelQueue;
    default:
      return null;
  }
}

// Graceful shutdown
export async function closeQueues() {
  await emailQueue.close();
  await qrCodeQueue.close();
  await syncGroupsQueue.close();
  await provisionQueue.close();
  await teamProvisioningQueue.close();
  await discordQueue.close();
  await listmonkQueue.close();
  await authentikQueue.close();
  await paymentStatusQueue.close();
  await wiretapQueue.close();
  await badgeCheckQueue.close();
  await inventoryLabelQueue.close();
  await redis.quit();
  logger.info('All queues closed');
}

// Health check
export async function getQueueHealth() {
  try {
    await redis.ping();
    return {
      redis: 'healthy',
      queues: {
        email: await emailQueue.getJobCounts(),
        qrCode: await qrCodeQueue.getJobCounts(),
        syncGroups: await syncGroupsQueue.getJobCounts(),
        provision: await provisionQueue.getJobCounts(),
        teamProvisioning: await teamProvisioningQueue.getJobCounts(),
        discord: await discordQueue.getJobCounts(),
        listmonk: await listmonkQueue.getJobCounts(),
        authentik: await authentikQueue.getJobCounts(),
        paymentStatus: await paymentStatusQueue.getJobCounts(),
        wiretap: await wiretapQueue.getJobCounts(),
        badgeCheck: await badgeCheckQueue.getJobCounts(),
        inventoryLabels: await inventoryLabelQueue.getJobCounts()
      }
    };
  } catch (error) {
    logger.error('Queue health check failed:', error);
    return {
      redis: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
