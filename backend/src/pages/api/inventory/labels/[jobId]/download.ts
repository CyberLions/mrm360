import { NextApiResponse } from 'next'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLabelManager } from '@/managers/inventoryLabelManager'

// A 1000-label PDF can pass Next's 4MB default response warning.
export const config = { api: { responseLimit: false } }

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') {
    return res.status(403).json({ error: 'Inventory manager access required' })
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { pdf, filename } = await new InventoryLabelManager().getPdf(String(req.query.jobId), req.user.id)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdf.length)
    return res.status(200).send(pdf)
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
