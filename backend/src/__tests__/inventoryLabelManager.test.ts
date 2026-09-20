import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCount, mockBinCount, mockAdd, mockGetJob, mockLoadPdf } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockBinCount: vi.fn(),
  mockAdd: vi.fn(),
  mockGetJob: vi.fn(),
  mockLoadPdf: vi.fn(),
}));

vi.mock('@/models/prismaClient', () => ({ prisma: { inventoryItem: { count: mockCount }, inventoryBin: { count: mockBinCount } } }));
vi.mock('@/tasks/queue', () => ({ inventoryLabelQueue: { add: mockAdd, getJob: mockGetJob } }));
vi.mock('@/services/inventoryLabelStore', () => ({ loadLabelPdf: mockLoadPdf }));

import { InventoryLabelManager } from '../managers/inventoryLabelManager';
import { MAX_LABELS_PER_JOB } from '../services/inventoryLabelTemplates';

const manager = new InventoryLabelManager();

const fakeJob = (overrides: Record<string, unknown> = {}) => ({
  data: { itemIds: ['a', 'b', 'c', 'd'], template: '3x2-two-column', requestedById: 'user-1' },
  progress: 0,
  failedReason: undefined,
  returnvalue: { itemCount: 4, filename: 'inventory-labels-3x2-2026-09-20.pdf' },
  getState: vi.fn().mockResolvedValue('waiting'),
  ...overrides,
});

