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
