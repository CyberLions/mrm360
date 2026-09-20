import { describe, expect, it } from 'vitest';
import { lastKnownBinId, pickReturnBinId } from '../utils/inventoryBins';

const none = { fromBinId: null, lastReturnBinId: null, currentBinId: null };

describe('pickReturnBinId', () => {
  it('returns the item to the bin it was checked out from by default', () => {
    expect(pickReturnBinId({ requested: undefined, ...none, fromBinId: 'from', lastReturnBinId: 'ret', currentBinId: 'cur' })).toBe('from');
  });
  it('falls back to the previous return, then the current bin, then none', () => {
    expect(pickReturnBinId({ requested: undefined, ...none, lastReturnBinId: 'ret', currentBinId: 'cur' })).toBe('ret');
    expect(pickReturnBinId({ requested: undefined, ...none, currentBinId: 'cur' })).toBe('cur');
    expect(pickReturnBinId({ requested: undefined, ...none })).toBeNull();
  });
  it('lets an explicit bin win, and treats an explicit null as "no bin"', () => {
    expect(pickReturnBinId({ requested: 'picked', ...none, fromBinId: 'from' })).toBe('picked');
    expect(pickReturnBinId({ requested: null, ...none, fromBinId: 'from' })).toBeNull();
  });
});

describe('lastKnownBinId', () => {
  it('prefers the checkout bin, then the last return, then the current bin', () => {
    expect(lastKnownBinId({ fromBinId: 'from', lastReturnBinId: 'ret', currentBinId: 'cur' })).toBe('from');
    expect(lastKnownBinId({ fromBinId: null, lastReturnBinId: 'ret', currentBinId: 'cur' })).toBe('ret');
    expect(lastKnownBinId({ fromBinId: undefined, lastReturnBinId: undefined, currentBinId: 'cur' })).toBe('cur');
    expect(lastKnownBinId(none)).toBeNull();
  });
});
