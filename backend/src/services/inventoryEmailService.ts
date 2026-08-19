import { TaskManager } from '@/managers/taskManager';
import { EmailTemplateName, TemplateData } from './emailTemplates';
import { logger } from '@/utils/logger';

const taskManager = new TaskManager();

type InventoryEmailUser = {
  firstName: string;
  email: string;
};

type InventoryEmailItem = {
  name: string;
  barcode: string;
};

function formatTransactionDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: process.env.TIMEZONE || 'UTC',
  });
}

async function enqueueInventoryEmail(
  user: InventoryEmailUser,
  item: InventoryEmailItem,
  template: EmailTemplateName,
  transactionLabel: string,
  transactionDate: Date,
  binName?: string
): Promise<void> {
  const templateData: TemplateData = {
    userName: user.firstName,
    itemName: item.name,
    itemBarcode: item.barcode,
    transactionLabel,
    transactionDate: formatTransactionDate(transactionDate),
    binName,
  };

  try {
    await taskManager.enqueueEmailJob({
      to: user.email,
      subject: '',
      body: '',
      template,
      templateData,
    });
  } catch (error) {
    // Notification failures should never roll back a completed inventory transaction.
    logger.error('Failed to enqueue inventory email', { error, template, to: user.email, itemId: item.barcode });
  }
}

export async function sendItemCheckedOutEmail(
  user: InventoryEmailUser,
  item: InventoryEmailItem,
  checkedOutAt: Date
): Promise<void> {
  await enqueueInventoryEmail(user, item, 'itemCheckedOut', 'Checked out', checkedOutAt);
}

export async function sendItemCheckedInEmail(
  user: InventoryEmailUser,
  item: InventoryEmailItem,
  checkedInAt: Date,
  binName?: string
): Promise<void> {
  await enqueueInventoryEmail(user, item, 'itemCheckedIn', 'Returned', checkedInAt, binName);
}
