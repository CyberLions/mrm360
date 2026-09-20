import { Job } from 'bullmq';
import { logger } from '@/utils/logger';
import { prisma } from '@/models/prismaClient';
import { renderLabelPdf, renderLocationLabelPdf } from '@/services/inventoryLabelRenderer';
import { saveLabelPdf } from '@/services/inventoryLabelStore';
import { labelFilename } from '@/services/inventoryLabelTemplates';
import type { LocationLabelRequest, LocationLabelSpec } from '@/services/inventoryLabelTemplates';
import { isLocationJob, labelCount } from '@/managers/inventoryLabelManager';
import type { LabelJobData, InventoryLabelJobResult } from '@/managers/inventoryLabelManager';

// Progress writes hit Redis, so keep them to roughly 50 per job.
const progressReporter = (job: Job<LabelJobData>, total: number) => {
  const step = Math.max(1, Math.ceil(total / 50));
  return async (done: number) => {
    if (done === total || done % step === 0) await job.updateProgress({ done, total });
  };
};

// Bin labels store only the bin id in the job; resolve names now so a rename between
// requesting and rendering is picked up.
async function resolveLocations(requests: LocationLabelRequest[]): Promise<LocationLabelSpec[]> {
  const binIds = requests.flatMap(r => (r.binId ? [r.binId] : []));
  const bins = binIds.length
    ? await prisma.inventoryBin.findMany({ where: { id: { in: binIds } }, select: { id: true, name: true, room: true, shelf: true } })
    : [];
  const byId = new Map(bins.map(bin => [bin.id, bin]));
  return requests.flatMap<LocationLabelSpec>(request => {
    if (!request.binId) return [{ room: request.room, shelf: request.shelf }];
    const bin = byId.get(request.binId);
    return bin ? [{ room: bin.room, shelf: bin.shelf, bin: { id: bin.id, name: bin.name } }] : [];
  });
}

async function processLocationJob(job: Job<LabelJobData>, data: Extract<LabelJobData, { locations: unknown }>): Promise<InventoryLabelJobResult> {
  const locations = await resolveLocations(data.locations);
  if (!locations.length) throw new Error('None of the selected bins, shelves or rooms exist any more');
  const report = progressReporter(job, locations.length);
  const pdf = await renderLocationLabelPdf(locations, data.baseUrl, data.template, { onProgress: done => report(done) });
  await saveLabelPdf(String(job.id), pdf);
  logger.info(`Location label job ${job.id} finished`, { labels: locations.length, bytes: pdf.byteLength });
  return { itemCount: locations.length, filename: labelFilename(data.template).replace('inventory-labels', 'location-labels') };
}

export async function processInventoryLabelJob(job: Job<LabelJobData>): Promise<InventoryLabelJobResult> {
  if (isLocationJob(job.data)) return processLocationJob(job, job.data);
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

  const report = progressReporter(job, items.length);
  const pdf = await renderLabelPdf(items, template, { onProgress: done => report(done) });
  await saveLabelPdf(String(job.id), pdf);

  logger.info(`Inventory label job ${job.id} finished`, { labels: items.length, bytes: pdf.byteLength });
  return { itemCount: items.length, filename: labelFilename(template) };
}

export async function processInventoryLabelJobFailed(job: Job<LabelJobData>, error: Error) {
  logger.error(`Inventory label job ${job.id} failed permanently:`, {
    error: error.message,
    labels: labelCount(job.data),
    template: job.data.template
  });
}
