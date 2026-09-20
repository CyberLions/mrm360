import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindUnique, mockFindFirst, mockUpdateMany, mockFindUsers, mockEnqueueEmailJob } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockFindUsers: vi.fn(),
  mockEnqueueEmailJob: vi.fn(),
}));

vi.mock('@/models/prismaClient', () => ({
  prisma: {
    inventoryItem: { findUnique: mockFindUnique, findFirst: mockFindFirst, updateMany: mockUpdateMany },
    user: { findMany: mockFindUsers },
  },
}));
vi.mock('@/managers/taskManager', () => ({
  TaskManager: vi.fn(() => ({ enqueueEmailJob: mockEnqueueEmailJob })),
}));
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { InventoryLostManager } from '../managers/inventoryLostManager';

const manager = new InventoryLostManager();

const item = {
  id: 'item-1',
  name: 'Fluke Multimeter',
  barcode: 'ITEM-ABC123',
  bin: { name: 'Bin 4', room: 'Room 12' },
  checkedOutTo: { firstName: 'Alice', lastName: 'Smith', displayName: null },
};

describe('InventoryLostManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFindUnique.mockResolvedValue(item);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUsers.mockResolvedValue([
      { firstName: 'Ellie', email: 'ellie@test.com' },
      { firstName: 'Sam', email: 'sam@test.com' },
    ]);
    mockEnqueueEmailJob.mockResolvedValue('job-1');
  });

  it('flags the item lost and emails every exec/admin', async () => {
    const result = await manager.reportLost('  ITEM-ABC123 ', { note: 'Found in the hallway' });

    expect(result).toEqual({ itemName: 'Fluke Multimeter', newlyReported: true });
    expect(mockFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { barcode: 'ITEM-ABC123' } }));
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', lostAt: null },
      data: { lostAt: expect.any(Date), lostNote: 'Found in the hallway' },
    });
    expect(mockEnqueueEmailJob).toHaveBeenCalledTimes(2);
    expect(mockEnqueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ellie@test.com',
      template: 'itemReportedLost',
      templateData: expect.objectContaining({
        userName: 'Ellie',
        itemName: 'Fluke Multimeter',
        itemBarcode: 'ITEM-ABC123',
        lastHolder: 'Alice Smith',
        binName: 'Room 12 – Bin 4',
        reportNote: 'Found in the hallway',
      }),
    }));
  });

  it('selects recipients by system role or admin Authentik group', async () => {
    await manager.reportLost('ITEM-ABC123');

    expect(mockFindUsers).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { role: { in: ['ADMIN', 'EXEC_BOARD'] } },
          { userGroups: { some: { group: { name: { in: ['tech-team', 'executive-board'] } } } } },
        ],
      },
    }));
  });

  it('falls back to a case-insensitive lookup', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(item);

    await manager.reportLost('item-abc123');

    expect(mockFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { barcode: { equals: 'item-abc123', mode: 'insensitive' } },
    }));
    expect(mockEnqueueEmailJob).toHaveBeenCalled();
  });

  it('rejects an unknown code without touching anything', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);

    await expect(manager.reportLost('nope')).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockEnqueueEmailJob).not.toHaveBeenCalled();
  });

  it('does not email again when the item is already flagged lost', async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const result = await manager.reportLost('ITEM-ABC123');

    expect(result).toEqual({ itemName: 'Fluke Multimeter', newlyReported: false });
    expect(mockEnqueueEmailJob).not.toHaveBeenCalled();
  });

  it('still records the report when queuing emails fails', async () => {
    mockEnqueueEmailJob.mockRejectedValue(new Error('Redis down'));

    await expect(manager.reportLost('ITEM-ABC123')).resolves.toMatchObject({ newlyReported: true });
  });

  it('still records the report when there are no recipients', async () => {
    mockFindUsers.mockResolvedValue([]);

    await expect(manager.reportLost('ITEM-ABC123')).resolves.toMatchObject({ newlyReported: true });
    expect(mockEnqueueEmailJob).not.toHaveBeenCalled();
  });
});
