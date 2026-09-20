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
  const ops = [pushGraphicsState(), setFillingGrayscaleColor(0)];
  sbs.forEach((width, i) => {
    if (i % 2 === 0) ops.push(rectangle(x, box.y, width * moduleWidth, box.height));
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
  ctx.page.drawPage(ctx.qr.page, { x: box.x + (box.size - size) / 2, y: box.y, width: size, height: size });
  return size;
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

const LAYOUTS: Record<LabelTemplateId, Layout> = {
  '3x2-two-column': layout3x2,
  '4x6-large': layout4x6
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

let logoBytes: Promise<Buffer> | null = null;

export interface RenderOptions {
  /** Called after each label; may be async. */
  onProgress?: (done: number, total: number) => void | Promise<void>;
}

export async function renderLabelPdf(
  items: LabelItem[],
  templateId: LabelTemplateId,
  options: RenderOptions = {}
): Promise<Uint8Array> {
  const template: LabelTemplateInfo = getLabelTemplate(templateId);
  const layout = LAYOUTS[templateId];
  const width = template.widthIn * PT_PER_IN;
  const height = template.heightIn * PT_PER_IN;

  const doc = await PDFDocument.create();
  doc.setTitle(`Inventory labels (${template.name})`);
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

  for (let i = 0; i < items.length; i++) {
    const source = items[i];
    const page = doc.addPage([width, height]);
    layout(
      { page, fonts, logo, qr, width, height, dot: PT_PER_IN / template.dpi },
      {
        barcode: source.barcode,
        barcodeText: safe(source.barcode),
        name: safe(source.name),
        categoryName: source.categoryName ? safe(source.categoryName) : ''
      }
    );
    await options.onProgress?.(i + 1, items.length);
    // Yield regularly so BullMQ can renew the job lock during big batches.
    if ((i + 1) % 25 === 0) await new Promise(resolve => setImmediate(resolve));
  }

  return doc.save();
}
