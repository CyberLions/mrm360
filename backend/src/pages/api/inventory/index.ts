import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

const itemSchema = z.object({
  barcode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  binId: z.string().nullable().optional(),
  binName: z.string().trim().min(1).optional(),
  room: z.string().trim().optional()
})

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const isManager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'

  if (req.method === 'GET') {
    const where = isManager ? {} : { checkedOutToId: req.user.id }
    const [items, bins] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: {
          bin: true,
          checkedOutTo: { select: { id: true, email: true, firstName: true, lastName: true, displayName: true } },
          loans: { select: { checkedOutAt: true, checkedInAt: true }, orderBy: { checkedOutAt: 'desc' }, take: 1 }
        },
        orderBy: [{ name: 'asc' }, { barcode: 'asc' }]
      }),
      isManager ? prisma.inventoryBin.findMany({ orderBy: [{ room: 'asc' }, { name: 'asc' }] }) : Promise.resolve([])
    ])
    return res.status(200).json({ items, bins, canManage: isManager })
  }

  if (req.method === 'POST') {
    if (!isManager) return res.status(403).json({ error: 'Inventory manager access required' })
    const parsed = z.object({ items: z.array(itemSchema).min(1).max(500) }).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid items', details: parsed.error.flatten() })

    try {
      const items = await prisma.$transaction(async tx => {
        const created = []
        for (const input of parsed.data.items) {
          const { binName, room, ...item } = input
          let binId = item.binId
          if (!binId && binName) {
            let bin = await tx.inventoryBin.findFirst({ where: { name: { equals: binName, mode: 'insensitive' }, ...(room ? { room: { equals: room, mode: 'insensitive' } } : {}) } })
            bin ||= await tx.inventoryBin.create({ data: { name: binName, room: room || null } })
            binId = bin.id
          }
          created.push(await tx.inventoryItem.create({ data: { barcode: item.barcode, name: item.name, binId }, include: { bin: true } }))
        }
        return created
      })
      return res.status(201).json({ items })
    } catch (error: any) {
      if (error?.code === 'P2002') return res.status(409).json({ error: 'Each barcode must be unique' })
      throw error
    }
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Method not allowed' })
}

export default withCORS(withAuth(handler))
