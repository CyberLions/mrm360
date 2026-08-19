import { prisma } from '@/models/prismaClient';
import { 
  TeamProfile, 
  CreateTeamRequest, 
  UpdateTeamRequest, 
  TeamQueryParams,
  PaginatedResponse 
} from '@/types';
import { logger } from '@/utils/logger';
import { Errors } from '@/middleware/errorHandler';
import { inferSemester } from '@/utils/semester';

export class TeamManager {
  async createTeam(data: CreateTeamRequest): Promise<TeamProfile> {
    try {
      // Check if team already exists with same name in the same group
      if (data.groupId) {
        const existingTeam = await prisma.team.findFirst({
          where: {
            name: data.name,
            groupId: data.groupId
          }
        });

        if (existingTeam) {
          throw Errors.CONFLICT('Team with this name already exists in this group');
        }
      }

      // Validate parent team if specified
      if (data.parentTeamId) {
        const parentTeam = await prisma.team.findUnique({
          where: { id: data.parentTeamId }
        });

        if (!parentTeam) {
          throw Errors.NOT_FOUND('Parent team');
        }
      }

      const team = await prisma.team.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype,
          parentTeamId: data.parentTeamId,
          groupId: data.groupId
          ,semester: data.semester || inferSemester().semester
        }
      });

      logger.info(`Created team: ${team.name}`);
      return {
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        type: team.type,
        subtype: team.subtype || undefined,
        parentTeamId: team.parentTeamId || undefined,
        groupId: team.groupId || undefined,
        semester: team.semester,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      };
    } catch (error) {
      logger.error('Error creating team:', error);
      throw error;
    }
  }

  async getTeamById(id: string): Promise<TeamProfile> {
    try {
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
        throw Errors.NOT_FOUND('Team');
      }

      return {
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        type: team.type,
        subtype: team.subtype || undefined,
        parentTeamId: team.parentTeamId || undefined,
        groupId: team.groupId || undefined,
        semester: team.semester,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      };
    } catch (error) {
      logger.error(`Error getting team ${id}:`, error);
      throw error;
    }
  }

  async getTeams(params: TeamQueryParams): Promise<PaginatedResponse<TeamProfile>> {
    try {
      const { page = 1, limit = 20, search, type, groupId, semester } = params;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (type) {
        where.type = type;
      }

      if (groupId) {
        where.groupId = groupId;
      }
      if (semester) where.semester = semester;

      // Get total count
      const total = await prisma.team.count({ where });

      // Get teams
      const teams = await prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { name: 'asc' }
        ],
        include: {
          group: true,
          parentTeam: true,
          _count: {
            select: {
              userTeams: true,
              subteams: true
            }
          }
        }
      });

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: teams.map(team => ({
          id: team.id,
          name: team.name,
          description: team.description || undefined,
          type: team.type,
          subtype: team.subtype || undefined,
          parentTeamId: team.parentTeamId || undefined,
          groupId: team.groupId || undefined,
          semester: team.semester,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      logger.error('Error getting teams:', error);
      throw error;
    }
  }

  async updateTeam(id: string, data: UpdateTeamRequest): Promise<TeamProfile> {
    try {
      // Check if name is being changed and if it conflicts
      if (data.name) {
        const existingTeam = await prisma.team.findFirst({
          where: {
            name: data.name,
            groupId: data.groupId,
            id: { not: id }
          }
        });

        if (existingTeam) {
          throw Errors.CONFLICT('Team with this name already exists in this group');
        }
      }

      // Validate parent team if specified
      if (data.parentTeamId) {
        const parentTeam = await prisma.team.findUnique({
          where: { id: data.parentTeamId }
        });

        if (!parentTeam) {
          throw Errors.NOT_FOUND('Parent team');
        }

        // Prevent circular references
        if (data.parentTeamId === id) {
          throw Errors.BAD_REQUEST('Team cannot be its own parent');
        }
      }

      const team = await prisma.team.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          subtype: data.subtype,
          parentTeamId: data.parentTeamId,
          groupId: data.groupId
          ,semester: data.semester
        }
      });

      logger.info(`Updated team: ${team.name}`);
      return {
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        type: team.type,
        subtype: team.subtype || undefined,
        parentTeamId: team.parentTeamId || undefined,
        groupId: team.groupId || undefined,
        semester: team.semester,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      };
    } catch (error) {
      logger.error(`Error updating team ${id}:`, error);
      throw error;
    }
  }

  async deleteTeam(id: string): Promise<void> {
    try {
      // Check if team has members or subteams
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
        throw Errors.NOT_FOUND('Team');
      }

      if (team._count.subteams > 0) {
        throw Errors.CONFLICT('Cannot delete team with subteams');
      }

      // Remove memberships first if any
      if (team._count.userTeams > 0) {
        await prisma.userTeam.deleteMany({ where: { teamId: id } });
        logger.info(`Removed ${team._count.userTeams} membership(s) from team before deletion: ${id}`);
      }

      await prisma.team.delete({
        where: { id }
      });

      logger.info(`Deleted team: ${id}`);
    } catch (error) {
      logger.error(`Error deleting team ${id}:`, error);
      throw error;
    }
  }

  async assignUserToTeam(userId: string, teamId: string, role: 'LEADER' | 'MEMBER' = 'MEMBER'): Promise<void> {
    try {
      // Check if user and team exist
      const [user, team] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.team.findUnique({ where: { id: teamId } })
      ]);

      if (!user) {
        throw Errors.NOT_FOUND('User');
      }

      if (!team) {
        throw Errors.NOT_FOUND('Team');
      }

      // Check if already assigned
      const existingAssignment = await prisma.userTeam.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId
          }
        }
      });

      if (existingAssignment) {
        throw Errors.CONFLICT('User is already assigned to this team');
      }

      // Assign user to team
      await prisma.userTeam.create({
        data: {
          userId,
          teamId,
          role
        }
      });

      logger.info(`Assigned user ${userId} to team ${teamId} as ${role}`);
    } catch (error) {
      logger.error(`Error assigning user ${userId} to team ${teamId}:`, error);
      throw error;
    }
  }

  async removeUserFromTeam(userId: string, teamId: string): Promise<void> {
    try {
      await prisma.userTeam.delete({
        where: {
          userId_teamId: {
            userId,
            teamId
          }
        }
      });

      logger.info(`Removed user ${userId} from team ${teamId}`);
    } catch (error) {
      logger.error(`Error removing user ${userId} from team ${teamId}:`, error);
      throw error;
    }
  }

  async getTeamMembers(teamId: string) {
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
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
            },
            orderBy: [
              { role: 'desc' }, // Leaders first
              { joinedAt: 'asc' }
            ]
          }
        }
      });

      if (!team) {
        throw Errors.NOT_FOUND('Team');
      }

      return team.userTeams.map(ut => ({
        ...ut.user,
        teamRole: ut.role,
        joinedAt: ut.joinedAt
      }));
    } catch (error) {
      logger.error(`Error getting team members ${teamId}:`, error);
      throw error;
    }
  }

  async getSubteams(teamId: string): Promise<TeamProfile[]> {
    try {
      const subteams = await prisma.team.findMany({
        where: { parentTeamId: teamId },
        orderBy: { name: 'asc' }
      });

      return subteams.map(team => ({
        id: team.id,
        name: team.name,
        description: team.description || undefined,
        type: team.type,
        subtype: team.subtype || undefined,
        parentTeamId: team.parentTeamId || undefined,
        groupId: team.groupId || undefined,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      }));
    } catch (error) {
      logger.error(`Error getting subteams for team ${teamId}:`, error);
      throw error;
    }
  }
}
