import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const isManager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  if (req.method === 'GET') {
    const categories = await prisma.inventoryCategory.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' }
    })
    return res.status(200).json({ categories })
  }
  if (req.method === 'POST') {
    if (!isManager) return res.status(403).json({ error: 'Inventory manager access required' })
    const parsed = z.object({ name: z.string().trim().min(1), description: z.string().trim().nullable().optional() }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category', details: parsed.error.flatten() })
    try {
      const category = await prisma.inventoryCategory.create({ data: parsed.data })
      return res.status(201).json({ category })
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ error: 'That category already exists' })
      throw error
    }
  }
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

export default withCORS(withAuth(handler))
