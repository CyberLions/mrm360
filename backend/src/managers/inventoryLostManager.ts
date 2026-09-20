import { prisma } from '@/models/prismaClient';
import { TaskManager } from '@/managers/taskManager';
import { createError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const taskManager = new TaskManager();

const ADMIN_GROUP_NAMES = ['tech-team', 'executive-board'];

export interface LostReportInput {
  note?: string;
  contact?: string;
}

export interface LostReportResult {
  itemName: string;
  /** False when the item was already flagged lost, in which case nobody is emailed again. */
  newlyReported: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: process.env.TIMEZONE || 'UTC',
  });
}

export class InventoryLostManager {
  /** Exec/admin users: stored system role, or membership of an admin Authentik group. */
  async getNotificationRecipients(): Promise<Array<{ firstName: string; email: string }>> {
    return prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ['ADMIN', 'EXEC_BOARD'] } },
          { userGroups: { some: { group: { name: { in: ADMIN_GROUP_NAMES } } } } },
        ],
      },
      select: { firstName: true, email: true },
    });
  }

  async reportLost(rawCode: string, input: LostReportInput = {}): Promise<LostReportResult> {
    const code = rawCode.trim();
    const include = {
      bin: { select: { name: true, room: true } },
      checkedOutTo: { select: { firstName: true, lastName: true, displayName: true } },
    } as const;

    const item =
      (await prisma.inventoryItem.findUnique({ where: { barcode: code }, include })) ??
      (await prisma.inventoryItem.findFirst({ where: { barcode: { equals: code, mode: 'insensitive' } }, include }));
    if (!item) throw createError('No item found with that label', 404, 'ITEM_NOT_FOUND');

    const reportedAt = new Date();
    // The lostAt: null guard makes the transition atomic, so concurrent reports email once.
    const { count } = await prisma.inventoryItem.updateMany({
      where: { id: item.id, lostAt: null },
      data: { lostAt: reportedAt, lostNote: input.note || null },
    });
    if (count === 0) return { itemName: item.name, newlyReported: false };

    await this.notifyRecipients(item, input, reportedAt);
    return { itemName: item.name, newlyReported: true };
  }

  private async notifyRecipients(
    item: {
      id: string;
      name: string;
      barcode: string;
      bin: { name: string; room: string | null } | null;
      checkedOutTo: { firstName: string; lastName: string; displayName: string | null } | null;
    },
    input: LostReportInput,
    reportedAt: Date
  ): Promise<void> {
    try {
      const recipients = await this.getNotificationRecipients();
      if (recipients.length === 0) {
        logger.warn('Item reported lost but there are no exec/admin recipients', { itemId: item.id });
        return;
      }

      const holder = item.checkedOutTo;
      const templateData = {
        itemName: item.name,
        itemBarcode: item.barcode,
        transactionDate: formatDate(reportedAt),
        lastHolder: holder ? holder.displayName || `${holder.firstName} ${holder.lastName}` : undefined,
        binName: item.bin ? [item.bin.room, item.bin.name].filter(Boolean).join(' – ') : undefined,
        reportNote: input.note,
        reporterContact: input.contact,
        itemUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/inventory/items/${item.id}` : undefined,
      };

      const results = await Promise.allSettled(
        recipients.map(recipient =>
          taskManager.enqueueEmailJob({
            to: recipient.email,
            subject: '',
            body: '',
            template: 'itemReportedLost',
            templateData: { ...templateData, userName: recipient.firstName },
          })
        )
      );
      const failed = results.filter(result => result.status === 'rejected').length;
      if (failed > 0) logger.error('Some lost-item emails failed to enqueue', { itemId: item.id, failed, total: recipients.length });
    } catch (error) {
      // The report itself is already recorded; a notification failure must not fail it.
      logger.error('Failed to notify about lost item', { error, itemId: item.id });
    }
  }
}
