import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Inventory manager access required' })
  const id = z.string().safeParse(req.query.id)
  if (!id.success) return res.status(400).json({ error: 'Invalid bin ID' })
  if (req.method === 'PUT') {
    const parsed = z.object({ name: z.string().trim().min(1), room: z.string().trim().nullable().optional(), shelf: z.string().trim().nullable().optional(), code: z.string().trim().nullable().optional(), description: z.string().trim().nullable().optional() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid bin' })
    try {
      const bin = await prisma.$transaction(async tx => {
        const location = await new InventoryPlaceManager().canonicalizeBinLocation(parsed.data, tx)
        return tx.inventoryBin.update({ where: { id: id.data }, data: { ...parsed.data, ...location }, include: { _count: { select: { items: true } } } })
      })
      return res.status(200).json({ bin })
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ error: 'That bin already exists in this room' })
      if (error?.code === 'P2025') return res.status(404).json({ error: 'Bin not found' })
      throw error
    }
  }
  if (req.method === 'DELETE') {
    const count = await prisma.inventoryItem.count({ where: { binId: id.data } })
    if (count) return res.status(409).json({ error: 'Move items out of this bin before deleting it' })
    await prisma.inventoryBin.delete({ where: { id: id.data } })
    return res.status(204).end()
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
export default withCORS(withAuth(handler))
