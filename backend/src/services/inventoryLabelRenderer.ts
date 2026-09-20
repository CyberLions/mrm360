import { readFile } from 'fs/promises';
import path from 'path';
// Default import on purpose: bwip-js 4.11's ESM build shadows the named `raw` export with a BWIPP encoder.
import bwipjs from 'bwip-js/node';
import type { RawOptions } from 'bwip-js/node';
import {
  PDFDocument,
  PDFEmbeddedPage,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingGrayscaleColor
} from 'pdf-lib';
import {
  LOCATION_CHECKIN_INSTRUCTIONS,
  LOCATION_CHECKOUT_INSTRUCTIONS,
  LOCATION_INSTRUCTIONS_SHORT,
  LOCATION_KIOSK_CAPTION,
  LOCATION_WARNING,
  LOCATION_LOOKUP_CAPTION,
  buildKioskUrl,
  LocationLabelSpec,
  buildLocationUrl,
  describeLocation,
  LABEL_OWNER,
  LABEL_REPORT,
  LABEL_WARNING,
  LOST_ITEM_DISPLAY,
  LOST_ITEM_URL,
  LabelTemplateId,
  LabelTemplateInfo,
  getLabelTemplate
} from './inventoryLabelTemplates';

export interface LabelItem {
  barcode: string;
  name: string;
  categoryName?: string | null;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
}

interface LabelContext {
  page: PDFPage;
  fonts: Fonts;
  logo: PDFImage;
  qr: { page: PDFEmbeddedPage; modules: number };
  width: number;
  height: number;
  /** Size of one printer dot in PDF points. */
  dot: number;
}

const PT_PER_IN = 72;
const MARGIN_PT = 8;
const LEADING = 1.15;
const LOGO_PATH = path.join(process.cwd(), 'assets', 'inventory-labels', 'logo-bw.png');

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

// Standard PDF fonts only cover WinAnsi; anything else makes pdf-lib throw.
function makeSafeText(font: PDFFont) {
  const cache = new Map<string, string>();
  const safeChar = (ch: string): string => {
    const hit = cache.get(ch);
    if (hit !== undefined) return hit;
    let out = '?';
    for (const candidate of [ch, ch.normalize('NFD')[0]]) {
      try {
        font.widthOfTextAtSize(candidate, 1);
        out = candidate;
        break;
      } catch {
        // try the next candidate
      }
    }
    cache.set(ch, out);
    return out;
  };
  return (text: string) => Array.from(text.replace(/\s+/g, ' ').trim()).map(safeChar).join('');
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const widthOf = (s: string) => font.widthOfTextAtSize(s, size);
  const lines: string[] = [];
  let current = '';
  for (let word of text.split(' ').filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    // Break words that are wider than the column on their own.
    while (widthOf(word) > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && widthOf(word.slice(0, cut)) > maxWidth) cut--;
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function ellipsize(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) out = out.slice(0, -1);
  return `${out}...`;
}

/**
 * Largest font size (down to minSize) at which the text fits in maxLines and,
 * if given, maxHeight; truncates as a last resort.
 */
function fitParagraph(
  text: string,
  font: PDFFont,
  opts: { maxSize: number; minSize: number; maxWidth: number; maxLines: number; maxHeight?: number }
): { lines: string[]; size: number } {
  for (let size = opts.maxSize; size >= opts.minSize; size -= 0.5) {
    const lines = wrapLines(text, font, size, opts.maxWidth);
    if (lines.length <= opts.maxLines && lines.length * size * LEADING <= (opts.maxHeight ?? Infinity)) return { lines, size };
  }
  const lines = wrapLines(text, font, opts.minSize, opts.maxWidth).slice(0, opts.maxLines);
  lines[lines.length - 1] = ellipsize(lines[lines.length - 1], font, opts.minSize, opts.maxWidth);
  return { lines, size: opts.minSize };
}

function fitLine(text: string, font: PDFFont, maxSize: number, minSize: number, maxWidth: number): { text: string; size: number } {
  for (let size = maxSize; size >= minSize; size -= 0.25) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };
  }
  return { text: ellipsize(text, font, minSize, maxWidth), size: minSize };
}

