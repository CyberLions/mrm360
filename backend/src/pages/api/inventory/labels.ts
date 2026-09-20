import { NextApiResponse } from 'next'
import { z } from 'zod'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLabelManager } from '@/managers/inventoryLabelManager'
import { LABEL_TEMPLATES, LABEL_TEMPLATE_IDS, MAX_LABELS_PER_JOB } from '@/services/inventoryLabelTemplates'

const requestSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(MAX_LABELS_PER_JOB),
  template: z.enum(LABEL_TEMPLATE_IDS)
})

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
      const { jobId } = await new InventoryLabelManager().requestLabels({ ...parsed.data, requestedById: req.user.id })
      return res.status(202).json({ jobId })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
