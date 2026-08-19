import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { TaskManager } from '../../../managers/taskManager';
import { withAuth } from '@/middleware/authMiddleware';
import { withPermissions } from '@/middleware/permissionMiddleware';
import { logger } from '@/utils/logger';
import { withCORS } from '@/middleware/corsMiddleware';

// Validation schemas
const enqueueEmailJobSchema = z.object({
  type: z.literal('email'),
  data: z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
    template: z.string().optional(),
    variables: z.record(z.any()).optional(),
  }),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueueQRCodeJobSchema = z.object({
  type: z.literal('qr-code'),
  data: z.object({
    userId: z.string(),
    userEmail: z.string().email(),
    userName: z.string(),
  }),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueueSyncGroupsJobSchema = z.object({
  type: z.literal('sync-groups'),
  data: z.object({
    userId: z.string(),
    force: z.boolean().optional(),
  }),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueueProvisionTeamSchema = z.object({
  type: z.literal('provision-team'),
  data: z.object({
    name: z.string(),
    entityId: z.string().optional(),
    subtaskNames: z.array(z.string())
  }),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueueProvisionEventSchema = z.object({
  type: z.literal('provision-event'),
  data: z.object({
    name: z.string(),
    entityId: z.string().optional(),
    subtaskNames: z.array(z.string())
  }),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueuePaymentStatusSchema = z.object({
  type: z.literal('payment-status'),
  data: z.object({
    userId: z.string().optional(),
  }).default({}),
  options: z.object({
    delay: z.number().min(0).optional(),
    priority: z.number().min(0).max(10).optional(),
    attempts: z.number().min(1).max(10).optional(),
  }).optional(),
});

const enqueueJobSchema = z.union([
  enqueueEmailJobSchema,
  enqueueQRCodeJobSchema,
  enqueueSyncGroupsJobSchema,
  enqueueProvisionTeamSchema,
  enqueueProvisionEventSchema,
  enqueuePaymentStatusSchema,
]);

/**
 * @swagger
 * /api/tasks/enqueue:
 *   post:
 *     summary: Enqueue a background job
 *     tags: [Tasks]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 required:
 *                   - type
 *                   - data
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [email]
 *                   data:
 *                     type: object
 *                     required:
 *                       - to
 *                       - subject
 *                       - body
 *                     properties:
 *                       to:
 *                         type: string
 *                         format: email
 *                       subject:
 *                         type: string
 *                         maxLength: 200
 *                       body:
 *                         type: string
 *                       template:
 *                         type: string
 *                       variables:
 *                         type: object
 *                   options:
 *                     type: object
 *                     properties:
 *                       delay:
 *                         type: number
 *                         minimum: 0
 *                       priority:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 10
 *                       attempts:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 10
 *               - type: object
 *                 required:
 *                   - type
 *                   - data
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [qr-code]
 *                   data:
 *                     type: object
 *                     required:
 *                       - userId
 *                       - userEmail
 *                       - userName
 *                     properties:
 *                       userId:
 *                         type: string
 *                       userEmail:
 *                         type: string
 *                         format: email
 *                       userName:
 *                         type: string
 *                   options:
 *                     type: object
 *                     properties:
 *                       delay:
 *                         type: number
 *                         minimum: 0
 *                       priority:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 10
 *                       attempts:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 10
 *               - type: object
 *                 required:
 *                   - type
 *                   - data
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [sync-groups]
 *                   data:
 *                     type: object
 *                     required:
 *                       - userId
 *                     properties:
 *                       userId:
 *                         type: string
 *                       force:
 *                         type: boolean
 *                   options:
 *                     type: object
 *                     properties:
 *                       delay:
 *                         type: number
 *                         minimum: 0
 *                       priority:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 10
 *                       attempts:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 10
 *     responses:
 *       200:
 *         description: Job enqueued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const taskManager = new TaskManager();
    const body = enqueueJobSchema.parse(req.body);

    let jobId: string;
    let message: string;

    switch (body.type) {
      case 'email':
        jobId = await taskManager.enqueueEmailJob(body.data, body.options);
        message = 'Email job enqueued successfully';
        break;

      case 'qr-code':
        jobId = await taskManager.enqueueQRCodeJob(body.data, body.options);
        message = 'QR code generation job enqueued successfully';
        break;

      case 'sync-groups':
        jobId = await taskManager.enqueueSyncGroupsJob(body.data, body.options);
        message = 'Sync groups job enqueued successfully';
        break;

      case 'payment-status':
        jobId = await taskManager.enqueuePaymentStatusJob({
          type: body.data.userId ? 'update-user-status' : 'check-expired',
          userId: body.data.userId,
        }, body.options);
        message = 'Payment status re-evaluation enqueued successfully';
        break;

      case 'provision-team': {
        const result = await taskManager.enqueueProvisionTask({
          provisionType: 'TEAM',
          name: body.data.name,
          description: 'Simulated provisioning',
          entityType: 'TEAM',
          entityId: body.data.entityId,
          subtaskNames: body.data.subtaskNames,
          payload: { entityId: body.data.entityId }
        });
        jobId = result.jobId;
        res.status(200).json({ success: true, jobId, backgroundTaskId: result.backgroundTaskId, message: 'Provision team task enqueued' });
        return;
      }

      case 'provision-event': {
        const result = await taskManager.enqueueProvisionTask({
          provisionType: 'EVENT',
          name: body.data.name,
          description: 'Simulated provisioning',
          entityType: 'EVENT',
          entityId: body.data.entityId,
          subtaskNames: body.data.subtaskNames,
          payload: { entityId: body.data.entityId }
        });
        jobId = result.jobId;
        res.status(200).json({ success: true, jobId, backgroundTaskId: result.backgroundTaskId, message: 'Provision event task enqueued' });
        return;
      }

      default:
        return res.status(400).json({ error: 'Invalid job type' });
    }

    logger.info('Background job enqueued', { 
      type: (body as any).type, 
      jobId
    });

    res.status(200).json({
      success: true,
      jobId,
      message,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error in tasks enqueue API', { errors: error.errors });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    logger.error('Error in tasks enqueue API', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply middleware: authentication and permissions
export default withCORS(
  withAuth(
    withPermissions(
      handler,
      ['tasks:enqueue']
    )
  )
);