/** Draws a wrapped paragraph with its first baseline just below `top`; returns the y under its last line. */
function drawParagraph(page: PDFPage, paragraph: { lines: string[]; size: number }, font: PDFFont, x: number, top: number): number {
  let y = top;
  for (const line of paragraph.lines) {
    y -= paragraph.size;
    page.drawText(line, { x, y, size: paragraph.size, font, color: rgb(0, 0, 0) });
    y -= paragraph.size * (LEADING - 1);
  }
  return y;
}

/** Draws text horizontally centred in [x, x + width]; y is the baseline. */
function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, x: number, width: number, y: number) {
  page.drawText(text, { x: x + (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color: rgb(0, 0, 0) });
}

// ---------------------------------------------------------------------------
// Barcode / QR
// ---------------------------------------------------------------------------

/** Rounds a point to the nearest printer dot; pages are a whole number of dots, so this aligns with the head. */
function snapToDots(ctx: LabelContext, x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x / ctx.dot) * ctx.dot, y: Math.round(y / ctx.dot) * ctx.dot };
}

/**
 * Draws a Code 128 barcode as vector bars. When the box is wide enough for
 * >= 2 printer dots per module the module width is snapped to whole dots so
 * bars don't alias on the thermal printhead.
 */
function drawCode128(ctx: LabelContext, value: string, box: { x: number; y: number; width: number; height: number }) {
  // Stick to printable ASCII so what a scanner reads back is exactly the stored value.
  if (!/^[\x20-\x7E]+$/.test(value)) {
    throw new Error(`Barcode "${value}" cannot be printed as Code 128 (only printable ASCII is supported)`);
  }
  const [{ sbs }] = bwipjs.raw({ bcid: 'code128', text: value }) as Array<{ sbs: number[] }>;
  const modules = sbs.reduce((sum, w) => sum + w, 0);
  let moduleWidth = box.width / modules;
  const dotsPerModule = moduleWidth / ctx.dot;
  if (dotsPerModule >= 2) moduleWidth = Math.floor(dotsPerModule) * ctx.dot;

  let x = box.x + (box.width - moduleWidth * modules) / 2;
  let y = box.y;
  // Whole-dot modules only stay crisp if the bars also start on a dot boundary.
  if (dotsPerModule >= 2) ({ x, y } = snapToDots(ctx, x, y));
  const ops = [pushGraphicsState(), setFillingGrayscaleColor(0)];
  sbs.forEach((width, i) => {
    if (i % 2 === 0) ops.push(rectangle(x, y, width * moduleWidth, box.height));
    x += width * moduleWidth;
  });
  ops.push(fill(), popGraphicsState());
  ctx.page.pushOperators(...ops);
}

/** Builds the QR once as a tiny one-page PDF (1 pt per module) that every label embeds. */
async function embedQr(doc: PDFDocument, text: string): Promise<{ page: PDFEmbeddedPage; modules: number }> {
  const options: RawOptions & { eclevel: string } = { bcid: 'qrcode', text, eclevel: 'M' };
  const [symbol] = bwipjs.raw(options) as Array<{ pixs: number[]; pixx: number; pixy: number }>;
  const qrDoc = await PDFDocument.create();
  const qrPage = qrDoc.addPage([symbol.pixx, symbol.pixy]);
  const ops = [pushGraphicsState(), setFillingGrayscaleColor(0)];
  for (let row = 0; row < symbol.pixy; row++) {
    for (let col = 0; col < symbol.pixx; col++) {
      // bwip-js rows run top to bottom; PDF y runs bottom to top.
      if (symbol.pixs[row * symbol.pixx + col]) ops.push(rectangle(col, symbol.pixy - 1 - row, 1, 1));
    }
  }
  ops.push(fill(), popGraphicsState());
  qrPage.pushOperators(...ops);
  const [embedded] = await doc.embedPdf(qrDoc);
  return { page: embedded, modules: symbol.pixx };
}

/** Draws the lost-item QR at most `maxSize` wide (whole-dot modules when possible); returns the size used. */
function drawQr(ctx: LabelContext, box: { x: number; y: number; size: number }): number {
  const { modules } = ctx.qr;
  let moduleSize = box.size / modules;
  const dotsPerModule = moduleSize / ctx.dot;
  if (dotsPerModule >= 1) moduleSize = Math.floor(dotsPerModule) * ctx.dot;
  const size = moduleSize * modules;
  const origin = dotsPerModule >= 1 ? snapToDots(ctx, box.x + (box.size - size) / 2, box.y) : { x: box.x + (box.size - size) / 2, y: box.y };
  ctx.page.drawPage(ctx.qr.page, { x: origin.x, y: origin.y, width: size, height: size });
  return size;
}

