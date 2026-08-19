import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/models/prismaClient';
import { EventManager } from '../../../managers/eventManager';
import { TaskManager } from '@/managers/taskManager';
import { BackgroundTaskManager } from '@/managers/backgroundTaskManager';
import { withCORS } from '@/middleware/corsMiddleware';
import { withAuth } from '@/middleware/authMiddleware';
import { withPermissions } from '@/middleware/permissionMiddleware';
import { logger } from '@/utils/logger';
import { getEffectiveSystemRole } from '@/utils/roleUtils';
import { isValidSemester } from '@/utils/semester';

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  startTime: z.string().transform(val => new Date(val)),
  endTime: z.string().transform(val => new Date(val)),
  category: z.enum(['MEETING', 'COMPETITION', 'WORKSHOP', 'SOCIAL', 'TRAINING']),
  linkedTeamId: z.string().optional(),
  wiretapWorkshopId: z.string().optional(),
  seriesId: z.string().optional(),
  attendanceType: z.enum(['STRICT', 'SOFT']),
  attendanceCap: z.number().int().positive().optional(),
  waitlistEnabled: z.boolean().optional(),
  semester: z.string().refine(isValidSemester).optional(),
});

const listEventsSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '20')),
  search: z.string().optional(),
  query: z.string().optional(), // Alias for search
  category: z.enum(['MEETING', 'COMPETITION', 'WORKSHOP', 'SOCIAL', 'TRAINING']).optional(),
  linkedTeamId: z.string().optional(),
  seriesId: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  sortBy: z.string().optional().default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  semester: z.string().refine(isValidSemester).optional(),
});

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: List events with filtering and pagination
 *     tags: [Events]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of events per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for event title
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [MEETING, COMPETITION, WORKSHOP, SOCIAL, OTHER]
 *         description: Filter by event category
 *       - in: query
 *         name: linkedTeamId
 *         schema:
 *           type: string
 *         description: Filter by linked team
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events starting before this date
 *     responses:
 *       200:
 *         description: List of events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - startTime
 *               - endTime
 *               - category
 *               - attendanceType
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *               description:
 *                 type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               category:
 *                 type: string
 *                 enum: [MEETING, COMPETITION, WORKSHOP, SOCIAL, OTHER]
 *               linkedTeamId:
 *                 type: string
 *               attendanceType:
 *                 type: string
 *                 enum: [STRICT, SOFT]
 *               attendanceCap:
 *                 type: integer
 *                 minimum: 1
 *                 description: Maximum number of attendees (optional)
 *               waitlistEnabled:
 *                 type: boolean
 *                 description: Whether to enable waitlist when cap is reached
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
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
  const eventManager = new EventManager(prisma);
  const taskManager = new TaskManager();

  try {
    if (req.method === 'GET') {
      // List events
      const queryParams = listEventsSchema.parse(req.query);
      
      // Get user info from request (set by auth middleware)
      const user = (req as any).user;
      const effectiveRole = getEffectiveSystemRole(user.role);
      
      // Support both 'search' and 'query' parameters
      const searchTerm = queryParams.search || queryParams.query;
      
      let result;
      
      // Use filtered method for regular members, full access for admins/exec board
      if (effectiveRole === 'MEMBER') {
        result = await eventManager.getEventsForUser(user.id, {
          category: queryParams.category as any,
          linkedTeamId: queryParams.linkedTeamId,
          seriesId: queryParams.seriesId,
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
          search: searchTerm,
          sortBy: queryParams.sortBy,
          sortOrder: queryParams.sortOrder,
          semester: queryParams.semester,
        });
      } else {
        result = await eventManager.getAllEvents({
          category: queryParams.category as any,
          linkedTeamId: queryParams.linkedTeamId,
          seriesId: queryParams.seriesId,
          startDate: queryParams.startDate,
          endDate: queryParams.endDate,
          search: searchTerm,
          sortBy: queryParams.sortBy,
          sortOrder: queryParams.sortOrder,
          semester: queryParams.semester,
        });
      }

      // Simple pagination (in production, implement proper pagination)
      const page = queryParams.page;
      const limit = queryParams.limit;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const paginatedEvents = result.slice(startIndex, endIndex);
      const total = result.length;
      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: paginatedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      });
    } else if (req.method === 'POST') {
      // Create event
      const body = createEventSchema.parse(req.body);
      
      const event = await eventManager.createEvent(body);
      
      // Enqueue event setup task (simplified - no placeholder subtasks)
      await taskManager.enqueueProvisionTask({
        provisionType: 'EVENT',
        name: `Provision resources for event ${event.title}`,
        description: 'Event resource setup',
        entityType: 'EVENT',
        entityId: event.id,
        subtaskNames: [], // No subtasks needed for event creation
        payload: { 
          eventId: event.id,
          wiretapWorkshopId: body.wiretapWorkshopId 
        }
      });

      res.status(201).json({ success: true, data: event });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error in events API', { errors: error.errors });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    logger.error('Error in events API', { error, method: req.method });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply middleware: CORS, authentication then permissions
export default withCORS(
  withAuth(
    withPermissions(
      handler,
      (req: NextApiRequest) => {
        // GET requests only need read permission, POST requests need create permission
        if (req.method === 'GET') {
          return ['events:read'];
        } else if (req.method === 'POST') {
          return ['events:create'];
        }
        return [];
      }
    )
  )
);
