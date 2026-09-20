import { NextApiResponse } from 'next'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLabelManager } from '@/managers/inventoryLabelManager'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') {
    return res.status(403).json({ error: 'Inventory manager access required' })
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const status = await new InventoryLabelManager().getStatus(String(req.query.jobId), req.user.id)
    return res.status(200).json(status)
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