interface QrSymbol {
  pixs: number[];
  pixx: number;
  pixy: number;
}

/** Encodes text as a QR symbol; `version` forces a larger symbol than the text needs. */
function qrSymbol(text: string, version?: number): QrSymbol {
  const options: RawOptions & { eclevel: string; version?: number } = { bcid: 'qrcode', text, eclevel: 'M', ...(version ? { version } : {}) };
  return (bwipjs.raw(options) as QrSymbol[])[0];
}

/** Draws a QR symbol as vector modules (whole-dot modules when possible); returns the size used. */
function drawQrSymbol(ctx: LabelContext, symbol: QrSymbol, box: { x: number; y: number; size: number }): number {
  let moduleSize = box.size / symbol.pixx;
  const dotsPerModule = moduleSize / ctx.dot;
  if (dotsPerModule >= 1) moduleSize = Math.floor(dotsPerModule) * ctx.dot;
  const size = moduleSize * symbol.pixx;
  let x0 = box.x + (box.size - size) / 2;
  let y0 = box.y;
  if (dotsPerModule >= 1) ({ x: x0, y: y0 } = snapToDots(ctx, x0, y0));
  const ops = [pushGraphicsState(), setFillingGrayscaleColor(0)];
  for (let row = 0; row < symbol.pixy; row++) {
    for (let col = 0; col < symbol.pixx; col++) {
      // bwip-js rows run top to bottom; PDF y runs bottom to top.
      if (symbol.pixs[row * symbol.pixx + col]) ops.push(rectangle(x0 + col * moduleSize, y0 + (symbol.pixy - 1 - row) * moduleSize, moduleSize, moduleSize));
    }
  }
  ops.push(fill(), popGraphicsState());
  ctx.page.pushOperators(...ops);
  return size;
}

/** Encodes several texts at one shared QR version so they have the same module count, and so print at the same size. */
export function matchedQrSymbols(texts: string[]): QrSymbol[] {
  const symbols = texts.map(text => qrSymbol(text));
  const modules = Math.max(...symbols.map(s => s.pixx));
  const version = (modules - 17) / 4;
  return symbols.map((symbol, i) => (symbol.pixx === modules ? symbol : qrSymbol(texts[i], version)));
}

