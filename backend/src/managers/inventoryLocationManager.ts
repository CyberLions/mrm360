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

/** An item placed straight on a shelf or in a room rather than in a bin. */
export interface LocationDirectItem extends LocationItem {
  /** The shelf it is on; null when it is in the room itself (or this is a shelf view). */
  shelf: string | null;
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
  /** Items on this shelf, or (room view) in the room or on any of its shelves, outside any bin. */
  directItems: LocationDirectItem[];
  totals: { items: number; available: number };
}

export class InventoryLocationManager {
  /**
   * Everything currently stored in a room, or on one shelf of a room: its bins, plus any
   * items placed directly on the shelf or in the room. Bins name their room and shelf as
   * plain text, so the bin query is by those strings. Holder names are deliberately left
   * out: members only need to know whether something is here to borrow.
   */
  async getLocation(params: { room: string | null; shelf: string | null; binId?: string | null }, viewerId: string): Promise<LocationInventory> {
    const { room, shelf, binId = null } = params;
    const toItem = (item: ItemRow): LocationItem => ({
      id: item.id,
      name: item.name,
      barcode: item.barcode,
      category: item.category?.name ?? null,
      description: item.description,
      status: item.lostAt ? 'lost' : item.checkedOutToId === viewerId ? 'with-you' : item.checkedOutToId ? 'checked-out' : 'available'
    });

    const [bins, directRows] = await Promise.all([
      prisma.inventoryBin.findMany({
        where: binId ? { id: binId } : { room, ...(shelf ? { shelf } : {}) },
        orderBy: [{ shelf: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          room: true,
          shelf: true,
          code: true,
          description: true,
          items: { orderBy: [{ name: 'asc' }, { barcode: 'asc' }], select: itemSelect }
        }
      }),
      binId
        ? Promise.resolve([] as DirectRow[])
        : prisma.inventoryItem.findMany({
            where: directItemsWhere(room, shelf),
            orderBy: [{ name: 'asc' }, { barcode: 'asc' }],
            select: { ...itemSelect, shelf: { select: { name: true } } }
          })
    ]);

    // A room or shelf can exist with nothing in it yet; only a place nobody has heard of is a 404.
    if (!bins.length && !directRows.length && !(await this.placeExists(room, shelf, binId))) {
      throw createError('No bins found in that location', 404, 'NOT_FOUND');
    }

    const result = bins.map<LocationBin>(bin => ({
      id: bin.id,
      name: bin.name,
      shelf: bin.shelf,
      code: bin.code,
      description: bin.description,
      items: bin.items.map(toItem)
    }));
    const directItems = directRows.map<LocationDirectItem>(item => ({ ...toItem(item), shelf: shelf ? null : item.shelf?.name ?? null }));
    const all = [...result.flatMap(bin => bin.items), ...directItems];
    // A bin view reports the bin's own room and shelf so the page can show where it lives.
    return {
      room: binId ? bins[0].room : room,
      shelf: binId ? bins[0].shelf : shelf,
      binId,
      bins: result,
      directItems,
      totals: { items: all.length, available: all.filter(i => i.status === 'available').length }
    };
  }

  private async placeExists(room: string | null, shelf: string | null, binId: string | null): Promise<boolean> {
    if (binId) return false;
    if (shelf) return !!(await prisma.inventoryShelf.findFirst({ where: { name: shelf, room: room ? { name: room } : null }, select: { id: true } }));
    return !!room && !!(await prisma.inventoryRoom.findFirst({ where: { name: room }, select: { id: true } }));
  }
}

const itemSelect = {
  id: true,
  name: true,
  barcode: true,
  description: true,
  checkedOutToId: true,
  lostAt: true,
  category: { select: { name: true } }
} as const;

type ItemRow = {
  id: string;
  name: string;
  barcode: string;
  description: string | null;
  checkedOutToId: string | null;
  lostAt: Date | null;
  category: { name: string } | null;
};
type DirectRow = ItemRow & { shelf: { name: string } | null };

/** Items sitting straight on the shelf, or in the room / on any of its shelves. */
function directItemsWhere(room: string | null, shelf: string | null) {
  if (shelf) return { shelf: { name: shelf, room: room ? { name: room } : null } };
  return { OR: [{ room: { name: room! } }, { shelf: { room: { name: room! } } }] };
}
