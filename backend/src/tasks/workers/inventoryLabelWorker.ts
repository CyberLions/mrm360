import { Job } from 'bullmq';
import { logger } from '@/utils/logger';
import { prisma } from '@/models/prismaClient';
import { renderLabelPdf } from '@/services/inventoryLabelRenderer';
import { saveLabelPdf } from '@/services/inventoryLabelStore';
import { labelFilename } from '@/services/inventoryLabelTemplates';
import type { InventoryLabelJobData, InventoryLabelJobResult } from '@/managers/inventoryLabelManager';

export async function processInventoryLabelJob(job: Job<InventoryLabelJobData>): Promise<InventoryLabelJobResult> {
  const { itemIds, template } = job.data;
  logger.info(`Processing inventory label job ${job.id}`, { items: itemIds.length, template });

  const rows = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, barcode: true, name: true, category: { select: { name: true } } }
  });
  // Print in the order the user selected them, skipping anything deleted since.
  const byId = new Map(rows.map(row => [row.id, row]));
  const items = itemIds.flatMap(id => {
    const row = byId.get(id);
    return row ? [{ barcode: row.barcode, name: row.name, categoryName: row.category?.name ?? null }] : [];
  });
  if (!items.length) throw new Error('None of the selected items exist any more');

  // Progress writes hit Redis, so keep them to roughly 50 per job.
  const step = Math.max(1, Math.ceil(items.length / 50));
  const pdf = await renderLabelPdf(items, template, {
    onProgress: async (done, total) => {
      if (done === total || done % step === 0) await job.updateProgress({ done, total });
    }
  });
  await saveLabelPdf(String(job.id), pdf);

  logger.info(`Inventory label job ${job.id} finished`, { labels: items.length, bytes: pdf.byteLength });
  return { itemCount: items.length, filename: labelFilename(template) };
}

export async function processInventoryLabelJobFailed(job: Job<InventoryLabelJobData>, error: Error) {
  logger.error(`Inventory label job ${job.id} failed permanently:`, {
    error: error.message,
    items: job.data.itemIds.length,
    template: job.data.template
  });
}