describe('InventoryLabelManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('requestLabels', () => {
    it('de-duplicates ids and enqueues the job', async () => {
      mockCount.mockResolvedValue(2);
      mockAdd.mockResolvedValue({ id: 42 });

      const result = await manager.requestLabels({ itemIds: ['a', 'b', 'a'], template: '4x6-large', requestedById: 'user-1' });

      expect(result).toEqual({ jobId: '42' });
      expect(mockAdd).toHaveBeenCalledWith('generate-labels', { itemIds: ['a', 'b'], template: '4x6-large', requestedById: 'user-1' });
    });

    it('rejects a selection above the per-job cap', async () => {
      const itemIds = Array.from({ length: MAX_LABELS_PER_JOB + 1 }, (_, i) => `id-${i}`);
      await expect(manager.requestLabels({ itemIds, template: '3x2-two-column', requestedById: 'user-1' })).rejects.toMatchObject({ statusCode: 400 });
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('rejects ids that no longer exist', async () => {
      mockCount.mockResolvedValue(1);
      await expect(manager.requestLabels({ itemIds: ['a', 'b'], template: '3x2-two-column', requestedById: 'user-1' })).rejects.toMatchObject({ statusCode: 404 });
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe('requestLocationLabels', () => {
    const base = { baseUrl: 'https://mrm.example', template: '3x2-two-column' as const, requestedById: 'user-1' };

    it('de-duplicates locations, checks each has bins, and enqueues with the base URL', async () => {
      mockBinCount.mockResolvedValue(2);
      mockAdd.mockResolvedValue({ id: 9 });
      const result = await manager.requestLocationLabels({
        ...base,
        locations: [{ room: 'Lab 1', shelf: '2' }, { room: 'Lab 1', shelf: '2' }, { room: 'Lab 2', shelf: null }],
      });
      expect(result).toEqual({ jobId: '9' });
      expect(mockBinCount).toHaveBeenNthCalledWith(1, { where: { room: 'Lab 1', shelf: '2' } });
      expect(mockBinCount).toHaveBeenNthCalledWith(2, { where: { room: 'Lab 2' } });
      expect(mockAdd).toHaveBeenCalledWith('generate-location-labels', {
        locations: [{ room: 'Lab 1', shelf: '2' }, { room: 'Lab 2', shelf: null }],
        baseUrl: 'https://mrm.example',
        template: '3x2-two-column',
        requestedById: 'user-1',
      });
    });

    it('validates bin labels by id, and de-duplicates them by id', async () => {
      mockBinCount.mockResolvedValue(1);
      mockAdd.mockResolvedValue({ id: 3 });
      await manager.requestLocationLabels({
        ...base,
        locations: [
          { room: null, shelf: null, binId: 'bin-1' },
          { room: 'Lab 1', shelf: '2', binId: 'bin-1' },
          { room: null, shelf: null, binId: 'bin-2' },
        ],
      });
      expect(mockBinCount).toHaveBeenCalledTimes(2);
      expect(mockBinCount).toHaveBeenNthCalledWith(1, { where: { id: 'bin-1' } });
      expect(mockBinCount).toHaveBeenNthCalledWith(2, { where: { id: 'bin-2' } });
      expect(mockAdd.mock.calls[0][1].locations).toHaveLength(2);
    });

    it('rejects locations that have no bins', async () => {
      mockBinCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      await expect(
        manager.requestLocationLabels({ ...base, locations: [{ room: 'A', shelf: null }, { room: 'B', shelf: null }] })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('reports progress totals from the location count', async () => {
      mockGetJob.mockResolvedValue({
        data: { locations: [{ room: 'A', shelf: null }, { room: 'B', shelf: null }], baseUrl: 'x', template: '3x2-two-column', requestedById: 'user-1' },
        progress: { done: 1 },
        getState: vi.fn().mockResolvedValue('active'),
      });
      expect((await manager.getStatus('1', 'user-1')).progress).toEqual({ done: 1, total: 2 });
    });
  });

  describe('getStatus', () => {
    it.each([
      ['waiting', 'queued'],
      ['delayed', 'queued'],
      ['active', 'processing'],
      ['completed', 'completed'],
      ['failed', 'failed'],
    ])('maps BullMQ state %s to %s', async (bullState, expected) => {
      mockGetJob.mockResolvedValue(fakeJob({ getState: vi.fn().mockResolvedValue(bullState) }));
      expect((await manager.getStatus('1', 'user-1')).state).toBe(expected);
    });

    it('reports progress and treats completed jobs as fully done', async () => {
      mockGetJob.mockResolvedValue(fakeJob({ progress: { done: 3, total: 4 }, getState: vi.fn().mockResolvedValue('active') }));
      expect((await manager.getStatus('1', 'user-1')).progress).toEqual({ done: 3, total: 4 });

      mockGetJob.mockResolvedValue(fakeJob({ getState: vi.fn().mockResolvedValue('completed') }));
      expect((await manager.getStatus('1', 'user-1')).progress).toEqual({ done: 4, total: 4 });
    });

    it('surfaces the failure reason', async () => {
      mockGetJob.mockResolvedValue(fakeJob({ failedReason: 'Barcode "x" cannot be printed', getState: vi.fn().mockResolvedValue('failed') }));
      expect((await manager.getStatus('1', 'user-1')).error).toBe('Barcode "x" cannot be printed');
    });

    it("hides other users' jobs and missing jobs behind a 404", async () => {
      mockGetJob.mockResolvedValue(fakeJob());
      await expect(manager.getStatus('1', 'someone-else')).rejects.toMatchObject({ statusCode: 404 });
      mockGetJob.mockResolvedValue(undefined);
      await expect(manager.getStatus('1', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getPdf', () => {
    it('refuses until the job has completed', async () => {
      mockGetJob.mockResolvedValue(fakeJob({ getState: vi.fn().mockResolvedValue('active') }));
      await expect(manager.getPdf('1', 'user-1')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('returns 410 once the stored PDF has expired', async () => {
      mockGetJob.mockResolvedValue(fakeJob({ getState: vi.fn().mockResolvedValue('completed') }));
      mockLoadPdf.mockResolvedValue(null);
      await expect(manager.getPdf('1', 'user-1')).rejects.toMatchObject({ statusCode: 410 });
    });

    it('returns the PDF with its filename', async () => {
      const pdf = Buffer.from('%PDF-1.7');
      mockGetJob.mockResolvedValue(fakeJob({ getState: vi.fn().mockResolvedValue('completed') }));
      mockLoadPdf.mockResolvedValue(pdf);
      expect(await manager.getPdf('1', 'user-1')).toEqual({ pdf, filename: 'inventory-labels-3x2-2026-09-20.pdf' });
    });
  });
});
