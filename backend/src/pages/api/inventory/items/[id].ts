import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'
import { mentionsPlace, toPlace } from '@/utils/inventoryPlace'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = z.string().safeParse(req.query.id)
  if (!id.success) return res.status(400).json({ error: 'Invalid item ID' })
  const manager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  if (req.method === 'PUT') {
    if (!manager) return res.status(403).json({ error: 'Inventory manager access required' })
    const parsed = z.object({ binId: z.string().nullable().optional(), shelfId: z.string().nullable().optional(), roomId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), name: z.string().trim().min(1).optional(), description: z.string().trim().max(2000).nullable().optional(), markFound: z.literal(true).optional() }).refine(data => mentionsPlace(data) || data.categoryId !== undefined || data.name !== undefined || data.description !== undefined || data.markFound).safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid location' })
    const existing = await prisma.inventoryItem.findUnique({ where: { id: id.data } })
    if (!existing) return res.status(404).json({ error: 'Item not found' })
    const { markFound, description, binId, shelfId, roomId, ...changes } = parsed.data
    // Naming any of bin/shelf/room sets the item's whole place, so the others are cleared.
    const place = mentionsPlace(parsed.data) ? toPlace({ binId, shelfId, roomId }) : undefined
    if (place === null) return res.status(400).json({ error: 'An item can only be in one bin, shelf or room' })
    if (place) {
      try {
        await new InventoryPlaceManager().assertPlaceExists(place)
      } catch (error: any) {
        return res.status(error.statusCode || 500).json({ error: error.message })
      }
    }
    const item = await prisma.inventoryItem.update({ where: { id: id.data }, data: { ...changes, ...(place ?? {}), ...(description !== undefined ? { description: description || null } : {}), ...(markFound ? { lostAt: null, lostNote: null } : {}) }, include: { bin: true, shelf: true, room: true, category: true } })
    return res.status(200).json({ item })
  }
  if (req.method === 'DELETE') {
    if (!manager) return res.status(403).json({ error: 'Inventory manager access required' })
    // Loan history goes with the item (ItemLoan cascades).
    const { count } = await prisma.inventoryItem.deleteMany({ where: { id: id.data } })
    if (!count) return res.status(404).json({ error: 'Item not found' })
    return res.status(204).json(null)
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const item = await prisma.inventoryItem.findFirst({
    where: { id: id.data, ...(manager ? {} : { checkedOutToId: req.user.id }) },
    include: {
      bin: true,
      shelf: { include: { room: { select: { id: true, name: true } } } },
      room: true,
      category: true,
      checkedOutTo: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      loans: { include: { user: { select: { id: true, firstName: true, lastName: true, displayName: true } } }, orderBy: { checkedOutAt: 'desc' } }
    }
  })
  if (!item) return res.status(404).json({ error: 'Item not found' })
  return res.status(200).json({ item })
}
export default withCORS(withAuth(handler))
