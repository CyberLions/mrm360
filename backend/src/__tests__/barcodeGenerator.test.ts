import { describe, expect, it } from 'vitest';
import { barcodePart, generateItemBarcode, randomCode } from '../utils/barcodeGenerator';

describe('barcodePart', () => {
  it('takes the first letters/digits, uppercased, ignoring punctuation and spaces', () => {
    expect(barcodePart('Polo - XL', 3, 'ITM')).toBe('POL');
    expect(barcodePart('  ..Apparel', 3, 'GEN')).toBe('APP');
    expect(barcodePart('4K Monitor', 3, 'ITM')).toBe('4KM');
  });
  it('uses the fallback for empty or symbol-only input', () => {
    expect(barcodePart('', 3, 'ITM')).toBe('ITM');
    expect(barcodePart(undefined, 3, 'GEN')).toBe('GEN');
    expect(barcodePart('---', 3, 'ITM')).toBe('ITM');
    expect(barcodePart('日本', 3, 'ITM')).toBe('ITM');
  });
  it('keeps short input as is', () => {
    expect(barcodePart('PC', 3, 'ITM')).toBe('PC');
  });
});

describe('randomCode', () => {
  it('never uses ambiguous characters', () => {
    const code = randomCode(2000);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]+$/);
    expect(code).not.toMatch(/[01ILO]/);
  });
  it('is deterministic for an injected picker', () => {
    expect(randomCode(3, () => 0)).toBe('AAA');
  });
});

describe('generateItemBarcode', () => {
  it('builds category-title-random, e.g. APP-POL-XXX, 11 chars', () => {
    const code = generateItemBarcode({ name: 'Polo - XL', category: 'Apparel' });
    expect(code).toMatch(/^APP-POL-[A-HJKMNP-Z2-9]{3}$/);
    expect(code).toHaveLength(11);
  });
  it('falls back to GEN / ITM and supports longer random parts', () => {
    expect(generateItemBarcode({}, 4)).toMatch(/^GEN-ITM-[A-HJKMNP-Z2-9]{4}$/);
  });
  it('is always printable ASCII, so Code 128 can encode it', () => {
    for (let i = 0; i < 200; i++) expect(generateItemBarcode({ name: 'Café ✓ ñ', category: 'Ünï' })).toMatch(/^[\x20-\x7E]+$/);
  });
  it('is much shorter than the old ITEM-<12 hex> format', () => {
    expect(generateItemBarcode({ name: 'x', category: 'y' }).length).toBeLessThan('ITEM-DF91D0FF2957'.length);
  });
});
