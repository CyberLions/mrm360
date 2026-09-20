import { Worker } from 'bullmq';
import { logger } from '@/utils/logger';
import { 
  emailQueue, 
  qrCodeQueue, 
  syncGroupsQueue,
  teamProvisioningQueue,
  discordQueue,
  listmonkQueue,
  authentikQueue,
  paymentStatusQueue,
  QUEUE_NAMES 
} from './queue';
import { processProvisionJob, processProvisionJobFailed } from './workers/provisionWorker';
import { processEmailJob, processEmailJobFailed } from './workers/emailWorker';
import { processQRCodeJob, processQRCodeJobFailed } from './workers/qrCodeWorker';
import { processSyncGroupsJob, processSyncGroupsJobFailed } from './workers/syncGroupsWorker';
import { processTeamProvisioningJob, processTeamProvisioningJobFailed } from './workers/teamProvisioningProcessor';
import { processDiscordJob, processDiscordJobFailed, initializeDiscordBotWorker, shutdownDiscordBot } from './workers/discordBotWorker';
import { processListMonkJob, processListMonkJobFailed } from './workers/listmonkWorker';
import { processAuthentikJob, processAuthentikJobFailed } from './workers/authentikWorker';
import { processPaymentStatusJob, processPaymentStatusJobFailed } from './workers/paymentStatusWorker';
import { processWiretapJob, processWiretapJobFailed } from './workers/wiretapWorker';
import { processBadgeCheckJob, processBadgeCheckJobFailed } from './workers/badgeCheckWorker';
import { processInventoryLabelJob, processInventoryLabelJobFailed } from './workers/inventoryLabelWorker';

// Import Redis connection from queue file
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

// Discord role discovery function
async function discoverDiscordRoles() {
  try {
    logger.info('🔍 Starting Discord role discovery...');
    
    // Import the discovery function
    const { discoverAndSaveDiscordRoles } = await import('../../scripts/populate-discord-config');
    await discoverAndSaveDiscordRoles();
    
    logger.info('✅ Discord role discovery completed');
  } catch (error) {
    logger.error('❌ Discord role discovery failed:', error);
    // Don't fail the worker startup if role discovery fails
  }
}

// Create workers
const emailWorker = new Worker(QUEUE_NAMES.EMAIL, processEmailJob, {
  connection: redis,
  concurrency: 5, // Process up to 5 email jobs concurrently
  removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
  removeOnFail: { count: 50 } // Keep last 50 failed jobs
});

const qrCodeWorker = new Worker(QUEUE_NAMES.QR_CODE, processQRCodeJob, {
  connection: redis,
  concurrency: 3, // Process up to 3 QR code jobs concurrently
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const syncGroupsWorker = new Worker(QUEUE_NAMES.SYNC_GROUPS, processSyncGroupsJob, {
  connection: redis,
  concurrency: 1, // Only one sync groups job at a time
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 25 }
});

const provisionWorker = new Worker(QUEUE_NAMES.PROVISION, processProvisionJob, {
  connection: redis,
  concurrency: 2,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const teamProvisioningWorker = new Worker(QUEUE_NAMES.TEAM_PROVISIONING, processTeamProvisioningJob, {
  connection: redis,
  concurrency: 1, // Process one job at a time to avoid conflicts
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const discordWorker = new Worker(QUEUE_NAMES.DISCORD, processDiscordJob, {
  connection: redis,
  concurrency: 1, // Process one Discord job at a time to avoid conflicts
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const listmonkWorker = new Worker(QUEUE_NAMES.LISTMONK, processListMonkJob, {
  connection: redis,
  concurrency: 2, // Process up to 2 ListMonk jobs concurrently
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const authentikWorker = new Worker(QUEUE_NAMES.AUTHENTIK, processAuthentikJob, {
  connection: redis,
  concurrency: 1, // Process one Authentik job at a time to avoid conflicts
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const paymentStatusWorker = new Worker(QUEUE_NAMES.PAYMENT_STATUS, processPaymentStatusJob, {
  connection: redis,
  concurrency: 2, // Process up to 2 payment status jobs concurrently
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const wiretapWorker = new Worker(QUEUE_NAMES.WIRETAP, processWiretapJob, {
  connection: redis,
  concurrency: 1,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const badgeCheckWorker = new Worker(QUEUE_NAMES.BADGE_CHECK, processBadgeCheckJob, {
  connection: redis,
  concurrency: 3,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

const inventoryLabelWorker = new Worker(QUEUE_NAMES.INVENTORY_LABELS, processInventoryLabelJob, {
  connection: redis,
  concurrency: 2, // Rendering is CPU-bound; keep it from starving the other queues
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
});

// Worker event handlers
emailWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Email worker completed job ${job.id}`);
  }
});

emailWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Email worker failed job ${job.id}:`, err);
    processEmailJobFailed(job, err);
  }
});

qrCodeWorker.on('completed', (job) => {
  if (job) {
    logger.info(`QR Code worker completed job ${job.id}`);
  }
});

qrCodeWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`QR Code worker failed job ${job.id}:`, err);
    processQRCodeJobFailed(job, err);
  }
});

syncGroupsWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Sync Groups worker completed job ${job.id}`);
  }
});

syncGroupsWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Sync Groups worker failed job ${job.id}:`, err);
    processSyncGroupsJobFailed(job, err);
  }
});

provisionWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Provision worker completed job ${job.id}`);
  }
});

provisionWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Provision worker failed job ${job.id}:`, err);
    processProvisionJobFailed(job, err);
  }
});

teamProvisioningWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Team Provisioning worker completed job ${job.id}`);
  }
});

teamProvisioningWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Team Provisioning worker failed job ${job.id}:`, err);
    processTeamProvisioningJobFailed(job, err);
  }
});

discordWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Discord worker completed job ${job.id}`);
  }
});

discordWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Discord worker failed job ${job.id}:`, err);
    processDiscordJobFailed(job, err);
  }
});

listmonkWorker.on('completed', (job) => {
  if (job) {
    logger.info(`ListMonk worker completed job ${job.id}`);
  }
});

listmonkWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`ListMonk worker failed job ${job.id}:`, err);
    processListMonkJobFailed(job, err);
  }
});

authentikWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Authentik worker completed job ${job.id}`);
  }
});

authentikWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Authentik worker failed job ${job.id}:`, err);
    processAuthentikJobFailed(job, err);
  }
});

paymentStatusWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Payment status worker completed job ${job.id}`);
  }
});

paymentStatusWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Payment status worker failed job ${job.id}:`, err);
    processPaymentStatusJobFailed(job, err);
  }
});

wiretapWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Wiretap worker completed job ${job.id}`);
  }
});

wiretapWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Wiretap worker failed job ${job.id}:`, err);
    processWiretapJobFailed(job, err);
  }
});

badgeCheckWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Badge check worker completed job ${job.id}`);
  }
});

badgeCheckWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Badge check worker failed job ${job.id}:`, err);
    processBadgeCheckJobFailed(job, err);
  }
});

inventoryLabelWorker.on('completed', (job) => {
  if (job) {
    logger.info(`Inventory label worker completed job ${job.id}`);
  }
});

inventoryLabelWorker.on('failed', (job, err) => {
  if (job) {
    logger.error(`Inventory label worker failed job ${job.id}:`, err);
    processInventoryLabelJobFailed(job, err);
  }
});

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Shutting down workers gracefully...');
  
  await emailWorker.close();
  await qrCodeWorker.close();
  await syncGroupsWorker.close();
  await provisionWorker.close();
  await teamProvisioningWorker.close();
  await discordWorker.close();
  await listmonkWorker.close();
  await authentikWorker.close();
  await paymentStatusWorker.close();
  await wiretapWorker.close();
  await badgeCheckWorker.close();
  await inventoryLabelWorker.close();

  // Shutdown Discord bot
  await shutdownDiscordBot();
  
  logger.info('All workers closed');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Initialize Discord bot worker and discover roles
async function initializeWorkers() {
  try {
    // Initialize Discord bot worker
    await initializeDiscordBotWorker();
    
    // Discover Discord roles
    await discoverDiscordRoles();
    
    logger.info('MRM360 Task Workers started');
    logger.info(`Email worker: ${QUEUE_NAMES.EMAIL}`);
    logger.info(`QR Code worker: ${QUEUE_NAMES.QR_CODE}`);
    logger.info(`Sync Groups worker: ${QUEUE_NAMES.SYNC_GROUPS}`);
    logger.info(`Provision worker: ${QUEUE_NAMES.PROVISION}`);
    logger.info(`Team Provisioning worker: ${QUEUE_NAMES.TEAM_PROVISIONING}`);
    logger.info(`Discord worker: ${QUEUE_NAMES.DISCORD}`);
    logger.info(`ListMonk worker: ${QUEUE_NAMES.LISTMONK}`);
    logger.info(`Authentik worker: ${QUEUE_NAMES.AUTHENTIK}`);
    logger.info(`Payment Status worker: ${QUEUE_NAMES.PAYMENT_STATUS}`);
    logger.info(`Wiretap worker: ${QUEUE_NAMES.WIRETAP}`);
    logger.info(`Badge Check worker: ${QUEUE_NAMES.BADGE_CHECK}`);
    logger.info(`Inventory Label worker: ${QUEUE_NAMES.INVENTORY_LABELS}`);
  } catch (error) {
    logger.error('Failed to initialize workers:', error);
    process.exit(1);
  }
}

// Start initialization
initializeWorkers();
