import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { matchedQrSymbols, renderLabelPdf, renderLocationLabelPdf } from '../services/inventoryLabelRenderer';
import { LABEL_TEMPLATES, buildLocationUrl, describeLocation, labelFilename } from '../services/inventoryLabelTemplates';

const items = [
  { barcode: 'ITEM-1A2B3C4D5E6F', name: 'Cisco Catalyst 2960-X 48-Port Switch', categoryName: 'Networking' },
  { barcode: 'ITEM-9F8E7D6C5B4A', name: 'Fluke Multimeter', categoryName: null },
];

describe('renderLabelPdf', () => {
  it.each(LABEL_TEMPLATES.map(t => [t.id, t.widthIn, t.heightIn] as const))(
    '%s renders one correctly-sized page per item',
    async (id, widthIn, heightIn) => {
      const doc = await PDFDocument.load(await renderLabelPdf(items, id));
      expect(doc.getPageCount()).toBe(items.length);
      expect(doc.getPage(0).getSize()).toEqual({ width: widthIn * 72, height: heightIn * 72 });
    }
  );

  it('reports progress after every label', async () => {
    const onProgress = vi.fn();
    await renderLabelPdf(items, '3x2-two-column', { onProgress });
    expect(onProgress.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it('survives names the standard PDF fonts cannot encode', async () => {
    const pdf = await renderLabelPdf(
      [{ barcode: 'ITEM-000000000001', name: 'Café ✓ 日本 router\nwith newline', categoryName: '🔧 Tools' }],
      '4x6-large'
    );
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it('handles very long names and unbreakable words', async () => {
    const pdf = await renderLabelPdf(
      [{ barcode: 'ITEM-000000000001', name: `${'W'.repeat(120)} ${'long '.repeat(60)}`, categoryName: 'C'.repeat(200) }],
      '3x2-two-column'
    );
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });

  it('rejects barcodes Code 128 cannot encode, naming the value', async () => {
    await expect(renderLabelPdf([{ barcode: 'ITEM-日本', name: 'x' }], '3x2-two-column')).rejects.toThrow(/ITEM-日本/);
  });
});

describe('labelFilename', () => {
  it('includes the size and date', () => {
    expect(labelFilename('3x2-two-column', new Date('2026-09-20T12:00:00Z'))).toBe('inventory-labels-3x2-2026-09-20.pdf');
  });
});

describe('renderLocationLabelPdf', () => {
  const locations = [
    { room: 'Lab 1', shelf: '2' },
    { room: 'Networking Closet B-114', shelf: null },
    { room: null, shelf: 'Café ✓ 日本 and a very long shelf name that keeps going and going' },
    { room: 'Lab 1', shelf: '2', bin: { id: 'bin-1', name: 'Switch Bin' } },
    { room: null, shelf: null, bin: { id: 'bin-2', name: 'A bin with an extremely long descriptive name that needs to wrap and shrink' } },
  ];

  it.each(LABEL_TEMPLATES.map(t => [t.id, t.widthIn, t.heightIn] as const))(
    '%s renders one correctly-sized page per location',
    async (id, widthIn, heightIn) => {
      const onProgress = vi.fn();
      const doc = await PDFDocument.load(await renderLocationLabelPdf(locations, 'https://mrm.example', id, { onProgress }));
      expect(doc.getPageCount()).toBe(locations.length);
      expect(doc.getPage(0).getSize()).toEqual({ width: widthIn * 72, height: heightIn * 72 });
      expect(onProgress).toHaveBeenCalledTimes(locations.length);
    }
  );
});

describe('label notices', () => {
  it('shelf/room labels say items (plural); item labels keep "this item"', async () => {
    const { LOCATION_WARNING, LABEL_WARNING } = await import('../services/inventoryLabelTemplates');
    expect(LOCATION_WARNING).toBe('Not properly checking items in and out is theft.');
    expect(LABEL_WARNING).toBe('Not properly checking this item in/out is theft.');
  });
});

describe('location helpers', () => {
  it('builds URLs with encoded room and optional shelf, tolerating a trailing slash', () => {
    expect(buildLocationUrl('https://mrm.example/', { room: 'Lab 1', shelf: '2' })).toBe('https://mrm.example/inventory/location?room=Lab+1&shelf=2');
    expect(buildLocationUrl('https://mrm.example', { room: 'A&B', shelf: null })).toBe('https://mrm.example/inventory/location?room=A%26B');
    expect(buildLocationUrl('https://mrm.example', { room: null, shelf: '3' })).toBe('https://mrm.example/inventory/location?shelf=3');
    // Bins are addressed by id so renaming the bin or moving it doesn't break its label.
    expect(buildLocationUrl('https://mrm.example', { room: 'Lab 1', shelf: '2', bin: { id: 'abc123', name: 'Switch Bin' } })).toBe(
      'https://mrm.example/inventory/location?bin=abc123'
    );
  });

  it('describes shelves and rooms', () => {
    expect(describeLocation({ room: 'Lab 1', shelf: '2' })).toEqual({ kind: 'SHELF', title: 'Shelf 2', subtitle: 'Lab 1' });
    expect(describeLocation({ room: 'Lab 1', shelf: null })).toEqual({ kind: 'ROOM', title: 'Lab 1', subtitle: '' });
    expect(describeLocation({ room: 'Lab 1', shelf: '2', bin: { id: 'b', name: 'Switch Bin' } })).toEqual({ kind: 'BIN', title: 'Switch Bin', subtitle: 'Lab 1 · Shelf 2' });
    expect(describeLocation({ room: null, shelf: null, bin: { id: 'b', name: 'Loose' } })).toEqual({ kind: 'BIN', title: 'Loose', subtitle: '' });
  });
});

describe('matchedQrSymbols', () => {
  it('gives short and long URLs the same module count so they print the same size', () => {
    const short = 'https://mrm.psuccso.org/inventory/kiosk';
    const long = 'https://mrm.psuccso.org/inventory/location?room=Networking+Closet+B-114&shelf=Top+Left+Rack+Number+Seven';
    const [a, b] = matchedQrSymbols([short, long]);
    expect(a.pixx).toBe(b.pixx);
    expect(a.pixy).toBe(b.pixy);
    expect(a.pixx).toBeGreaterThan(29); // the short URL alone is 29 modules; it was enlarged to match
  });

  it('leaves already-equal symbols untouched', () => {
    const [a, b] = matchedQrSymbols(['https://x.example/a', 'https://x.example/b']);
    expect(a.pixx).toBe(b.pixx);
  });
});
