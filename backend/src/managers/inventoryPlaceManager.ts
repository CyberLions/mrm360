import { Prisma } from '@prisma/client';
import { prisma } from '@/models/prismaClient';
import { createError } from '@/middleware/errorHandler';
import type { Place, PlaceRef } from '@/utils/inventoryPlace';

type Tx = Prisma.TransactionClient;

const clean = (value: string | null | undefined): string | null => value?.trim() || null;
const insensitive = (name: string) => ({ equals: name, mode: 'insensitive' as const });

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === 'P2002';

/**
 * Rooms and shelves are first-class records so items can live directly in them and so the
 * UI can offer them as choices. Bins still name their room and shelf as text (labels, QR
 * codes and the location page are built on those names), so every change here that alters a
 * name or a shelf's room is mirrored onto the bins that use it.
 */
export class InventoryPlaceManager {
  // ---- Lookups -----------------------------------------------------------------------

  async listRooms() {
    const [rooms, bins] = await Promise.all([
      prisma.inventoryRoom.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { shelves: true, items: true } } } }),
      prisma.inventoryBin.findMany({ select: { room: true } })
    ]);
    const binCounts = countBy(bins.map(bin => bin.room?.toLowerCase() ?? ''));
    return rooms.map(room => ({ ...room, binCount: binCounts.get(room.name.toLowerCase()) ?? 0 }));
  }

  async listShelves() {
    const [shelves, bins] = await Promise.all([
      prisma.inventoryShelf.findMany({
        orderBy: [{ room: { name: 'asc' } }, { name: 'asc' }],
        include: { room: { select: { id: true, name: true } }, _count: { select: { items: true } } }
      }),
      prisma.inventoryBin.findMany({ select: { room: true, shelf: true } })
    ]);
    const binCounts = countBy(bins.filter(bin => bin.shelf).map(bin => shelfKey(bin.room, bin.shelf)));
    return shelves.map(shelf => ({ ...shelf, binCount: binCounts.get(shelfKey(shelf.room?.name, shelf.name)) ?? 0 }));
  }

  /** Resolves a place to something displayable, or null when it is empty or no longer exists. */
  async resolvePlace(place: Place | null | undefined): Promise<PlaceRef | null> {
    if (!place) return null;
    if (place.binId) {
      const bin = await prisma.inventoryBin.findUnique({ where: { id: place.binId }, select: { id: true, name: true, room: true, shelf: true } });
      return bin && { kind: 'bin', ...bin };
    }
    if (place.shelfId) {
      const shelf = await prisma.inventoryShelf.findUnique({ where: { id: place.shelfId }, select: { id: true, name: true, room: { select: { name: true } } } });
      return shelf && { kind: 'shelf', id: shelf.id, name: shelf.name, room: shelf.room?.name ?? null, shelf: null };
    }
    if (place.roomId) {
      const room = await prisma.inventoryRoom.findUnique({ where: { id: place.roomId }, select: { id: true, name: true } });
      return room && { kind: 'room', id: room.id, name: room.name, room: null, shelf: null };
    }
    return null;
  }

  /** Throws a 404 if the place names a bin, shelf or room that does not exist. */
  async assertPlaceExists(place: Place): Promise<void> {
    if (place.binId && !(await prisma.inventoryBin.findUnique({ where: { id: place.binId }, select: { id: true } }))) throw createError('Bin not found', 404, 'BIN_NOT_FOUND');
    if (place.shelfId && !(await prisma.inventoryShelf.findUnique({ where: { id: place.shelfId }, select: { id: true } }))) throw createError('Shelf not found', 404, 'SHELF_NOT_FOUND');
    if (place.roomId && !(await prisma.inventoryRoom.findUnique({ where: { id: place.roomId }, select: { id: true } }))) throw createError('Room not found', 404, 'ROOM_NOT_FOUND');
  }

  // ---- Rooms -------------------------------------------------------------------------

  async createRoom(input: { name: string; description?: string | null }) {
    const name = input.name.trim();
    if (await prisma.inventoryRoom.findFirst({ where: { name: insensitive(name) } })) throw createError('A room with that name already exists', 409, 'ROOM_EXISTS');
    return prisma.inventoryRoom.create({ data: { name, description: clean(input.description) } });
  }

  async updateRoom(id: string, input: { name: string; description?: string | null }) {
    const room = await prisma.inventoryRoom.findUnique({ where: { id } });
    if (!room) throw createError('Room not found', 404, 'ROOM_NOT_FOUND');
    const name = input.name.trim();
    if (await prisma.inventoryRoom.findFirst({ where: { name: insensitive(name), NOT: { id } } })) throw createError('A room with that name already exists', 409, 'ROOM_EXISTS');
    try {
      return await prisma.$transaction(async tx => {
        if (name !== room.name) await tx.inventoryBin.updateMany({ where: { room: room.name }, data: { room: name } });
        return tx.inventoryRoom.update({ where: { id }, data: { name, description: clean(input.description) } });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw createError('That name would clash with another room', 409, 'ROOM_EXISTS');
      throw error;
    }
  }

  async deleteRoom(id: string): Promise<void> {
    const room = await prisma.inventoryRoom.findUnique({ where: { id }, include: { _count: { select: { shelves: true, items: true } } } });
    if (!room) throw createError('Room not found', 404, 'ROOM_NOT_FOUND');
    const bins = await prisma.inventoryBin.count({ where: { room: room.name } });
    if (bins || room._count.shelves || room._count.items) {
      throw createError('Move or delete the bins, shelves and items in this room before deleting it', 409, 'ROOM_NOT_EMPTY');
    }
    await prisma.inventoryRoom.delete({ where: { id } });
  }

  // ---- Shelves -----------------------------------------------------------------------

  async createShelf(input: { name: string; roomId?: string | null; description?: string | null }) {
    const name = input.name.trim();
    const roomId = input.roomId || null;
    if (roomId && !(await prisma.inventoryRoom.findUnique({ where: { id: roomId }, select: { id: true } }))) throw createError('Room not found', 404, 'ROOM_NOT_FOUND');
    if (await prisma.inventoryShelf.findFirst({ where: { roomId, name: insensitive(name) } })) throw createError('That shelf already exists in this room', 409, 'SHELF_EXISTS');
    return prisma.inventoryShelf.create({ data: { name, roomId, description: clean(input.description) }, include: { room: { select: { id: true, name: true } } } });
  }

  async updateShelf(id: string, input: { name: string; roomId?: string | null; description?: string | null }) {
    const shelf = await prisma.inventoryShelf.findUnique({ where: { id }, include: { room: { select: { name: true } } } });
    if (!shelf) throw createError('Shelf not found', 404, 'SHELF_NOT_FOUND');
    const name = input.name.trim();
    const roomId = input.roomId === undefined ? shelf.roomId : input.roomId || null;
    const room = roomId ? await prisma.inventoryRoom.findUnique({ where: { id: roomId }, select: { name: true } }) : null;
    if (roomId && !room) throw createError('Room not found', 404, 'ROOM_NOT_FOUND');
    if (await prisma.inventoryShelf.findFirst({ where: { roomId, name: insensitive(name), NOT: { id } } })) throw createError('That shelf already exists in this room', 409, 'SHELF_EXISTS');
    try {
      return await prisma.$transaction(async tx => {
        const oldRoom = shelf.room?.name ?? null;
        const newRoom = room?.name ?? null;
        if (name !== shelf.name || oldRoom !== newRoom) {
          await tx.inventoryBin.updateMany({ where: { room: oldRoom, shelf: shelf.name }, data: { room: newRoom, shelf: name } });
        }
        return tx.inventoryShelf.update({ where: { id }, data: { name, roomId, description: clean(input.description) }, include: { room: { select: { id: true, name: true } } } });
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw createError('A bin with the same name already exists in that room', 409, 'BIN_EXISTS');
      throw error;
    }
  }

  async deleteShelf(id: string): Promise<void> {
    const shelf = await prisma.inventoryShelf.findUnique({ where: { id }, include: { room: { select: { name: true } }, _count: { select: { items: true } } } });
    if (!shelf) throw createError('Shelf not found', 404, 'SHELF_NOT_FOUND');
    const bins = await prisma.inventoryBin.count({ where: { room: shelf.room?.name ?? null, shelf: shelf.name } });
    if (bins || shelf._count.items) throw createError('Move the bins and items off this shelf before deleting it', 409, 'SHELF_NOT_EMPTY');
    await prisma.inventoryShelf.delete({ where: { id } });
  }

  // ---- Bins --------------------------------------------------------------------------

  /**
   * Makes sure the room and shelf a bin names exist in the registry (creating them, so new
   * ones can be typed straight into the bin form) and returns them spelled the way the
   * registry has them, so "lab 1" and "Lab 1" never become two rooms.
   */
  async canonicalizeBinLocation(input: { room?: string | null; shelf?: string | null }, tx: Tx | typeof prisma = prisma): Promise<{ room: string | null; shelf: string | null }> {
    const roomName = clean(input.room);
    const shelfName = clean(input.shelf);
    let room: { id: string; name: string } | null = null;
    if (roomName) {
      room = (await tx.inventoryRoom.findFirst({ where: { name: insensitive(roomName) } })) ?? (await tx.inventoryRoom.create({ data: { name: roomName } }));
    }
    let shelf: { name: string } | null = null;
    if (shelfName) {
      const roomId = room?.id ?? null;
      shelf = (await tx.inventoryShelf.findFirst({ where: { roomId, name: insensitive(shelfName) } })) ?? (await tx.inventoryShelf.create({ data: { name: shelfName, roomId } }));
    }
    return { room: room?.name ?? null, shelf: shelf?.name ?? null };
  }
}

function countBy(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

const shelfKey = (room: string | null | undefined, shelf: string | null | undefined) => `${(room ?? '').toLowerCase()}\u0000${(shelf ?? '').toLowerCase()}`;
