import { prisma } from '@/models/prismaClient';
import { inventoryLabelQueue } from '@/tasks/queue';
import { loadLabelPdf } from '@/services/inventoryLabelStore';
import { LabelTemplateId, LocationLabelRequest, MAX_LABELS_PER_JOB } from '@/services/inventoryLabelTemplates';
import { createError } from '@/middleware/errorHandler';

export interface InventoryLabelJobData {
  itemIds: string[];
  template: LabelTemplateId;
  requestedById: string;
}

export interface LocationLabelJobData {
  locations: LocationLabelRequest[];
  /** Origin the QR codes point at, e.g. https://mrm.psuccso.org */
  baseUrl: string;
  template: LabelTemplateId;
  requestedById: string;
}

export type LabelJobData = InventoryLabelJobData | LocationLabelJobData;

export const isLocationJob = (data: LabelJobData): data is LocationLabelJobData => 'locations' in data;
export const labelCount = (data: LabelJobData) => (isLocationJob(data) ? data.locations.length : data.itemIds.length);

export interface InventoryLabelJobResult {
  itemCount: number;
  filename: string;
}

export type InventoryLabelJobState = 'queued' | 'processing' | 'completed' | 'failed';

export interface InventoryLabelJobStatus {
  jobId: string;
  state: InventoryLabelJobState;
  progress: { done: number; total: number };
  error?: string;
}

const STATE_MAP: Record<string, InventoryLabelJobState> = {
  completed: 'completed',
  failed: 'failed',
  active: 'processing'
};

export class InventoryLabelManager {
  async requestLabels(params: { itemIds: string[]; template: LabelTemplateId; requestedById: string }): Promise<{ jobId: string }> {
    const itemIds = [...new Set(params.itemIds)];
    if (itemIds.length > MAX_LABELS_PER_JOB) {
      throw createError(`Select at most ${MAX_LABELS_PER_JOB} items per label run`, 400, 'TOO_MANY_ITEMS');
    }
    const found = await prisma.inventoryItem.count({ where: { id: { in: itemIds } } });
    if (found !== itemIds.length) {
      throw createError('Some selected items no longer exist. Refresh and try again.', 404, 'ITEMS_NOT_FOUND');
    }

    const data: InventoryLabelJobData = { itemIds, template: params.template, requestedById: params.requestedById };
    const job = await inventoryLabelQueue.add('generate-labels', data);
    return { jobId: String(job.id) };
  }

  async requestLocationLabels(params: {
    locations: LocationLabelRequest[];
    baseUrl: string;
    template: LabelTemplateId;
    requestedById: string;
  }): Promise<{ jobId: string }> {
    const key = (l: LocationLabelRequest) => JSON.stringify(l.binId ? ['bin', l.binId] : [l.room ?? null, l.shelf ?? null]);
    const locations = [...new Map(params.locations.map(l => [key(l), l])).values()];
    if (locations.length > MAX_LABELS_PER_JOB) {
      throw createError(`Select at most ${MAX_LABELS_PER_JOB} locations per label run`, 400, 'TOO_MANY_ITEMS');
    }
    // Every label must point at somewhere that exists, otherwise the QR leads to a dead page.
    // A room or shelf counts even when it has no bins yet.
    const found = await Promise.all(
      locations.map(async l => {
        if (l.binId) return (await prisma.inventoryBin.count({ where: { id: l.binId } })) > 0;
        const room = l.room ?? null;
        if ((await prisma.inventoryBin.count({ where: { room, ...(l.shelf ? { shelf: l.shelf } : {}) } })) > 0) return true;
        return l.shelf
          ? (await prisma.inventoryShelf.count({ where: { name: l.shelf, room: room ? { name: room } : null } })) > 0
          : !!room && (await prisma.inventoryRoom.count({ where: { name: room } })) > 0;
      })
    );
    if (found.some(exists => !exists)) {
      throw createError('Some selected bins, shelves or rooms no longer exist. Refresh and try again.', 404, 'LOCATIONS_NOT_FOUND');
    }

    const data: LocationLabelJobData = { locations, baseUrl: params.baseUrl, template: params.template, requestedById: params.requestedById };
    const job = await inventoryLabelQueue.add('generate-location-labels', data);
    return { jobId: String(job.id) };
  }

  async getStatus(jobId: string, requestedById: string): Promise<InventoryLabelJobStatus> {
    const job = await this.findOwnedJob(jobId, requestedById);
    const state = STATE_MAP[await job.getState()] ?? 'queued';
    const total = labelCount(job.data);
    const progress = typeof job.progress === 'object' && job.progress !== null ? (job.progress as { done: number }) : { done: 0 };
    return {
      jobId,
      state,
      progress: { done: state === 'completed' ? total : progress.done, total },
      ...(state === 'failed' ? { error: job.failedReason || 'Label generation failed' } : {})
    };
  }

  async getPdf(jobId: string, requestedById: string): Promise<{ pdf: Buffer; filename: string }> {
    const job = await this.findOwnedJob(jobId, requestedById);
    if ((await job.getState()) !== 'completed') throw createError('Labels are not ready yet', 409, 'NOT_READY');
    const pdf = await loadLabelPdf(jobId);
    if (!pdf) throw createError('These labels have expired. Generate them again.', 410, 'EXPIRED');
    return { pdf, filename: (job.returnvalue as InventoryLabelJobResult).filename };
  }

  // Jobs are only visible to the person who requested them.
  private async findOwnedJob(jobId: string, requestedById: string) {
    const job = await inventoryLabelQueue.getJob(jobId);
    if (!job || job.data.requestedById !== requestedById) throw createError('Label job not found', 404, 'NOT_FOUND');
    return job;
  }
}
