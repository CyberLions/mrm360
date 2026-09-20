/**
 * Where an item goes when it is checked in.
 *
 * An explicit choice wins (null means "no bin"). Otherwise it goes back to the
 * bin it was checked out from, then the bin of its most recent return, then
 * whatever bin it currently has.
 */
export function pickReturnBinId(input: {
  requested: string | null | undefined;
  fromBinId: string | null | undefined;
  lastReturnBinId: string | null | undefined;
  currentBinId: string | null | undefined;
}): string | null {
  if (input.requested !== undefined) return input.requested;
  return input.fromBinId ?? input.lastReturnBinId ?? input.currentBinId ?? null;
}

/** The bin an item was last known to live in, before this check-in. */
export function lastKnownBinId(input: {
  fromBinId: string | null | undefined;
  lastReturnBinId: string | null | undefined;
  currentBinId: string | null | undefined;
}): string | null {
  return input.fromBinId ?? input.lastReturnBinId ?? input.currentBinId ?? null;
}
