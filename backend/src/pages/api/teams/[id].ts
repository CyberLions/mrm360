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
import { TeamProvisioningTask } from '../../../types';
import { handleApiError, ApiError } from '@/middleware/errorHandler';
import { getEffectiveSystemRole } from '@/utils/roleUtils';
import { isValidSemester } from '@/utils/semester';

// Validation schemas
const updateTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').optional(),
  description: z.string().optional(),
  type: z.enum(['COMPETITION', 'DEVELOPMENT']).optional(),
  subtype: z.enum(['BLUE', 'RED', 'CTF']).optional(),
  parentTeamId: z.string().optional(),
  groupId: z.string().optional(),
  semester: z.string().refine(isValidSemester).optional(),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(['MEMBER', 'LEADER']).default('MEMBER')
  })).optional(),
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

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get a specific team by ID
 *     tags: [Teams]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Team not found
 *       500:
 *         description: Internal server error
 *   put:
 *     summary: Update a team
 *     tags: [Teams]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *                 description: Array of user IDs to set as team members
 *     responses:
 *       200:
 *         description: Team updated successfully
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
 *       404:
 *         description: Team not found
 *       409:
 *         description: Conflict - team name already exists
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Delete a team
 *     tags: [Teams]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Team not found
 *       409:
 *         description: Conflict - team has members or subteams
 *       500:
 *         description: Internal server error
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid team ID' });
  }

  try {
    if (req.method === 'GET') {
      // Get team by ID
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          group: true,
          parentTeam: true,
          subteams: true,
          events: {
            orderBy: {
              startTime: 'desc'
            }
          },
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

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Check if user can access this team (for regular members)
      const user = (req as any).user;
      const effectiveRole = getEffectiveSystemRole(user.role);
      
      if (effectiveRole === 'MEMBER') {
        // Check if user can see this team based on visibility rules
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

        // Check if user can access this team
        const canAccessTeam = userTeamIds.includes(team.id) || 
          (isInAllowedTeam && allowedTeamNames.includes(team.name.toLowerCase()));
        
        if (!canAccessTeam) {
          return res.status(403).json({ error: 'Access denied to this team' });
        }
      }

      res.status(200).json(team);

    } else if (req.method === 'PUT') {
      // Update team
      const data = updateTeamSchema.parse(req.body);

      // Check if team exists
      const existingTeam = await prisma.team.findUnique({
        where: { id }
      });

      if (!existingTeam) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Check if name is being changed and if it conflicts
      if (data.name && data.name !== existingTeam.name) {
        const nameConflict = await prisma.team.findFirst({
          where: {
            name: data.name,
            id: { not: id }
          }
        });

        if (nameConflict) {
          return res.status(409).json({ 
            error: 'Team with this name already exists' 
          });
        }
      }

      // Update team in database
      const updatedTeam = await prisma.team.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype,
          parentTeamId: data.parentTeamId,
          groupId: data.groupId,
          semester: data.semester
        },
        include: {
          group: true,
          parentTeam: true,
          subteams: true
        }
      });

      // Handle member changes if specified
      if (data.members !== undefined) {
        // Remove all current members
        await prisma.userTeam.deleteMany({
          where: { teamId: id }
        });

        // Add new members
        if (data.members.length > 0) {
          const userTeams = data.members.map(member => ({
            userId: member.userId,
            teamId: id,
            role: member.role
          }));

          await prisma.userTeam.createMany({
            data: userTeams
          });
        }
      }

      // Prepare provisioning update task data
      const taskData = {
        teamId: updatedTeam.id,
        action: 'update' as const,
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype || undefined,
          parentTeamId: data.parentTeamId || undefined,
          groupId: data.groupId || undefined,
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
        // Create background task record immediately for UI visibility
        const backgroundTaskManager = new BackgroundTaskManager(prisma);
        const backgroundTask = await backgroundTaskManager.createTask({
          name: `Team update`,
          description: `Provisioning update for team ${updatedTeam.id}`,
          entityType: 'TEAM',
          entityId: updatedTeam.id,
          subtaskNames: ['Authentik', 'Wiki.js', 'Nextcloud', 'GitHub', 'Discord']
        });

        await addJobToQueue('TEAM_PROVISIONING', { ...taskData, backgroundTaskId: backgroundTask.id });
        logger.info(`Queued team provisioning update task for team: ${updatedTeam.id}`);
      } catch (error) {
        logger.error(`Failed to queue team provisioning update task for team: ${updatedTeam.id}:`, error);
        // Continue with the response even if task queuing fails
      }

      res.status(200).json(updatedTeam);

    } else if (req.method === 'DELETE') {
      // Delete team
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              userTeams: true,
              subteams: true
            }
          }
        }
      });

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Block deletion if team has subteams
      if (team._count.subteams > 0) {
        return res.status(409).json({ 
          error: 'Cannot delete team with subteams' 
        });
      }

      // If team has members, remove their memberships before deletion
      if (team._count.userTeams > 0) {
        await prisma.userTeam.deleteMany({
          where: { teamId: id }
        });
        logger.info(`Removed ${team._count.userTeams} membership(s) from team before deletion: ${id}`);
      }

      // Queue team provisioning delete task
      try {
        const provisioningTask: TeamProvisioningTask = {
          teamId: id,
          action: 'delete',
          data: {
            name: team.name,
            description: team.description || undefined,
            type: team.type,
            subtype: team.subtype || undefined,
            parentTeamId: team.parentTeamId || undefined,
            groupId: team.groupId || undefined
          },
          userId: (req as any).user?.id || 'system'
        };

        // Create a background task for deletion now
        const backgroundTaskManager = new BackgroundTaskManager(prisma);
        const backgroundTask = await backgroundTaskManager.createTask({
          name: `Team delete`,
          description: `Provisioning delete for team ${id}`,
          entityType: 'TEAM',
          entityId: id,
          subtaskNames: ['Authentik', 'Wiki.js', 'Nextcloud', 'GitHub', 'Discord']
        });

        await addJobToQueue('TEAM_PROVISIONING', { ...provisioningTask, backgroundTaskId: backgroundTask.id });
        logger.info(`Queued team deletion provisioning task for team: ${id}`);
      } catch (error) {
        logger.error('Failed to queue team deletion provisioning task:', error);
        // Don't fail the request if provisioning fails
      }

      // Delete team from database
      await prisma.team.delete({
        where: { id }
      });

      res.status(200).json({ message: 'Team deleted successfully' });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error in team API', { errors: error.errors });
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    // Handle custom API errors (like CONFLICT, NOT_FOUND, etc.)
    if (error instanceof Error && (error as ApiError).statusCode) {
      return handleApiError(error, req, res);
    }
    
    logger.error('Error in team API', { error, method: req.method, teamId: id });
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
