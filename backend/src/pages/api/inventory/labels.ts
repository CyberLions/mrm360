import { NextApiResponse } from 'next'
import { z } from 'zod'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLabelManager } from '@/managers/inventoryLabelManager'
import { LABEL_TEMPLATES, LABEL_TEMPLATE_IDS, MAX_LABELS_PER_JOB } from '@/services/inventoryLabelTemplates'

const itemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(MAX_LABELS_PER_JOB),
  template: z.enum(LABEL_TEMPLATE_IDS)
})

// A shelf label needs its room too, since shelf names repeat across rooms. A bin is identified by id.
const locationsSchema = z.object({
  locations: z
    .array(
      z.object({
        room: z.string().trim().min(1).max(200).nullable(),
        shelf: z.string().trim().min(1).max(200).nullable(),
        binId: z.string().trim().min(1).max(100).nullable().optional()
      }).refine(l => l.room || l.shelf || l.binId, 'A location needs a room, a shelf or a bin')
    )
    .min(1)
    .max(MAX_LABELS_PER_JOB),
  template: z.enum(LABEL_TEMPLATE_IDS)
})

const requestSchema = z.union([itemsSchema, locationsSchema])

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') {
    return res.status(403).json({ error: 'Inventory manager access required' })
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ templates: LABEL_TEMPLATES, maxLabels: MAX_LABELS_PER_JOB })
    }

    if (req.method === 'POST') {
      const parsed = requestSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Invalid label request', details: parsed.error.flatten() })
      const manager = new InventoryLabelManager()
      if ('locations' in parsed.data) {
        // Location QR codes need an absolute URL; prefer the configured app origin.
        const baseUrl = process.env.FRONTEND_URL || (typeof req.headers.origin === 'string' ? req.headers.origin : '')
        if (!baseUrl) return res.status(500).json({ error: 'FRONTEND_URL is not configured' })
        const { jobId } = await manager.requestLocationLabels({ ...parsed.data, baseUrl, requestedById: req.user.id })
        return res.status(202).json({ jobId })
      }
      const { jobId } = await manager.requestLabels({ ...parsed.data, requestedById: req.user.id })
      return res.status(202).json({ jobId })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
