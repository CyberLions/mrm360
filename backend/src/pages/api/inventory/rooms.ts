import { NextApiResponse } from 'next'
import { z } from 'zod'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'

const roomSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).nullable().optional() })

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const manager = new InventoryPlaceManager()
  try {
    if (req.method === 'GET') return res.status(200).json({ rooms: await manager.listRooms() })
    if (req.method === 'POST') {
      if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Inventory manager access required' })
      const parsed = roomSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Invalid room', details: parsed.error.flatten() })
      return res.status(201).json({ room: await manager.createRoom(parsed.data) })
    }
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
