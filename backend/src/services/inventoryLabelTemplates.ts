// Label template metadata. Kept free of PDF/barcode imports so API routes can
// import it cheaply; the drawing code lives in inventoryLabelRenderer.ts.

export const LOST_ITEM_URL = 'https://r.psuccso.org/lost';
export const LOST_ITEM_DISPLAY = 'r.psuccso.org/lost';
export const LABEL_OWNER = 'Property of the Competitive Cyber Security Organization';
export const LABEL_REPORT = 'Report if lost';
export const LABEL_WARNING = 'Not properly checking this item in/out is stealing.';

export interface LabelTemplateInfo {
  id: string;
  name: string;
  description: string;
  widthIn: number;
  heightIn: number;
  /** Native printhead resolution; bar/module widths are snapped to whole dots at this DPI. */
  dpi: number;
}

export const LABEL_TEMPLATES = [
  {
    id: '3x2-two-column',
    name: '3" × 2" two-column',
    description: 'Name, category and barcode on the left; logo and lost-item QR on the right.',
    widthIn: 3,
    heightIn: 2,
    dpi: 203
  },
  {
    id: '4x6-large',
    name: '4" × 6" large',
    description: 'Portrait shipping-size label with a big barcode and the lost-item QR at the bottom.',
    widthIn: 4,
    heightIn: 6,
    dpi: 203
  }
] as const satisfies readonly LabelTemplateInfo[];

export type LabelTemplateId = (typeof LABEL_TEMPLATES)[number]['id'];

export const LABEL_TEMPLATE_IDS = LABEL_TEMPLATES.map(t => t.id) as [LabelTemplateId, ...LabelTemplateId[]];

export function getLabelTemplate(id: string): LabelTemplateInfo {
  const template = LABEL_TEMPLATES.find(t => t.id === id);
  if (!template) throw new Error(`Unknown label template: ${id}`);
  return template;
}

/** Hard cap on labels per job; keeps the PDF small enough to hold in Redis. */
export const MAX_LABELS_PER_JOB = 1000;

export function labelFilename(templateId: string, date = new Date()): string {
  const { widthIn, heightIn } = getLabelTemplate(templateId);
  return `inventory-labels-${widthIn}x${heightIn}-${date.toISOString().slice(0, 10)}.pdf`;
}
