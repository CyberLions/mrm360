import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = z.string().safeParse(req.query.id)
  if (!id.success) return res.status(400).json({ error: 'Invalid item ID' })
  const manager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  if (req.method === 'PUT') {
    if (!manager) return res.status(403).json({ error: 'Inventory manager access required' })
    const parsed = z.object({ binId: z.string().nullable().optional(), name: z.string().trim().min(1).optional() }).refine(data => data.binId !== undefined || data.name !== undefined).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid location' })
    const existing = await prisma.inventoryItem.findUnique({ where: { id: id.data } })
    if (!existing) return res.status(404).json({ error: 'Item not found' })
    const item = await prisma.inventoryItem.update({ where: { id: id.data }, data: parsed.data, include: { bin: true } })
    return res.status(200).json({ item })
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const item = await prisma.inventoryItem.findFirst({
    where: { id: id.data, ...(manager ? {} : { checkedOutToId: req.user.id }) },
    include: {
      bin: true,
      checkedOutTo: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      loans: { include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true } } }, orderBy: { checkedOutAt: 'desc' } }
    }
  })
  if (!item) return res.status(404).json({ error: 'Item not found' })
  return res.status(200).json({ item })
}
export default withCORS(withAuth(handler))
