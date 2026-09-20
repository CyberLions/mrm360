import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { renderLabelPdf } from '../services/inventoryLabelRenderer';
import { LABEL_TEMPLATES, labelFilename } from '../services/inventoryLabelTemplates';

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
