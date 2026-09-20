export interface BinRef {
  name: string
  room?: string | null
  shelf?: string | null
}

/** "Lab 1 · Shelf 2 · Switch Bin": where a bin lives, then its name. */
export function binLabel(bin: BinRef | null | undefined, fallback = 'No bin'): string {
  if (!bin) return fallback
  const parts = [bin.room, bin.shelf ? `Shelf ${bin.shelf}` : ''].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} · ${bin.name}` : bin.name
}

export interface PlaceLike {
  kind: 'bin' | 'shelf' | 'room'
  name: string
  room?: string | null
  shelf?: string | null
}

/**
 * How a bin, shelf or room reads in a list: "Lab 1 · Shelf 2 · Switch Bin", "Lab 1 · Shelf 2"
 * or "Lab 1".
 */
export function placeLabel(place: PlaceLike | null | undefined, fallback = 'Unassigned'): string {
  if (!place) return fallback
  if (place.kind === 'bin') return binLabel(place, fallback)
  if (place.kind === 'room') return place.name
  return [place.room, `Shelf ${place.name}`].filter(Boolean).join(' · ')
}

/** Where an item currently is, from the bin, shelf or room loaded onto it. */
export function itemPlaceLabel(
  item: {
    bin?: { name: string; room?: string | null; shelf?: string | null } | null
    shelf?: { name: string; room?: { name: string } | null } | null
    room?: { name: string } | null
  },
  fallback = 'Unassigned',
): string {
  if (item.bin) return placeLabel({ kind: 'bin', ...item.bin })
  if (item.shelf) return placeLabel({ kind: 'shelf', name: item.shelf.name, room: item.shelf.room?.name })
  if (item.room) return item.room.name
  return fallback
}
