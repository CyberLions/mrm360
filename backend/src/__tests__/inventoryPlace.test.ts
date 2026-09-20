import { describe, expect, it } from 'vitest';
import { lastKnownPlace, pickReturnPlace, toPlace, NO_PLACE } from '../utils/inventoryPlace';

const bin = (id: string) => ({ binId: id, shelfId: null, roomId: null });
const shelf = (id: string) => ({ binId: null, shelfId: id, roomId: null });
const room = (id: string) => ({ binId: null, shelfId: null, roomId: id });
const none = { from: null, lastReturn: null, current: null };

describe('pickReturnPlace', () => {
  it('returns the item to where it was checked out from by default', () => {
    expect(pickReturnPlace({ requested: undefined, from: bin('from'), lastReturn: bin('ret'), current: bin('cur') })).toEqual(bin('from'));
  });
  it('falls back to the previous return, then the current place, then nowhere', () => {
    expect(pickReturnPlace({ requested: undefined, ...none, lastReturn: bin('ret'), current: bin('cur') })).toEqual(bin('ret'));
    expect(pickReturnPlace({ requested: undefined, ...none, current: bin('cur') })).toEqual(bin('cur'));
    expect(pickReturnPlace({ requested: undefined, ...none })).toEqual(NO_PLACE);
  });
  it('remembers shelves and rooms, not just bins', () => {
    expect(pickReturnPlace({ requested: undefined, ...none, from: shelf('s1') })).toEqual(shelf('s1'));
    expect(pickReturnPlace({ requested: undefined, ...none, from: NO_PLACE, lastReturn: room('r1') })).toEqual(room('r1'));
  });
  it('lets an explicit place win, and treats an explicit empty place as "nowhere"', () => {
    expect(pickReturnPlace({ requested: shelf('picked'), ...none, from: bin('from') })).toEqual(shelf('picked'));
    expect(pickReturnPlace({ requested: NO_PLACE, ...none, from: bin('from') })).toEqual(NO_PLACE);
  });
});

describe('lastKnownPlace', () => {
  it('prefers the checkout place, then the last return, then the current place', () => {
    expect(lastKnownPlace({ from: bin('from'), lastReturn: bin('ret'), current: bin('cur') })).toEqual(bin('from'));
    expect(lastKnownPlace({ from: NO_PLACE, lastReturn: shelf('ret'), current: bin('cur') })).toEqual(shelf('ret'));
    expect(lastKnownPlace({ from: undefined, lastReturn: undefined, current: room('cur') })).toEqual(room('cur'));
    expect(lastKnownPlace(none)).toEqual(NO_PLACE);
  });
});

describe('toPlace', () => {
  it('fills in missing ids as null', () => {
    expect(toPlace({ shelfId: 's1' })).toEqual(shelf('s1'));
    expect(toPlace({ binId: '' })).toEqual(NO_PLACE);
  });
  it('rejects more than one place', () => {
    expect(toPlace({ binId: 'b', shelfId: 's' })).toBeNull();
  });
});
