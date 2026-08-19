import { Job } from 'bullmq';
import { logger } from '@/utils/logger';
import { prisma } from '@/models/prismaClient';
import { PaymentService } from '@/services/paymentService';

export interface PaymentStatusJobData {
  type: 'check-expired' | 'update-user-status';
  userId?: string;
  results?: unknown;
}

export async function processPaymentStatusJob(job: Job<PaymentStatusJobData>) {
  const { type, userId } = job.data;
  
  logger.info('Processing payment status job', { 
    jobId: job.id, 
    type, 
    userId 
  });

  try {
    const paymentService = new PaymentService(prisma);

    switch (type) {
      case 'check-expired':
        await processExpiredPaymentsCheck(paymentService, job);
        break;
      
      case 'update-user-status':
        if (!userId) {
          throw new Error('User ID is required for update-user-status job');
        }
        await processUserStatusUpdate(paymentService, userId, job);
        break;
      
      default:
        throw new Error(`Unknown payment status job type: ${type}`);
    }

    logger.info('Payment status job completed successfully', { 
      jobId: job.id, 
      type 
    });
  } catch (error) {
    logger.error('Payment status job failed', { 
      error, 
      jobId: job.id, 
      type, 
      userId 
    });
    throw error;
  }
}

async function processExpiredPaymentsCheck(
  paymentService: PaymentService, 
  job: Job<PaymentStatusJobData>
) {
  logger.info('Starting expired payments check');
  
  const results = await paymentService.checkExpiredPayments();
  
  // Update job progress
  await job.updateProgress(100);
  
  logger.info('Expired payments check completed', {
    usersProcessed: results.length,
    results: results.map(r => ({
      userId: r.userId,
      email: r.email,
      expiredPayments: r.expiredPayments,
      newPaidStatus: r.newPaidStatus
    }))
  });

  // Store results in job data for reference
  await job.updateData({
    ...job.data,
    results: {
      usersProcessed: results.length,
      details: results
    }
  });
}

async function processUserStatusUpdate(
  paymentService: PaymentService,
  userId: string,
  job: Job<PaymentStatusJobData>
) {
  logger.info('Updating user payment status', { userId });
  
  const paymentStatus = await paymentService.getUserPaymentStatus(userId);
  await paymentService.updateUserPaidStatus(userId);
  
  // Update job progress
  await job.updateProgress(100);
  
  logger.info('User payment status updated', {
    userId,
    isPaid: paymentStatus.isPaid,
    activePayments: paymentStatus.activePayments.length,
    expiredPayments: paymentStatus.expiredPayments.length
  });

  // Store results in job data for reference
  await job.updateData({
    ...job.data,
    results: {
      userId,
      paymentStatus
    }
  });
}

export async function processPaymentStatusJobFailed(job: Job<PaymentStatusJobData>, error: Error) {
  logger.error('Payment status job failed permanently', {
    jobId: job.id,
    type: job.data.type,
    userId: job.data.userId,
    error: error.message,
    stack: error.stack
  });
}
