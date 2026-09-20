import type { InventoryLabelTemplate } from '@/types/api'

// Templates whose size isn't a driver preset need one-time printer setup, so
// they get a "how to print" helper.
export const hasPrintHelp = (template: Pick<InventoryLabelTemplate, 'id'> | null | undefined) =>
  template?.id === '3x2-two-column'
