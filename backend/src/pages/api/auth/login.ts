import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/models/prismaClient';
import { logger } from '@/utils/logger';
import { withCORS } from '@/middleware/corsMiddleware';
import { AuthManager } from '../../../managers/authManager';
import { hasAdminGroups } from '@/utils/roleUtils';

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
  return userRole;
}

// Onboarding is complete once the user has submitted the final interests step,
// which persists a class rank and at least one interest.
async function getOnboardingCompleted(userId: string): Promise<boolean> {
  const [userClassRank, interestCount] = await Promise.all([
    prisma.userClassRank.findUnique({ where: { userId }, select: { id: true } }),
    prisma.userInterest.count({ where: { userId } })
  ]);
  return !!userClassRank && interestCount > 0;
}

export default withCORS(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password, code, state } = req.body;

    // Handle OIDC authentication
    if (code && state) {
      return await handleOIDCLogin(req, res, code, state);
    }

    // Handle username/password authentication
    if (username && password) {
      return await handlePasswordLogin(req, res, username, password);
    }

    return res.status(400).json({ error: 'Invalid authentication method' });
  } catch (error) {
    logger.error('Login error', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleOIDCLogin(req: NextApiRequest, res: NextApiResponse, code: string, state: string) {
  try {
    logger.info('Processing OIDC login', { code: code.substring(0, 8) + '...' });

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);
    
    if (!tokenResponse.access_token) {
      logger.error('Failed to exchange code for tokens', { error: tokenResponse.error });
      return res.status(400).json({ error: 'Token exchange failed' });
    }

    // Get user info from Authentik
    const userInfo = await getUserInfo(tokenResponse.access_token);
    
    if (!userInfo) {
      logger.error('Failed to get user info from Authentik');
      return res.status(400).json({ error: 'Failed to get user info' });
    }

    // Use AuthManager to authenticate user (this will set authentikId)
    const authManager = new AuthManager(prisma);
    const sessionUser = await authManager.authenticateUser({
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      groups: userInfo.groups || []
    });

    // Get the user from database with all relations
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        userGroups: {
          include: { group: true }
        }
      }
    });

    if (!user) {
      logger.error('User not found after authentication', { userId: sessionUser.id });
      return res.status(500).json({ error: 'User authentication failed' });
    }

    // Generate JWT token
    const token = generateJWT(user);
    
    // Get authentik groups
    const authentikGroups = user.userGroups.map(ug => ug.group.name);
    
    // Determine effective role based on OIDC groups
    const effectiveRole = getEffectiveRole(user.role, authentikGroups);
    
    const onboardingCompleted = await getOnboardingCompleted(user.id);

    logger.info('OIDC login successful', { userId: user.id, email: user.email, effectiveRole });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
        role: effectiveRole,
        paidStatus: user.paidStatus,
        isActive: !!user.authentikId, // User is active if they have an authentikId
        createdAt: user.createdAt,
        authentikGroups: authentikGroups,
        onboardingCompleted
      }
    });

  } catch (error) {
    logger.error('OIDC login failed', { error });
    return res.status(500).json({ error: 'OIDC authentication failed' });
  }
}

async function handlePasswordLogin(req: NextApiRequest, res: NextApiResponse, username: string, password: string) {
  try {
    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ]
      },
      include: {
        userGroups: {
          include: { group: true }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user has password (OIDC users might not)
    if (!user.password) {
      return res.status(401).json({ error: 'Account requires OIDC authentication' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateJWT(user);
    
    // Get authentik groups
    const authentikGroups = user.userGroups.map(ug => ug.group.name);
    
    // Determine effective role based on OIDC groups
    const effectiveRole = getEffectiveRole(user.role, authentikGroups);
    
    const onboardingCompleted = await getOnboardingCompleted(user.id);

    logger.info('Password login successful', { userId: user.id, username: user.username, effectiveRole });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
        role: effectiveRole,
        paidStatus: user.paidStatus,
        isActive: !!user.authentikId, // User is active if they have an authentikId
        createdAt: user.createdAt,
        authentikGroups: authentikGroups,
        onboardingCompleted
      }
    });

  } catch (error) {
    logger.error('Password login failed', { error });
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function generateJWT(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '24h' }
  );
}

async function exchangeCodeForTokens(code: string) {
  try {
    const issuer = process.env.AUTHENTIK_ISSUER;
    const clientId = process.env.AUTHENTIK_CLIENT_ID;
    const clientSecret = process.env.AUTHENTIK_CLIENT_SECRET;
    const redirectUri = process.env.AUTHENTIK_REDIRECT_URI;

    if (!issuer || !clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing OIDC configuration');
    }

    const tokenEndpoint = `${issuer}/application/o/token/`;
    
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Token exchange failed', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      return { error: `Token exchange failed: ${response.status} ${response.statusText}` };
    }

    const tokenData = await response.json();
    logger.info('Token exchange successful', { hasAccessToken: !!tokenData.access_token });
    return tokenData;
  } catch (error) {
    logger.error('Token exchange error', { error });
    return { error: `Token exchange error: ${error}` };
  }
}

async function getUserInfo(accessToken: string) {
  try {
    const issuer = process.env.AUTHENTIK_ISSUER;
    
    if (!issuer) {
      throw new Error('Missing issuer configuration');
    }

    const userinfoEndpoint = `${issuer}/application/o/userinfo/`;
    
    const response = await fetch(userinfoEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      logger.error('User info request failed', { 
        status: response.status, 
        statusText: response.statusText 
      });
      return null;
    }

    const userInfo = await response.json();
    logger.info('User info retrieved successfully', { email: userInfo.email });
    return userInfo;
  } catch (error) {
    logger.error('User info error', { error });
    return null;
  }
}

async function syncUserGroups(userId: string, groups: string[]) {
  try {
    // Get existing user groups
    const existingGroups = await prisma.userGroup.findMany({
      where: { userId },
      include: { group: true }
    });

    const existingGroupNames = existingGroups.map(ug => ug.group.name);
    
    // Add new groups
    for (const groupName of groups) {
      if (!existingGroupNames.includes(groupName)) {
        // Find or create group
        let group = await prisma.group.findFirst({
          where: { name: groupName }
        });

        if (!group) {
          group = await prisma.group.create({
            data: {
              name: groupName,
              description: `Group from OIDC: ${groupName}`,
              externalId: groupName
            }
          });
        }

        // Add user to group
        await prisma.userGroup.create({
          data: {
            userId,
            groupId: group.id
          }
        });
      }
    }

    // Remove groups that are no longer in OIDC
    for (const existingGroup of existingGroups) {
      if (!groups.includes(existingGroup.group.name)) {
        await prisma.userGroup.delete({
          where: { id: existingGroup.id }
        });
      }
    }

    logger.info('User groups synced successfully', { userId, groupCount: groups.length });
  } catch (error) {
    logger.error('Failed to sync user groups', { error, userId });
  }
}
