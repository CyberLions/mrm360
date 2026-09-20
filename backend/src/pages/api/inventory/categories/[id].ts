import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Inventory manager access required' })
  const id = z.string().safeParse(req.query.id)
  if (!id.success) return res.status(400).json({ error: 'Invalid category ID' })
  if (req.method === 'PUT') {
    const parsed = z.object({ name: z.string().trim().min(1), description: z.string().trim().nullable().optional() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category' })
    try {
      const category = await prisma.inventoryCategory.update({ where: { id: id.data }, data: parsed.data, include: { _count: { select: { items: true } } } })
      return res.status(200).json({ category })
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ error: 'That category already exists' })
      throw error
    }
  }
  if (req.method === 'DELETE') {
    const count = await prisma.inventoryItem.count({ where: { categoryId: id.data } })
    if (count) return res.status(409).json({ error: 'Move items out of this category before deleting it' })
    await prisma.inventoryCategory.delete({ where: { id: id.data } })
    return res.status(204).end()
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
export default withCORS(withAuth(handler))
