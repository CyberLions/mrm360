import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/models/prismaClient';
import { EventManager } from '../../../managers/eventManager';
import { withCORS } from '@/middleware/corsMiddleware';
import { withAuth } from '@/middleware/authMiddleware';
import { withPermissions } from '@/middleware/permissionMiddleware';
import { logger } from '@/utils/logger';
import { getEffectiveSystemRole } from '@/utils/roleUtils';
import { isValidSemester } from '@/utils/semester';

// Validation schemas
const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startTime: z.string().transform(val => new Date(val)).optional(),
  endTime: z.string().transform(val => new Date(val)).optional(),
  category: z.enum(['MEETING', 'COMPETITION', 'WORKSHOP', 'SOCIAL', 'TRAINING']).optional(),
  linkedTeamId: z.string().optional(),
  wiretapWorkshopId: z.string().optional(),
  seriesId: z.string().optional(),
  attendanceType: z.enum(['STRICT', 'SOFT']).optional(),
  attendanceCap: z.number().int().positive().optional(),
  waitlistEnabled: z.boolean().optional(),
  teamsEnabled: z.boolean().optional(),
  membersPerTeam: z.number().int().positive().max(20).optional(),
  autoAssignEnabled: z.boolean().optional(),
  allowTeamSwitching: z.boolean().optional(),
  semester: z.string().refine(isValidSemester).optional(),
});

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get a single event by ID
 *     tags: [Events]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update an event
 *     tags: [Events]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *                 enum: [MEETING, COMPETITION, WORKSHOP, SOCIAL, TRAINING]
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
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       400:
 *         description: Bad request - validation error
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Internal server error
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const eventManager = new EventManager(prisma);
  const eventId = req.query.id as string;

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  try {
    if (req.method === 'GET') {
      // Get single event
      const event = await eventManager.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check if user can access this event (for regular members)
      const user = (req as any).user;
      const effectiveRole = getEffectiveSystemRole(user.role);
      
      if (effectiveRole === 'MEMBER') {
        // Check if user can see this event based on visibility rules
        const userEvents = await eventManager.getEventsForUser(user.id);
        const canAccessEvent = userEvents.some(e => e.id === eventId);
        
        if (!canAccessEvent) {
          return res.status(403).json({ error: 'Access denied to this event' });
        }
      }

      res.status(200).json({ success: true, data: event });
    } else if (req.method === 'PUT') {
      // Update event
      const body = updateEventSchema.parse(req.body);
      
      const event = await eventManager.updateEvent(eventId, body);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.status(200).json({ success: true, data: event });
    } else if (req.method === 'DELETE') {
      // Delete event
      try {
        await eventManager.deleteEvent(eventId);
        res.status(200).json({ success: true, message: 'Event deleted successfully' });
      } catch (error) {
        // If the event doesn't exist, Prisma will throw an error
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Event not found' });
        }
        throw error;
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error in event API', { errors: error.errors });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    logger.error('Error in event API', { error, method: req.method, eventId });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply middleware: CORS, authentication then permissions
export default withCORS(
  withAuth(
    withPermissions(
      handler,
      (req: NextApiRequest) => {
        // GET requests need read permission, PUT/DELETE requests need update/delete permission
        if (req.method === 'GET') {
          return ['events:read'];
        } else if (req.method === 'PUT') {
          return ['events:update'];
        } else if (req.method === 'DELETE') {
          return ['events:delete'];
        }
        return [];
      }
    )
  )
);
