import { prisma } from '@/models/prismaClient';
import { TaskManager } from '@/managers/taskManager';
import { createError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

const taskManager = new TaskManager();

/** Lost-item reports go to one shared inbox rather than to individual exec members. */
export const DEFAULT_LOST_ITEM_NOTIFICATION_EMAIL = 'ccso@psu.edu';

export interface LostReportInput {
  note?: string;
  contact?: string;
}

export interface LostReportResult {
  itemName: string;
  /** False when the item was already flagged lost, in which case no email is sent again. */
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
  async reportLost(rawCode: string, input: LostReportInput = {}): Promise<LostReportResult> {
    const code = rawCode.trim();
    const include = {
      bin: { select: { name: true, room: true } },
      shelf: { select: { name: true, room: { select: { name: true } } } },
      room: { select: { name: true } },
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

    await this.notifyCcso(item, input, reportedAt);
    return { itemName: item.name, newlyReported: true };
  }

  private async notifyCcso(
    item: {
      id: string;
      name: string;
      barcode: string;
      bin: { name: string; room: string | null } | null;
      /** Set when the item sits straight on a shelf or in a room instead of a bin. */
      shelf?: { name: string; room: { name: string } | null } | null;
      room?: { name: string } | null;
      checkedOutTo: { firstName: string; lastName: string; displayName: string | null } | null;
    },
    input: LostReportInput,
    reportedAt: Date
  ): Promise<void> {
    try {
      const holder = item.checkedOutTo;
      const templateData = {
        itemName: item.name,
        itemBarcode: item.barcode,
        transactionDate: formatDate(reportedAt),
        lastHolder: holder ? holder.displayName || `${holder.firstName} ${holder.lastName}` : undefined,
        binName: item.bin
          ? [item.bin.room, item.bin.name].filter(Boolean).join(' – ')
          : item.shelf
            ? [item.shelf.room?.name, `Shelf ${item.shelf.name}`].filter(Boolean).join(' – ')
            : item.room?.name,
        reportNote: input.note,
        reporterContact: input.contact,
        itemUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/inventory/items/${item.id}` : undefined,
      };

      await taskManager.enqueueEmailJob({
        to: process.env.LOST_ITEM_NOTIFICATION_EMAIL || DEFAULT_LOST_ITEM_NOTIFICATION_EMAIL,
        subject: '',
        body: '',
        template: 'itemReportedLost',
        templateData,
      });
    } catch (error) {
      // The report itself is already recorded; a notification failure must not fail it.
      logger.error('Failed to notify about lost item', { error, itemId: item.id });
    }
  }
}
