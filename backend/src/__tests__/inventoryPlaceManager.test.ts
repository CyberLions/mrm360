import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const model = () => ({
    findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), count: vi.fn()
  });
  const prisma: Record<string, any> = { inventoryRoom: model(), inventoryShelf: model(), inventoryBin: model(), inventoryItem: model() };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
});
vi.mock('@/models/prismaClient', () => ({ prisma: db }));

import { InventoryPlaceManager } from '../managers/inventoryPlaceManager';

const manager = new InventoryPlaceManager();

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of [db.inventoryRoom, db.inventoryShelf, db.inventoryBin]) {
    model.findFirst.mockResolvedValue(null);
    model.count.mockResolvedValue(0);
  }
});

describe('rooms', () => {
  it('rejects a room whose name is already taken, ignoring case', async () => {
    db.inventoryRoom.findFirst.mockResolvedValue({ id: 'r1', name: 'Lab 1' });
    await expect(manager.createRoom({ name: 'lab 1' })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryRoom.findFirst.mock.calls[0][0].where.name).toEqual({ equals: 'lab 1', mode: 'insensitive' });
    expect(db.inventoryRoom.create).not.toHaveBeenCalled();
  });

  it('renames the room on the bins that use it', async () => {
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Lab 1' });
    db.inventoryRoom.update.mockResolvedValue({ id: 'r1', name: 'Lab 2' });
    await manager.updateRoom('r1', { name: 'Lab 2' });
    expect(db.inventoryBin.updateMany).toHaveBeenCalledWith({ where: { room: 'Lab 1' }, data: { room: 'Lab 2' } });
  });

  it('leaves bins alone when only the description changes', async () => {
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Lab 1' });
    db.inventoryRoom.update.mockResolvedValue({ id: 'r1' });
    await manager.updateRoom('r1', { name: 'Lab 1', description: 'Basement' });
    expect(db.inventoryBin.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to delete a room that still holds bins, shelves or items', async () => {
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Lab 1', _count: { shelves: 0, items: 0 } });
    db.inventoryBin.count.mockResolvedValue(2);
    await expect(manager.deleteRoom('r1')).rejects.toMatchObject({ statusCode: 409 });
    db.inventoryBin.count.mockResolvedValue(0);
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Lab 1', _count: { shelves: 1, items: 0 } });
    await expect(manager.deleteRoom('r1')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryRoom.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty room', async () => {
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1', name: 'Lab 1', _count: { shelves: 0, items: 0 } });
    await manager.deleteRoom('r1');
    expect(db.inventoryRoom.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});

describe('shelves', () => {
  const shelf = { id: 's1', name: '2', roomId: 'r1', room: { name: 'Lab 1' } };

  it('renames a shelf on the bins in its room', async () => {
    db.inventoryShelf.findUnique.mockResolvedValue(shelf);
    db.inventoryRoom.findUnique.mockResolvedValue({ name: 'Lab 1' });
    db.inventoryShelf.update.mockResolvedValue({ ...shelf, name: '3' });
    await manager.updateShelf('s1', { name: '3', roomId: 'r1' });
    expect(db.inventoryBin.updateMany).toHaveBeenCalledWith({ where: { room: 'Lab 1', shelf: '2' }, data: { room: 'Lab 1', shelf: '3' } });
  });

  it('moves the bins along when a shelf changes room, or loses its room', async () => {
    db.inventoryShelf.findUnique.mockResolvedValue(shelf);
    db.inventoryRoom.findUnique.mockResolvedValue({ name: 'Lab 2' });
    db.inventoryShelf.update.mockResolvedValue(shelf);
    await manager.updateShelf('s1', { name: '2', roomId: 'r2' });
    expect(db.inventoryBin.updateMany).toHaveBeenLastCalledWith({ where: { room: 'Lab 1', shelf: '2' }, data: { room: 'Lab 2', shelf: '2' } });
    await manager.updateShelf('s1', { name: '2', roomId: null });
    expect(db.inventoryBin.updateMany).toHaveBeenLastCalledWith({ where: { room: 'Lab 1', shelf: '2' }, data: { room: null, shelf: '2' } });
  });

  it('rejects a duplicate shelf within the same room', async () => {
    db.inventoryRoom.findUnique.mockResolvedValue({ id: 'r1' });
    db.inventoryShelf.findFirst.mockResolvedValue({ id: 'other' });
    await expect(manager.createShelf({ name: '2', roomId: 'r1' })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses to delete a shelf that still has bins or items', async () => {
    db.inventoryShelf.findUnique.mockResolvedValue({ ...shelf, _count: { items: 0 } });
    db.inventoryBin.count.mockResolvedValue(1);
    await expect(manager.deleteShelf('s1')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.inventoryBin.count).toHaveBeenCalledWith({ where: { room: 'Lab 1', shelf: '2' } });
    expect(db.inventoryShelf.delete).not.toHaveBeenCalled();
  });
});

describe('canonicalizeBinLocation', () => {
  it('reuses the registry spelling instead of creating a second room or shelf', async () => {
    db.inventoryRoom.findFirst.mockResolvedValue({ id: 'r1', name: 'Lab 1' });
    db.inventoryShelf.findFirst.mockResolvedValue({ id: 's1', name: 'Top' });
    await expect(manager.canonicalizeBinLocation({ room: ' lab 1', shelf: 'top ' })).resolves.toEqual({ room: 'Lab 1', shelf: 'Top' });
    expect(db.inventoryRoom.create).not.toHaveBeenCalled();
    expect(db.inventoryShelf.create).not.toHaveBeenCalled();
  });

  it('adds a new room and shelf typed into the bin form', async () => {
    db.inventoryRoom.create.mockResolvedValue({ id: 'r9', name: 'Garage' });
    db.inventoryShelf.create.mockResolvedValue({ id: 's9', name: 'Left' });
    await expect(manager.canonicalizeBinLocation({ room: 'Garage', shelf: 'Left' })).resolves.toEqual({ room: 'Garage', shelf: 'Left' });
    expect(db.inventoryShelf.create).toHaveBeenCalledWith({ data: { name: 'Left', roomId: 'r9' } });
  });

  it('treats blank input as no room and no shelf', async () => {
    await expect(manager.canonicalizeBinLocation({ room: '  ', shelf: null })).resolves.toEqual({ room: null, shelf: null });
    expect(db.inventoryRoom.findFirst).not.toHaveBeenCalled();
  });
});

describe('resolvePlace', () => {
  it('describes a shelf with its room, and returns null for a deleted or empty place', async () => {
    db.inventoryShelf.findUnique.mockResolvedValue({ id: 's1', name: '2', room: { name: 'Lab 1' } });
    await expect(manager.resolvePlace({ binId: null, shelfId: 's1', roomId: null })).resolves.toEqual({ kind: 'shelf', id: 's1', name: '2', room: 'Lab 1', shelf: null });
    db.inventoryBin.findUnique.mockResolvedValue(null);
    await expect(manager.resolvePlace({ binId: 'gone', shelfId: null, roomId: null })).resolves.toBeNull();
    await expect(manager.resolvePlace({ binId: null, shelfId: null, roomId: null })).resolves.toBeNull();
  });
});
