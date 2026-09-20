import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const isManager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  if (req.method === 'GET') {
    const bins = await prisma.inventoryBin.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: [{ room: 'asc' }, { name: 'asc' }]
    })
    return res.status(200).json({ bins })
  }
  if (req.method === 'POST') {
    if (!isManager) return res.status(403).json({ error: 'Inventory manager access required' })
    const parsed = z.object({ name: z.string().trim().min(1), room: z.string().trim().nullable().optional(), shelf: z.string().trim().nullable().optional(), code: z.string().trim().nullable().optional(), description: z.string().trim().nullable().optional() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid bin', details: parsed.error.flatten() })
    try {
      // New rooms and shelves typed into the form are added to the registry as well.
      const bin = await prisma.$transaction(async tx => {
        const location = await new InventoryPlaceManager().canonicalizeBinLocation(parsed.data, tx)
        return tx.inventoryBin.create({ data: { ...parsed.data, ...location } })
      })
      return res.status(201).json({ bin })
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ error: 'That bin already exists in this room' })
      throw error
    }
  }
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

export default withCORS(withAuth(handler))
