import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/utils/logger';
import { getEffectiveSystemRole, hasAdminGroups } from '@/utils/roleUtils';

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    groups: string[];
  };
}

// Helper function to determine effective role based on OIDC groups
function getEffectiveRole(userRole: string, authentikGroups: string[]): string {
  // If user has admin groups, elevate to admin regardless of base role
  if (hasAdminGroups(authentikGroups)) {
    logger.info('User has admin groups, elevating to admin role', {
      originalRole: userRole,
      authentikGroups
    });
    return 'ADMIN';
  }
  
  // Get the effective system role, ensuring it's not a class rank role
  return getEffectiveSystemRole(userRole);
}

export function withAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    let authenticatedRequest: AuthenticatedRequest;
    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header' 
        });
      }

      // Extract the token
      const token = authHeader.substring(7);
      
      // Verify the JWT token
      const decoded = verifyJWT(token);
      
      if (!decoded || !decoded.id) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid token' 
        });
      }

      // Get user from database
      const user = await getUserById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'User not found' 
        });
      }

      // Determine effective role based on OIDC groups and system role
      const effectiveRole = getEffectiveRole(user.role, user.authentikGroups || []);

      // Add user info to request
      authenticatedRequest = req as AuthenticatedRequest;
      authenticatedRequest.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: effectiveRole,
        groups: user.authentikGroups || []
      };

      logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email,
        originalRole: user.role,
        effectiveRole,
        authentikGroups: user.authentikGroups
      });

    } catch (error) {
      logger.error('Authentication error:', error);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication failed' 
      });
    }

    // Handler errors are application errors, not authentication failures. Keeping
    // this outside the auth try/catch prevents a server error from causing an
    // OAuth logout/login loop in the client.
    await handler(authenticatedRequest!, res);
  };
}

// Helper function to verify JWT token
function verifyJWT(token: string): any {
  try {
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    return jwt.verify(token, secret);
  } catch (error) {
    logger.error('JWT verification failed:', error);
    return null;
  }
}

// Helper function to get user by ID
async function getUserById(userId: string): Promise<any> {
  try {
    const { prisma } = require('@/models/prismaClient');
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        authentikId: true
      }
    });

    if (!user) {
      return null;
    }

    // For now, we'll assume authentikGroups is empty
    // This would need to be populated from the OIDC provider
    user.authentikGroups = [];

    return user;
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    return null;
  }
}
