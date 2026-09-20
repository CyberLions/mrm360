/**
 * An item lives in at most one place: a bin, directly on a shelf, or directly in a room.
 * A place is always passed around as all three ids, with at most one set.
 */
export interface Place {
  binId: string | null;
  shelfId: string | null;
  roomId: string | null;
}

export const NO_PLACE: Place = { binId: null, shelfId: null, roomId: null };

export type PlaceInput = { binId?: string | null; shelfId?: string | null; roomId?: string | null };

export const hasPlace = (place: PlaceInput | null | undefined): boolean =>
  !!place && !!(place.binId || place.shelfId || place.roomId);

/** True when the request names a place at all (even "nowhere", i.e. all ids null). */
export const mentionsPlace = (input: PlaceInput): boolean =>
  input.binId !== undefined || input.shelfId !== undefined || input.roomId !== undefined;

/**
 * Normalises a request's location fields to a full Place. Returns null when more than one of
 * bin/shelf/room is set, since an item can only be in one.
 */
export function toPlace(input: PlaceInput): Place | null {
  const place = { binId: input.binId || null, shelfId: input.shelfId || null, roomId: input.roomId || null };
  return [place.binId, place.shelfId, place.roomId].filter(Boolean).length > 1 ? null : place;
}

const firstPlace = (...places: Array<PlaceInput | null | undefined>): Place => {
  const found = places.find(hasPlace);
  return found ? { binId: found.binId || null, shelfId: found.shelfId || null, roomId: found.roomId || null } : NO_PLACE;
};

interface ReturnMemory {
  /** Where the item was when it was checked out. */
  from: PlaceInput | null | undefined;
  /** Where it went on its most recent previous return. */
  lastReturn: PlaceInput | null | undefined;
  /** Where it is recorded as being now. */
  current: PlaceInput | null | undefined;
}

/**
 * Where an item goes when it is checked in.
 *
 * An explicit choice wins (all ids null means "nowhere"). Otherwise it goes back to where it
 * was checked out from, then where its most recent return went, then wherever it is now.
 */
export function pickReturnPlace(input: ReturnMemory & { requested: Place | null | undefined }): Place {
  if (input.requested) return input.requested;
  return firstPlace(input.from, input.lastReturn, input.current);
}

/** The place an item was last known to live in, before this check-in. */
export function lastKnownPlace(input: ReturnMemory): Place {
  return firstPlace(input.from, input.lastReturn, input.current);
}

export type PlaceKind = 'bin' | 'shelf' | 'room';

/** A place resolved for display: what it is, its name, and where it sits. */
export interface PlaceRef {
  kind: PlaceKind;
  id: string;
  name: string;
  room: string | null;
  shelf: string | null;
}

/** "Lab 1 – Switch Bin", "Lab 1 – Shelf A" or "Lab 1": how a place reads in emails. */
export function formatPlace(place: PlaceRef | null | undefined): string | undefined {
  if (!place) return undefined;
  if (place.kind === 'room') return place.name;
  const name = place.kind === 'shelf' ? `Shelf ${place.name}` : place.name;
  return [place.room, place.kind === 'bin' && place.shelf ? `Shelf ${place.shelf}` : null, name].filter(Boolean).join(' – ');
}
