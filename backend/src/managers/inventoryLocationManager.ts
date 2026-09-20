import { prisma } from '@/models/prismaClient';
import { createError } from '@/middleware/errorHandler';

export type LocationItemStatus = 'available' | 'checked-out' | 'with-you' | 'lost';

export interface LocationItem {
  id: string;
  name: string;
  barcode: string;
  category: string | null;
  description: string | null;
  status: LocationItemStatus;
}

export interface LocationBin {
  id: string;
  name: string;
  shelf: string | null;
  code: string | null;
  description: string | null;
  items: LocationItem[];
}

export interface LocationInventory {
  room: string | null;
  shelf: string | null;
  /** Set when the view is a single bin. */
  binId: string | null;
  bins: LocationBin[];
  totals: { items: number; available: number };
}

export class InventoryLocationManager {
  /**
   * Everything currently stored in a room, or on one shelf of a room. Rooms and
   * shelves are plain text on bins, so this is a bin query by those strings.
   * Holder names are deliberately left out: members only need to know whether
   * something is here to borrow.
   */
  async getLocation(params: { room: string | null; shelf: string | null; binId?: string | null }, viewerId: string): Promise<LocationInventory> {
    const { room, shelf, binId = null } = params;
    const bins = await prisma.inventoryBin.findMany({
      where: binId ? { id: binId } : { room, ...(shelf ? { shelf } : {}) },
      orderBy: [{ shelf: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        room: true,
        shelf: true,
        code: true,
        description: true,
        items: {
          orderBy: [{ name: 'asc' }, { barcode: 'asc' }],
          select: { id: true, name: true, barcode: true, description: true, checkedOutToId: true, lostAt: true, category: { select: { name: true } } }
        }
      }
    });
    if (!bins.length) throw createError('No bins found in that location', 404, 'NOT_FOUND');

    const result = bins.map<LocationBin>(bin => ({
      id: bin.id,
      name: bin.name,
      shelf: bin.shelf,
      code: bin.code,
      description: bin.description,
      items: bin.items.map<LocationItem>(item => ({
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        category: item.category?.name ?? null,
        description: item.description,
        status: item.lostAt ? 'lost' : item.checkedOutToId === viewerId ? 'with-you' : item.checkedOutToId ? 'checked-out' : 'available'
      }))
    }));
    const all = result.flatMap(bin => bin.items);
    // A bin view reports the bin's own room and shelf so the page can show where it lives.
    return { room: binId ? bins[0].room : room, shelf: binId ? bins[0].shelf : shelf, binId, bins: result, totals: { items: all.length, available: all.filter(i => i.status === 'available').length } };
  }
}
