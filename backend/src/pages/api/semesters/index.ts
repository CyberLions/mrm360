import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/models/prismaClient';
import { withAuth } from '@/middleware/authMiddleware';
import { withCORS } from '@/middleware/corsMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const [teamRows, eventRows] = await Promise.all([
    prisma.team.findMany({ distinct: ['semester'], select: { semester: true } }),
    prisma.event.findMany({ distinct: ['semester'], select: { semester: true } }),
  ]);

  return res.status(200).json({
    teams: teamRows.map(row => row.semester),
    events: eventRows.map(row => row.semester),
  });
}

export default withCORS(withAuth(handler));
