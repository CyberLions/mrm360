import type { InventoryPlaceIds } from '@/types/api'

export const NO_PLACE: InventoryPlaceIds = { binId: null, shelfId: null, roomId: null }

/**
 * A place packed into one string so it can be a <select> value or a board column id:
 * "bin:<id>", "shelf:<id>", "room:<id>", or "" for nowhere.
 */
export function placeValue(place: Partial<InventoryPlaceIds> | null | undefined): string {
  if (place?.binId) return `bin:${place.binId}`
  if (place?.shelfId) return `shelf:${place.shelfId}`
  if (place?.roomId) return `room:${place.roomId}`
  return ''
}

export function parsePlaceValue(value: string): InventoryPlaceIds {
  const [kind, ...rest] = value.split(':')
  const id = rest.join(':')
  if (!id) return { ...NO_PLACE }
  return {
    binId: kind === 'bin' ? id : null,
    shelfId: kind === 'shelf' ? id : null,
    roomId: kind === 'room' ? id : null,
  }
}
