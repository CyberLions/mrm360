import { NextApiResponse } from 'next';
import { prisma } from '@/models/prismaClient';
import { withCORS } from '@/middleware/corsMiddleware';
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware';
import { logger } from '@/utils/logger';

/**
 * @swagger
 * /api/events/rsvp/{code}:
 *   get:
 *     summary: Resolve an event by its public RSVP code
 *     description: >
 *       Returns the minimum event detail needed to render the public RSVP page:
 *       the event, whether it is full, whether an RSVP would be waitlisted, and
 *       the requesting user's own RSVP status. Deliberately does not return the
 *       attendee roster - this code is printed on flyers and shown on screens.
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Event RSVP code
 *     responses:
 *       200:
 *         description: Event found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rsvpCode = req.query.code as string;

  if (!rsvpCode) {
    return res.status(400).json({ error: 'RSVP code is required' });
  }

  try {
    const userId = req.user.id;

    // One round trip: the event, a filtered count for capacity, and just this
    // user's own RSVP row. Capacity is surfaced as a count and two derived
    // flags, never as a roster.
    const event = await prisma.event.findUnique({
      where: { rsvpCode },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        category: true,
        attendanceCap: true,
        waitlistEnabled: true,
        linkedTeam: { select: { id: true, name: true } },
        _count: { select: { rsvps: { where: { status: 'CONFIRMED' } } } },
        rsvps: { where: { userId }, select: { status: true }, take: 1 },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Destructure the relation fields out so they cannot reach the response.
    const { _count, rsvps, ...eventFields } = event;
    const confirmedCount = _count.rsvps;
    const isFull = !!eventFields.attendanceCap && confirmedCount >= eventFields.attendanceCap;

    logger.info('Event retrieved by RSVP code', {
      eventId: eventFields.id,
      rsvpCode,
      title: eventFields.title,
    });

    return res.status(200).json({
      data: {
        ...eventFields,
        confirmedCount,
        isFull,
        willWaitlist: isFull && eventFields.waitlistEnabled,
        myRsvpStatus: rsvps[0]?.status ?? null,
      },
    });
  } catch (error) {
    logger.error('Error in get event by RSVP code API', { error, rsvpCode });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply middleware: CORS then authentication. The RSVP page is behind login, so
// the token is always present by the time this is called.
export default withCORS(withAuth(handler));