function drawLogo(ctx: LabelContext, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(box.width / ctx.logo.width, box.height / ctx.logo.height);
  const width = ctx.logo.width * scale;
  const height = ctx.logo.height * scale;
  ctx.page.drawImage(ctx.logo, {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height
  });
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------

interface LayoutItem {
  /** Exact value encoded in the barcode. */
  barcode: string;
  /** Printable (WinAnsi-safe) copies of the fields. */
  barcodeText: string;
  name: string;
  categoryName: string;
}

type Layout = (ctx: LabelContext, item: LayoutItem) => void;

/** 3" x 2": left column = name / category / barcode, right column = logo / QR / link. */
const layout3x2: Layout = (ctx, item) => {
  const { page, fonts, width, height } = ctx;
  const split = 1.9 * PT_PER_IN;
  const leftX = MARGIN_PT;
  const leftW = split - leftX - 6;
  const rightX = split;
  const rightW = width - split;

  page.drawLine({ start: { x: split, y: MARGIN_PT + 2 }, end: { x: split, y: height - MARGIN_PT - 2 }, thickness: 0.6, color: rgb(0, 0, 0) });

  // Barcode + human-readable value anchored to the bottom of the left column.
  const codeText = fitLine(item.barcodeText, fonts.mono, 8, 5, leftW);
  const textY = MARGIN_PT;
  drawCentered(page, codeText.text, fonts.mono, codeText.size, leftX, leftW, textY);
  const barcodeY = textY + codeText.size + 3;
  const barcodeH = 46;
  drawCode128(ctx, item.barcode, { x: leftX, y: barcodeY, width: leftW, height: barcodeH });

  // Name, category and the warning fill the space above the barcode. The
  // warning and category are sized first so a long name shrinks to fit around them.
  const top = height - MARGIN_PT;
  const category = item.categoryName ? fitLine(item.categoryName, fonts.regular, 8, 6, leftW) : null;
  const owner = fitParagraph(LABEL_OWNER, fonts.bold, { maxSize: 6, minSize: 5, maxWidth: leftW, maxLines: 2 });
  const warning = fitParagraph(LABEL_WARNING, fonts.italic, { maxSize: 6, minSize: 5, maxWidth: leftW, maxLines: 2 });
  const categoryH = category ? category.size + 2 : 0;
  const notesH = [owner, warning].reduce((sum, p) => sum + p.lines.length * p.size * LEADING + 2, 0);
  const nameBudget = top - (barcodeY + barcodeH) - 3 - categoryH - notesH;
  const name = fitParagraph(item.name, fonts.bold, { maxSize: 13, minSize: 7, maxWidth: leftW, maxLines: 3, maxHeight: nameBudget });
  let cursor = top;
  for (const line of name.lines) {
    cursor -= name.size;
    page.drawText(line, { x: leftX, y: cursor, size: name.size, font: fonts.bold, color: rgb(0, 0, 0) });
    cursor -= name.size * (LEADING - 1);
  }
  if (category) {
    cursor -= category.size + 1;
    page.drawText(category.text, { x: leftX, y: cursor, size: category.size, font: fonts.regular, color: rgb(0, 0, 0) });
  }
  cursor = drawParagraph(page, owner, fonts.bold, leftX, cursor - 2);
  drawParagraph(page, warning, fonts.italic, leftX, cursor - 2);

  // Right column, bottom-up: link text, QR, report note, then the logo in whatever height is left.
  const link = fitLine(LOST_ITEM_DISPLAY, fonts.bold, 7, 5, rightW - 6);
  drawCentered(page, link.text, fonts.bold, link.size, rightX, rightW, MARGIN_PT + 1);
  const qrY = MARGIN_PT + 1 + link.size + 4;
  const qrSize = drawQr(ctx, { x: rightX + (rightW - 56) / 2, y: qrY, size: 56 });
  // "Report if lost" sits between the logo and the QR it refers to.
  const report = fitLine(LABEL_REPORT, fonts.bold, 7, 5, rightW - 6);
  const reportY = qrY + qrSize + 4;
  drawCentered(page, report.text, fonts.bold, report.size, rightX, rightW, reportY);
  const logoBottom = reportY + report.size + 3;
  drawLogo(ctx, { x: rightX + 6, y: logoBottom, width: rightW - 12, height: height - MARGIN_PT - logoBottom });
};

/** 4" x 6" portrait: name / category on top, big barcode, then logo + QR footer. */
const layout4x6: Layout = (ctx, item) => {
  const { page, fonts, width, height } = ctx;
  const margin = 18;
  const contentW = width - margin * 2;

  let cursor = height - margin;
  // The name gets a fixed height budget so a long one shrinks instead of pushing into the barcode.
  const name = fitParagraph(item.name, fonts.bold, { maxSize: 32, minSize: 12, maxWidth: contentW, maxLines: 3, maxHeight: 66 });
  for (const line of name.lines) {
    cursor -= name.size;
    page.drawText(line, { x: margin, y: cursor, size: name.size, font: fonts.bold, color: rgb(0, 0, 0) });
    cursor -= name.size * (LEADING - 1);
  }
  if (item.categoryName) {
    const category = fitLine(item.categoryName, fonts.regular, 16, 9, contentW);
    cursor -= category.size + 2;
    page.drawText(category.text, { x: margin, y: cursor, size: category.size, font: fonts.regular, color: rgb(0, 0, 0) });
  }
  const owner = fitParagraph(LABEL_OWNER, fonts.bold, { maxSize: 11, minSize: 8, maxWidth: contentW, maxLines: 2 });
  const warning = fitParagraph(LABEL_WARNING, fonts.italic, { maxSize: 11, minSize: 8, maxWidth: contentW, maxLines: 2 });
  cursor = drawParagraph(page, owner, fonts.bold, margin, cursor - 4);
  cursor = drawParagraph(page, warning, fonts.italic, margin, cursor - 2);

  // Footer: logo on the left, QR + link on the right, above a rule.
  const footerH = 150;
  const footerTop = margin + footerH;
  page.drawLine({ start: { x: margin, y: footerTop }, end: { x: width - margin, y: footerTop }, thickness: 1, color: rgb(0, 0, 0) });
  const link = fitLine(LOST_ITEM_DISPLAY, fonts.bold, 11, 7, 120);
  drawCentered(page, link.text, fonts.bold, link.size, width - margin - 120, 120, margin);
  const qrY = margin + link.size + 6;
  const qrX = width - margin - 120 + 4;
  drawQr(ctx, { x: qrX, y: qrY, size: 112 });
  const logoW = 76;
  drawLogo(ctx, { x: margin, y: margin + 8, width: logoW, height: footerH - 24 });
  // "Report if lost" in the gap between the logo and the QR, centred on the QR.
  const gapX = margin + logoW + 4;
  const gapW = qrX - gapX - 2;
  const report = fitParagraph(LABEL_REPORT, fonts.bold, { maxSize: 11, minSize: 8, maxWidth: gapW, maxLines: 3 });
  let reportY = qrY + 56 + (report.lines.length * report.size * LEADING) / 2;
  for (const line of report.lines) {
    reportY -= report.size;
    drawCentered(page, line, fonts.bold, report.size, gapX, gapW, reportY);
    reportY -= report.size * (LEADING - 1);
  }

  // Barcode centred in the space between the header and the footer rule.
  const codeText = fitLine(item.barcodeText, fonts.mono, 14, 8, contentW);
  const region = { top: cursor - 12, bottom: footerTop + 12 };
  const barcodeH = Math.max(40, Math.min(110, region.top - region.bottom - codeText.size - 6));
  const blockH = barcodeH + 6 + codeText.size;
  const blockBottom = region.bottom + Math.max(0, (region.top - region.bottom - blockH) / 2);
  drawCentered(page, codeText.text, fonts.mono, codeText.size, margin, contentW, blockBottom);
  drawCode128(ctx, item.barcode, { x: margin, y: blockBottom + codeText.size + 6, width: contentW, height: barcodeH });
};

interface LocationLayoutItem {
  kind: string;
  title: string;
  subtitle: string;
  /** Opens the page listing what is stored here. */
  url: string;
  /** Opens the kiosk, where items are checked in and out. */
  kioskUrl: string;
}

type LocationLayout = (ctx: LabelContext, item: LocationLayoutItem) => void;

/** Two labelled QR codes side by side, left edge at x, each `size` wide with `gap` between; returns the top y. */
function drawQrPair(
  ctx: LabelContext,
  item: LocationLayoutItem,
  box: { x: number; y: number; size: number; gap: number; captionMax: number; captionMin: number }
): number {
  const { fonts, page } = ctx;
  const captionGap = 3;
  const captions = [LOCATION_LOOKUP_CAPTION, LOCATION_KIOSK_CAPTION].map(text => fitLine(text, fonts.bold, box.captionMax, box.captionMin, box.size));
  const captionSize = Math.min(...captions.map(c => c.size));
  const qrY = box.y + captionSize + captionGap;
  const symbols = matchedQrSymbols([item.url, item.kioskUrl]);
  symbols.forEach((symbol, i) => {
    const x = box.x + i * (box.size + box.gap);
    drawQrSymbol(ctx, symbol, { x, y: qrY, size: box.size });
    drawCentered(page, captions[i].text, fonts.bold, captionSize, x, box.size, box.y);
  });
  return qrY + box.size;
}

/** 3" x 2": title, short instructions and the two QRs on the left; logo and notices on the right. */
const locationLayout3x2: LocationLayout = (ctx, item) => {
  const { page, fonts, width, height } = ctx;
  const split = 1.9 * PT_PER_IN;
  const leftX = MARGIN_PT;
  const leftW = split - leftX - 6;
  const rightX = split;
  const rightW = width - split;
  const black = rgb(0, 0, 0);

  page.drawLine({ start: { x: split, y: MARGIN_PT + 2 }, end: { x: split, y: height - MARGIN_PT - 2 }, thickness: 0.6, color: black });

  // Left column, top-down: kind, title, subtitle, instructions. The QR pair is anchored to the
  // bottom and as wide as the column allows; the title shrinks to whatever height is left.
  const qrGap = 4;
  const captionH = 6.5 + 3;
  const instructions = fitParagraph(LOCATION_INSTRUCTIONS_SHORT, fonts.regular, { maxSize: 6.5, minSize: 5, maxWidth: leftW, maxLines: 3 });
  const instructionsH = instructions.lines.length * instructions.size * LEADING;
  const subtitle = item.subtitle ? fitLine(item.subtitle, fonts.regular, 8, 6, leftW) : null;
  const subtitleH = subtitle ? subtitle.size + 2 : 0;
  const kindH = 7 + 2;
  const minTitleH = 8 * LEADING * 2;
  const chrome = kindH + subtitleH + instructionsH + 8; // fixed text above the QRs, plus gaps
  const available = height - MARGIN_PT * 2;
  const qrSize = Math.max(36, Math.min((leftW - qrGap) / 2, available - captionH - chrome - minTitleH));
  const titleBudget = available - captionH - qrSize - chrome;

  let cursor = height - MARGIN_PT;
  cursor -= 7;
  page.drawText(item.kind, { x: leftX, y: cursor, size: 7, font: fonts.bold, color: black });
  const title = fitParagraph(item.title, fonts.bold, { maxSize: 16, minSize: 8, maxWidth: leftW, maxLines: 2, maxHeight: titleBudget });
  cursor -= 2;
  for (const line of title.lines) {
    cursor -= title.size;
    page.drawText(line, { x: leftX, y: cursor, size: title.size, font: fonts.bold, color: black });
    cursor -= title.size * (LEADING - 1);
  }
  if (subtitle) {
    cursor -= subtitle.size + 1;
    page.drawText(subtitle.text, { x: leftX, y: cursor, size: subtitle.size, font: fonts.regular, color: black });
  }
  drawParagraph(page, instructions, fonts.regular, leftX, cursor - 4);
  drawQrPair(ctx, item, { x: leftX, y: MARGIN_PT, size: qrSize, gap: qrGap, captionMax: 6.5, captionMin: 5 });

  // Right column, top-down: logo, "Property of" and the disclaimer.
  const notice = { maxSize: 6, minSize: 5, maxWidth: rightW - 10, maxLines: 4 };
  const owner = fitParagraph(LABEL_OWNER, fonts.bold, notice);
  const warning = fitParagraph(LOCATION_WARNING, fonts.italic, notice);
  const noticesH = [owner, warning].reduce((sum, p) => sum + p.lines.length * p.size * LEADING + 4, 0);
  const logoH = height - MARGIN_PT * 2 - noticesH - 4;
  drawLogo(ctx, { x: rightX + 6, y: height - MARGIN_PT - logoH, width: rightW - 12, height: logoH });
  let y = drawParagraph(page, owner, fonts.bold, rightX + 5, height - MARGIN_PT - logoH - 2) - 4;
  drawParagraph(page, warning, fonts.italic, rightX + 5, y);
};

/** 4" x 6": title + logo on top, two big QRs, then the full instructions and notices. */
const locationLayout4x6: LocationLayout = (ctx, item) => {
  const { page, fonts, width, height } = ctx;
  const margin = 18;
  const contentW = width - margin * 2;
  const black = rgb(0, 0, 0);

  // Header: logo on the right, kind + title + subtitle on the left.
  const logoW = 70;
  const headerW = contentW - logoW - 10;
  drawLogo(ctx, { x: width - margin - logoW, y: height - margin - 74, width: logoW, height: 74 });
  let cursor = height - margin;
  cursor -= 10;
  page.drawText(item.kind, { x: margin, y: cursor, size: 10, font: fonts.bold, color: black });
  const title = fitParagraph(item.title, fonts.bold, { maxSize: 34, minSize: 14, maxWidth: headerW, maxLines: 3, maxHeight: 74 });
  cursor -= 3;
  for (const line of title.lines) {
    cursor -= title.size;
    page.drawText(line, { x: margin, y: cursor, size: title.size, font: fonts.bold, color: black });
    cursor -= title.size * (LEADING - 1);
  }
  if (item.subtitle) {
    const subtitle = fitLine(item.subtitle, fonts.regular, 16, 9, headerW);
    cursor -= subtitle.size + 2;
    page.drawText(subtitle.text, { x: margin, y: cursor, size: subtitle.size, font: fonts.regular, color: black });
  }

  // Bottom block: instructions, then owner + disclaimer.
  const paragraphs = [
    { p: fitParagraph(LOCATION_CHECKOUT_INSTRUCTIONS, fonts.regular, { maxSize: 10, minSize: 8, maxWidth: contentW, maxLines: 3 }), f: fonts.regular },
    { p: fitParagraph(LOCATION_CHECKIN_INSTRUCTIONS, fonts.regular, { maxSize: 10, minSize: 8, maxWidth: contentW, maxLines: 3 }), f: fonts.regular },
    { p: fitParagraph(LABEL_OWNER, fonts.bold, { maxSize: 10, minSize: 8, maxWidth: contentW, maxLines: 2 }), f: fonts.bold },
    { p: fitParagraph(LOCATION_WARNING, fonts.italic, { maxSize: 10, minSize: 8, maxWidth: contentW, maxLines: 2 }), f: fonts.italic }
  ];
  const gaps = [6, 10, 3, 0];
  const blockH = paragraphs.reduce((sum, { p }, i) => sum + p.lines.length * p.size * LEADING + gaps[i], 0);
  let y = margin + blockH;
  const ruleY = y + 6;
  page.drawLine({ start: { x: margin, y: ruleY }, end: { x: width - margin, y: ruleY }, thickness: 1, color: black });
  paragraphs.forEach(({ p, f }, i) => {
    y = drawParagraph(page, p, f, margin, y) - gaps[i];
  });

  // Two QRs side by side, centred between the header and the rule.
  const gap = 16;
  const region = { top: cursor - 14, bottom: ruleY + 14 };
  const size = Math.max(70, Math.min((contentW - gap) / 2, region.top - region.bottom - 24));
  const totalW = size * 2 + gap;
  const blockH2 = size + 3 + 12;
  const bottom = region.bottom + Math.max(0, (region.top - region.bottom - blockH2) / 2);
  drawQrPair(ctx, item, { x: margin + (contentW - totalW) / 2, y: bottom, size, gap, captionMax: 12, captionMin: 8 });
};

const LAYOUTS: Record<LabelTemplateId, Layout> = {
  '3x2-two-column': layout3x2,
  '4x6-large': layout4x6
};

const LOCATION_LAYOUTS: Record<LabelTemplateId, LocationLayout> = {
  '3x2-two-column': locationLayout3x2,
  '4x6-large': locationLayout4x6
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

let logoBytes: Promise<Buffer> | null = null;

export interface RenderOptions {
  /** Called after each label; may be async. */
  onProgress?: (done: number, total: number) => void | Promise<void>;
}

async function renderPages<T>(
  templateId: LabelTemplateId,
  title: string,
  entries: T[],
  draw: (ctx: LabelContext, entry: T, safe: (text: string) => string) => void,
  options: RenderOptions
): Promise<Uint8Array> {
  const template: LabelTemplateInfo = getLabelTemplate(templateId);
  const width = template.widthIn * PT_PER_IN;
  const height = template.heightIn * PT_PER_IN;

  const doc = await PDFDocument.create();
  doc.setTitle(`${title} (${template.name})`);
  doc.setCreator('MRM360');

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.CourierBold)
  };
  logoBytes ??= readFile(LOGO_PATH);
  const logo = await doc.embedPng(await logoBytes);
  const qr = await embedQr(doc, LOST_ITEM_URL);
  const safe = makeSafeText(fonts.bold);

  for (let i = 0; i < entries.length; i++) {
    const page = doc.addPage([width, height]);
    draw({ page, fonts, logo, qr, width, height, dot: PT_PER_IN / template.dpi }, entries[i], safe);
    await options.onProgress?.(i + 1, entries.length);
    // Yield regularly so BullMQ can renew the job lock during big batches.
    if ((i + 1) % 25 === 0) await new Promise(resolve => setImmediate(resolve));
  }

  return doc.save();
}

export function renderLabelPdf(items: LabelItem[], templateId: LabelTemplateId, options: RenderOptions = {}): Promise<Uint8Array> {
  const layout = LAYOUTS[templateId];
  return renderPages(
    templateId,
    'Inventory labels',
    items,
    (ctx, source, safe) =>
      layout(ctx, {
        barcode: source.barcode,
        barcodeText: safe(source.barcode),
        name: safe(source.name),
        categoryName: source.categoryName ? safe(source.categoryName) : ''
      }),
    options
  );
}

/** Shelf / room labels: each QR opens that location's page under `baseUrl`. */
export function renderLocationLabelPdf(
  locations: LocationLabelSpec[],
  baseUrl: string,
  templateId: LabelTemplateId,
  options: RenderOptions = {}
): Promise<Uint8Array> {
  const layout = LOCATION_LAYOUTS[templateId];
  return renderPages(
    templateId,
    'Shelf and room labels',
    locations,
    (ctx, spec, safe) => {
      const { kind, title, subtitle } = describeLocation(spec);
      layout(ctx, { kind, title: safe(title), subtitle: safe(subtitle), url: buildLocationUrl(baseUrl, spec), kioskUrl: buildKioskUrl(baseUrl) });
    },
    options
  );
}
