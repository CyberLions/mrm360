import { randomInt } from 'crypto';

// Uppercase letters and digits minus the ones people confuse on a printed label (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** First `length` letters/digits of `text`, uppercased ("Polo - XL" -> "POL"); `fallback` if there are none. */
export function barcodePart(text: string | null | undefined, length: number, fallback: string): string {
  const cleaned = (text ?? '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, length) || fallback;
}

export function randomCode(length: number, pick: (max: number) => number = randomInt): string {
  return Array.from({ length }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]).join('');
}

/**
 * Short, human-readable barcode: <category>-<title>-<random>, e.g. APP-POL-K7M for
 * "Polo - XL" in "Apparel". 11 characters instead of the old 17, so the printed
 * Code 128 has far fewer bars and prints bigger and easier to scan.
 */
export function generateItemBarcode(
  parts: { name?: string | null; category?: string | null },
  randomLength = 3,
  pick?: (max: number) => number
): string {
  return `${barcodePart(parts.category, 3, 'GEN')}-${barcodePart(parts.name, 3, 'ITM')}-${randomCode(randomLength, pick)}`;
}
