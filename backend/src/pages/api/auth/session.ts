import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from '@/models/prismaClient';
import { logger } from '@/utils/logger';
import { withCORS } from '@/middleware/corsMiddleware';
import { defineAbilitiesFor } from '@/permissions/abilities';

export default withCORS(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get JWT token from Authorization header
    const authHeader = req.headers.authorization;
    logger.info('Session request headers', { 
      authorization: authHeader ? 'present' : 'missing',
      method: req.method,
      url: req.url
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('No valid authorization header', { authHeader });
      return res.status(401).json({ error: 'No valid token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    logger.info('Token extracted from header', { tokenLength: token.length });

    // Verify JWT token
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    } catch (error) {
      logger.warn('Invalid JWT token', { error });
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        paidStatus: true,
        authentikId: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Determine whether the user has finished onboarding. Onboarding is
    // considered complete once the final step (the interests form) has been
    // submitted, which persists a class rank and at least one interest.
    const [userClassRank, interestCount] = await Promise.all([
      prisma.userClassRank.findUnique({
        where: { userId: user.id },
        select: { id: true }
      }),
      prisma.userInterest.count({ where: { userId: user.id } })
    ]);
    const onboardingCompleted = !!userClassRank && interestCount > 0;

    // Get user groups for permissions
    const userGroups = await prisma.userGroup.findMany({
      where: { userId: user.id },
      include: {
        group: {
          select: {
            name: true,
            description: true
          }
        }
      }
    });

    // Create user object for abilities calculation
    const userForAbilities = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      groups: userGroups.map((ug: any) => ug.group.name)
    };

    // Generate abilities based on user role and groups
    const ability = defineAbilitiesFor(userForAbilities);
    const abilities = ability.rules.map((rule: any) => ({
      action: rule.action,
      subject: rule.subject,
      conditions: rule.conditions
    }));

    logger.info('Session validated', { userId: user.id });

    // Return user session data
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        paidStatus: user.paidStatus,
        isActive: !!user.authentikId, // User is active if they have an authentikId
        createdAt: user.createdAt,
        authentikGroups: userGroups.map((ug: any) => ug.group.name),
        abilities: abilities,
        onboardingCompleted
      }
    });

  } catch (error) {
    logger.error('Session validation error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});
