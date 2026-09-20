// Label template metadata. Kept free of PDF/barcode imports so API routes can
// import it cheaply; the drawing code lives in inventoryLabelRenderer.ts.

export const LOST_ITEM_URL = 'https://r.psuccso.org/lost';
export const LOST_ITEM_DISPLAY = 'r.psuccso.org/lost';
export const LABEL_OWNER = 'Property of the Competitive Cyber Security Organization';
export const LABEL_REPORT = 'Report if lost';
export const LABEL_WARNING = 'Not properly checking this item in/out is theft.';

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

// ---------------------------------------------------------------------------
// Shelf / room labels
// ---------------------------------------------------------------------------

/** What a caller asks for: a room, a shelf within a room, or one bin (by id, so renames don't break its label). */
export interface LocationLabelRequest {
  room: string | null;
  /** null = a whole-room label. Shelves are only unique within a room. */
  shelf: string | null;
  binId?: string | null;
}

/** A location ready to print. For bin labels the worker fills `bin` (and room/shelf) from the database. */
export interface LocationLabelSpec {
  room: string | null;
  shelf: string | null;
  bin?: { id: string; name: string } | null;
}

/** Shelf/room labels cover many items, so the notice is about items in general. */
export const LOCATION_WARNING = 'Not properly checking items in and out is theft.';
export const LOCATION_CHECKOUT_INSTRUCTIONS = 'Check out: scan the kiosk QR code, sign in, choose Self checkout, then scan the item.';
export const LOCATION_CHECKIN_INSTRUCTIONS = 'Check in: put the item back in its bin, then scan it at the kiosk under Check In.';
/** Compact version for the small label. */
export const LOCATION_INSTRUCTIONS_SHORT = 'Scan the kiosk QR: Self checkout to take an item, Check In to return it.';
export const LOCATION_LOOKUP_CAPTION = "What's here";
export const LOCATION_KIOSK_CAPTION = 'Check in/out';

/** The kiosk page where items are checked in and out. */
export const buildKioskUrl = (baseUrl: string): string => `${baseUrl.replace(/\/+$/, '')}/inventory/kiosk`;

export const locationPath = ({ room, shelf, bin }: LocationLabelSpec): string => {
  const params = new URLSearchParams();
  if (bin) params.set('bin', bin.id);
  else {
    if (room) params.set('room', room);
    if (shelf) params.set('shelf', shelf);
  }
  return `/inventory/location?${params.toString()}`;
};

export const buildLocationUrl = (baseUrl: string, spec: LocationLabelSpec): string =>
  `${baseUrl.replace(/\/+$/, '')}${locationPath(spec)}`;

export function describeLocation({ room, shelf, bin }: LocationLabelSpec): { kind: string; title: string; subtitle: string } {
  if (bin) return { kind: 'BIN', title: bin.name, subtitle: [room, shelf ? `Shelf ${shelf}` : null].filter(Boolean).join(' · ') };
  return shelf ? { kind: 'SHELF', title: `Shelf ${shelf}`, subtitle: room ?? '' } : { kind: 'ROOM', title: room ?? '', subtitle: '' };
}
