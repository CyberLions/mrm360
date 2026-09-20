import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));
vi.mock('@/models/prismaClient', () => ({ prisma: { inventoryBin: { findMany: mockFindMany } } }));

import { InventoryLocationManager } from '../managers/inventoryLocationManager';

const bin = (over: Record<string, unknown> = {}) => ({
  id: 'b1', name: 'Bin A', room: 'Lab 1', shelf: '2', code: null, description: null,
  items: [
    { id: 'i1', name: 'Switch', barcode: 'ITEM-1', description: '48-port PoE switch', checkedOutToId: null, lostAt: null, category: { name: 'Networking' } },
    { id: 'i2', name: 'Cable', barcode: 'ITEM-2', checkedOutToId: 'someone', lostAt: null, category: null },
    { id: 'i3', name: 'Laptop', barcode: 'ITEM-3', checkedOutToId: 'viewer', lostAt: null, category: null },
    { id: 'i4', name: 'Router', barcode: 'ITEM-4', checkedOutToId: null, lostAt: new Date(), category: null },
  ],
  ...over,
});

describe('InventoryLocationManager', () => {
  beforeEach(() => mockFindMany.mockReset());
  const manager = new InventoryLocationManager();

  it('queries a shelf by room + shelf', async () => {
    mockFindMany.mockResolvedValue([bin()]);
    await manager.getLocation({ room: 'Lab 1', shelf: '2' }, 'viewer');
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ room: 'Lab 1', shelf: '2' });
  });

  it('queries a whole room without a shelf filter, and a room-less shelf with room null', async () => {
    mockFindMany.mockResolvedValue([bin()]);
    await manager.getLocation({ room: 'Lab 1', shelf: null }, 'viewer');
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ room: 'Lab 1' });
    await manager.getLocation({ room: null, shelf: '2' }, 'viewer');
    expect(mockFindMany.mock.calls[1][0].where).toEqual({ room: null, shelf: '2' });
  });

  it('includes item descriptions', async () => {
    mockFindMany.mockResolvedValue([bin()]);
    const result = await manager.getLocation({ room: 'Lab 1', shelf: '2' }, 'viewer');
    expect(result.bins[0].items[0].description).toBe('48-port PoE switch');
  });

  it('maps statuses relative to the viewer and never exposes who holds an item', async () => {
    mockFindMany.mockResolvedValue([bin()]);
    const result = await manager.getLocation({ room: 'Lab 1', shelf: '2' }, 'viewer');
    expect(result.bins[0].items.map(i => i.status)).toEqual(['available', 'checked-out', 'with-you', 'lost']);
    expect(result.totals).toEqual({ items: 4, available: 1 });
    expect(JSON.stringify(result)).not.toContain('someone');
  });

  it('queries a single bin by id and reports the bin\'s own room and shelf', async () => {
    mockFindMany.mockResolvedValue([bin()]);
    const result = await manager.getLocation({ room: null, shelf: null, binId: 'b1' }, 'viewer');
    expect(mockFindMany.mock.calls[0][0].where).toEqual({ id: 'b1' });
    expect(result).toMatchObject({ binId: 'b1', room: 'Lab 1', shelf: '2' });
    expect(result.bins).toHaveLength(1);
  });

  it('404s when the location has no bins', async () => {
    mockFindMany.mockResolvedValue([]);
    await expect(manager.getLocation({ room: 'Nope', shelf: null }, 'viewer')).rejects.toMatchObject({ statusCode: 404 });
  });
});
