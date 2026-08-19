import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { prisma } from '@/models/prismaClient';
import { TeamManager } from '../../../managers/teamManager';
import { BackgroundTaskManager } from '../../../managers/backgroundTaskManager';
import { withCORS } from '@/middleware/corsMiddleware';
import { withAuth } from '@/middleware/authMiddleware';
import { withPermissions } from '@/middleware/permissionMiddleware';
import { logger } from '@/utils/logger';
import { addJobToQueue } from '../../../tasks/queue';
import { handleApiError, ApiError } from '@/middleware/errorHandler';
import { getEffectiveSystemRole } from '@/utils/roleUtils';
import { inferSemester, isValidSemester } from '@/utils/semester';

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  description: z.string().optional(),
  type: z.enum(['COMPETITION', 'DEVELOPMENT']),
  subtype: z.enum(['BLUE', 'RED', 'CTF']).optional(),
  parentTeamId: z.string().optional(),
  groupId: z.string().optional(),
  semester: z.string().refine(isValidSemester).optional(),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(['MEMBER', 'LEADER']).default('MEMBER')
  })).default([]),
  // Optional provisioning configuration
  provisioningOptions: z.object({
    wikijs: z.boolean().default(false),
    nextcloudFolder: z.boolean().default(false),
    nextcloudCalendar: z.boolean().default(false),
    nextcloudDeck: z.boolean().default(false),
    github: z.boolean().default(false),
    discord: z.boolean().default(false)
  }).optional()
});

const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').optional(),
  description: z.string().optional(),
  type: z.enum(['COMPETITION', 'DEVELOPMENT']).optional(),
  subtype: z.enum(['BLUE', 'RED', 'CTF']).optional(),
  parentTeamId: z.string().optional(),
  groupId: z.string().optional(),
  semester: z.string().refine(isValidSemester).optional(),
  memberIds: z.array(z.string()).optional()
});

const listTeamsSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '20')),
  search: z.string().optional(),
  query: z.string().optional(),
  type: z.enum(['COMPETITION', 'DEVELOPMENT']).optional(),
  groupId: z.string().optional()
  ,semester: z.string().refine(isValidSemester).optional()
});

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: List teams with filtering and pagination
 *     tags: [Teams]
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
 *         description: Number of teams per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for team name
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [COMPETITION, DEVELOPMENT]
 *         description: Filter by team type
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         description: Filter by group ID
 *     responses:
 *       200:
 *         description: List of teams
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Team'
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
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Team name
 *               description:
 *                 type: string
 *                 description: Team description
 *               type:
 *                 type: string
 *                 enum: [COMPETITION, DEVELOPMENT]
 *                 description: Team type
 *               subtype:
 *                 type: string
 *                 enum: [BLUE, RED, CTF]
 *                 description: Team subtype
 *               parentTeamId:
 *                 type: string
 *                 description: Parent team ID for subteams
 *               groupId:
 *                 type: string
 *                 description: Associated group ID
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add as team members
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       400:
 *         description: Bad request - validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Conflict - team name already exists
 *       500:
 *         description: Internal server error
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // List teams
      const queryParams = listTeamsSchema.parse(req.query);
      
      // Get user info from request (set by auth middleware)
      const user = (req as any).user;
      const effectiveRole = getEffectiveSystemRole(user.role);
      
      const { page = 1, limit = 20, type, groupId, semester } = queryParams;
      const search = queryParams.search || queryParams.query;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }
      if (type) {
        where.type = type;
      }
      if (groupId) {
        where.groupId = groupId;
      }
      if (semester) where.semester = semester;

      let teams;
      let total;

      if (effectiveRole === 'MEMBER') {
        // For regular members, only show teams they belong to or allowed teams
        const userTeams = await prisma.userTeam.findMany({
          where: { userId: user.id },
          include: { team: true },
        });

        const userTeamIds = userTeams.map(ut => ut.teamId);
        const userTeamNames = userTeams.map(ut => ut.team.name.toLowerCase());
        
        // Define allowed team names
        const allowedTeamNames = ['blue team', 'red team', 'ctf team'];
        const isInAllowedTeam = userTeamNames.some(teamName => 
          allowedTeamNames.includes(teamName)
        );

        // Build additional where clause for member filtering
        const memberWhere = {
          ...where,
          OR: [
            { id: { in: userTeamIds } }, // User's teams
            ...(isInAllowedTeam ? [{ name: { in: allowedTeamNames } }] : []) // Allowed teams if user is in one
          ]
        };

        // Get total count for filtered teams
        total = await prisma.team.count({ where: memberWhere });

        // Get teams with pagination
        teams = await prisma.team.findMany({
          where: memberWhere,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            group: true,
            parentTeam: true,
            subteams: true,
            userTeams: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    role: true
                  }
                }
              }
            }
          }
        });
      } else {
        // For admins/exec board, show all teams
        total = await prisma.team.count({ where });

        teams = await prisma.team.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            group: true,
            parentTeam: true,
            subteams: true,
            userTeams: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    role: true
                  }
                }
              }
            }
          }
        });
      }

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        data: teams,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });

    } else if (req.method === 'POST') {
      // Create team
      const data = createTeamSchema.parse(req.body);
      
      // Check if team name already exists
      const existingTeam = await prisma.team.findFirst({
        where: { name: data.name }
      });

      if (existingTeam) {
        return res.status(409).json({ 
          error: 'Team with this name already exists' 
        });
      }

      // Create team in database
      const team = await prisma.team.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype,
          parentTeamId: data.parentTeamId,
          groupId: data.groupId,
          semester: data.semester || inferSemester().semester
        },
        include: {
          group: true,
          parentTeam: true,
          subteams: true
        }
      });

      // Add team members if specified
      if (data.members && data.members.length > 0) {
        const userTeams = data.members.map(member => ({
          userId: member.userId,
          teamId: team.id,
          role: member.role
        }));

        await prisma.userTeam.createMany({
          data: userTeams
        });
      }

      // Prepare task data
      const taskData = {
        teamId: team.id,
        action: 'create' as const,
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype,
          parentTeamId: data.parentTeamId,
          groupId: data.groupId,
          members: data.members,
          provisioningOptions: data.provisioningOptions
        },
        userId: (req as any).user?.id || 'system',
        options: {
          authentik: true, // Always enabled
          nextcloudGroup: true, // Always enabled
          wikijs: data.provisioningOptions?.wikijs || false,
          nextcloudFolder: data.provisioningOptions?.nextcloudFolder || false,
          nextcloudCalendar: data.provisioningOptions?.nextcloudCalendar || false,
          nextcloudDeck: data.provisioningOptions?.nextcloudDeck || false,
          github: data.provisioningOptions?.github || false,
          discord: data.provisioningOptions?.discord || false
        }
      };

      try {
        // Create background task now so it appears immediately in UI
        const backgroundTaskManager = new BackgroundTaskManager(prisma);
        const backgroundTask = await backgroundTaskManager.createTask({
          name: `Team create`,
          description: `Provisioning for team ${team.id}`,
          entityType: 'TEAM',
          entityId: team.id,
          subtaskNames: ['Authentik', 'Wiki.js', 'Nextcloud', 'GitHub', 'Discord']
        });

        await addJobToQueue('TEAM_PROVISIONING', { ...taskData, backgroundTaskId: backgroundTask.id });
        logger.info(`Queued team provisioning task for team: ${team.id}`);
      } catch (error) {
        logger.error('Failed to queue team provisioning task:', error);
        // Don't fail the request if provisioning fails
      }

      res.status(201).json(team);

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error in teams API', { errors: error.errors });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    // Handle custom API errors (like CONFLICT, NOT_FOUND, etc.)
    if (error instanceof Error && (error as ApiError).statusCode) {
      return handleApiError(error, req, res);
    }
    
    logger.error('Error in teams API', { error, method: req.method });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply middleware: CORS, authentication then permissions
export default withCORS(
  withAuth(
    withPermissions(
      handler,
      ['teams:read', 'teams:write']
    )
  )
);
