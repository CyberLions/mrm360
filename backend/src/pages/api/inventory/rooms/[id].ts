import { NextApiResponse } from 'next'
import { z } from 'zod'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'

const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).nullable().optional() })

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Inventory manager access required' })
  const id = z.string().min(1).safeParse(req.query.id)
  if (!id.success) return res.status(400).json({ error: 'Invalid room ID' })
  const manager = new InventoryPlaceManager()
  try {
    if (req.method === 'PUT') {
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Invalid room' })
      return res.status(200).json({ room: await manager.updateRoom(id.data, parsed.data) })
    }
    if (req.method === 'DELETE') {
      await manager.deleteRoom(id.data)
      res.status(204).end()
      return
    }
    res.setHeader('Allow', ['PUT', 'DELETE'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
