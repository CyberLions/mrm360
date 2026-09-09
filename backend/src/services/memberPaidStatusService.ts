import { PaymentStatus, PrismaClient } from '@prisma/client';
import { AuthentikService } from './authentikService';
import { AuthentikServiceFactory } from './authentikServiceFactory';
import { logger } from '@/utils/logger';

export class MemberPaidStatusService {
  private prisma: PrismaClient;
  private authentikService: AuthentikService;
  private readonly MEMBER_PAID_GROUP_NAME = 'member-paid';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authentikService = AuthentikServiceFactory.createServiceFromEnv();
  }

  /**
   * Update a member's paid status and manage their Authentik group membership
   */
  async updateMemberPaidStatus(userId: string, paidStatus: boolean): Promise<void> {
    try {
      logger.info('Updating member paid status', { userId, paidStatus });

      // Get the user to check if they have an Authentik PK
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          authentikPk: true,
          paidStatus: true
        }
      });

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Update the paid status in the database
      await this.prisma.user.update({
        where: { id: userId },
        data: { paidStatus }
      });

      // Get or find the Authentik PK (primary key) for group operations
      let authentikPk = user.authentikPk;
      
      // If we don't have the Authentik PK, try to look it up by email
      if (!authentikPk) {
        try {
          logger.info(`Looking up Authentik PK for email: ${user.email}`);
          const authentikUser = await this.authentikService.getUserByEmail(user.email);
          authentikPk = authentikUser.id;
          
          // Store the Authentik PK in the database for future use
          await this.prisma.user.update({
            where: { id: userId },
            data: { authentikPk: authentikPk.toString() }
          });
          
          logger.info(`Found and stored Authentik PK for user ${user.email}: ${authentikPk}`);
        } catch (error) {
          logger.warn(`Failed to look up Authentik PK for ${user.email}:`, error);
          // Continue without Authentik group management - the user update still succeeds
          return;
        }
      }

      // If we have an Authentik PK, manage their group membership
      if (authentikPk) {
        await this.manageAuthentikGroupMembership(authentikPk.toString(), paidStatus);
      } else {
        logger.warn('User does not have Authentik PK, skipping group management', { userId, email: user.email });
      }

      logger.info('Member paid status updated successfully', { userId, paidStatus });
    } catch (error) {
      logger.error('Failed to update member paid status', { error, userId, paidStatus });
      throw error;
    }
  }

  /**
   * Manage a user's membership in the "member-paid" Authentik group
   */
  private async manageAuthentikGroupMembership(authentikUserId: string, paidStatus: boolean): Promise<void> {
    try {
      logger.info('Managing Authentik group membership', { authentikUserId, paidStatus });

      // Find or create the "member-paid" group
      const memberPaidGroup = await this.findOrCreateMemberPaidGroup();

      if (paidStatus) {
        // Add user to the "member-paid" group
        await this.addUserToMemberPaidGroup(memberPaidGroup.id, authentikUserId);
      } else {
        // Remove user from the "member-paid" group
        await this.removeUserFromMemberPaidGroup(memberPaidGroup.id, authentikUserId);
      }

      logger.info('Authentik group membership updated successfully', { authentikUserId, paidStatus });
    } catch (error) {
      logger.error('Failed to manage Authentik group membership', { error, authentikUserId, paidStatus });
      throw error;
    }
  }

  /**
   * Find or create the "member-paid" group in Authentik
   */
  private async findOrCreateMemberPaidGroup(): Promise<any> {
    try {
      // First try to find the existing group
      const existingGroup = await this.authentikService.findGroupByName(this.MEMBER_PAID_GROUP_NAME);
      
      if (existingGroup) {
        logger.info('Found existing member-paid group', { groupId: existingGroup.id });
        return existingGroup;
      }

      // Create the group if it doesn't exist
      logger.info('Creating new member-paid group');
      const newGroup = await this.authentikService.createGroup(
        this.MEMBER_PAID_GROUP_NAME,
        'Members who have paid their dues'
      );

      logger.info('Created new member-paid group', { groupId: newGroup.id });
      return newGroup;
    } catch (error) {
      logger.error('Failed to find or create member-paid group', { error });
      throw error;
    }
  }

  /**
   * Add a user to the "member-paid" group
   */
  private async addUserToMemberPaidGroup(groupId: string, authentikUserId: string): Promise<void> {
    try {
      logger.info('Adding user to member-paid group', { groupId, authentikUserId });
      
      await this.authentikService.addUsersToGroup(groupId, [authentikUserId]);
      
      logger.info('User added to member-paid group successfully', { groupId, authentikUserId });
    } catch (error) {
      logger.error('Failed to add user to member-paid group', { error, groupId, authentikUserId });
      throw error;
    }
  }

  /**
   * Remove a user from the "member-paid" group
   */
  private async removeUserFromMemberPaidGroup(groupId: string, authentikUserId: string): Promise<void> {
    try {
      logger.info('Removing user from member-paid group', { groupId, authentikUserId });
      
      await this.authentikService.removeUsersFromGroup(groupId, [authentikUserId]);
      
      logger.info('User removed from member-paid group successfully', { groupId, authentikUserId });
    } catch (error) {
      logger.error('Failed to remove user from member-paid group', { error, groupId, authentikUserId });
      throw error;
    }
  }

  /**
   * Sync all users' paid status with Authentik groups
   * This can be used to ensure consistency between the database and Authentik
   */
  async syncAllPaidStatuses(): Promise<{ processed: number; errors: number }> {
    try {
      logger.info('Starting paid status sync with Authentik');

      const users = await this.prisma.user.findMany({
        where: {
          authentikPk: { not: null }
        },
        select: {
          id: true,
          authentikPk: true,
          paidStatus: true,
          email: true,
          payments: {
            where: {
              status: PaymentStatus.COMPLETED,
              expiresAt: { gt: new Date() }
            },
            select: { id: true },
            take: 1
          }
        }
      });

      let processed = 0;
      let errors = 0;

      for (const user of users) {
        try {
          const expectedPaidStatus = user.payments.length > 0;

          if (user.paidStatus !== expectedPaidStatus) {
            await this.prisma.user.update({
              where: { id: user.id },
              data: { paidStatus: expectedPaidStatus }
            });
            logger.warn('Corrected paid status discrepancy during Authentik sync', {
              userId: user.id,
              email: user.email,
              previousPaidStatus: user.paidStatus,
              expectedPaidStatus
            });
          }

          // Apply the expected state unconditionally so the recurring sync also
          // repairs discrepancies in Authentik itself.
          await this.manageAuthentikGroupMembership(user.authentikPk!, expectedPaidStatus);
          processed++;
        } catch (error) {
          logger.error('Failed to sync user paid status', { error, userId: user.id, email: user.email });
          errors++;
        }
      }

      logger.info('Paid status sync completed', { processed, errors, total: users.length });
      return { processed, errors };
    } catch (error) {
      logger.error('Failed to sync paid statuses', { error });
      throw error;
    }
  }

  /**
   * Get the current members of the "member-paid" group
   */
  async getMemberPaidGroupMembers(): Promise<string[]> {
    try {
      const memberPaidGroup = await this.authentikService.findGroupByName(this.MEMBER_PAID_GROUP_NAME);
      
      if (!memberPaidGroup) {
        logger.info('Member-paid group does not exist');
        return [];
      }

      const group = await this.authentikService.getGroup(memberPaidGroup.id);
      return group.users || [];
    } catch (error) {
      logger.error('Failed to get member-paid group members', { error });
      throw error;
    }
  }
}
