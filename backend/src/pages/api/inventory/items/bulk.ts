import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'
import { toPlace } from '@/utils/inventoryPlace'

const ids = z.array(z.string().min(1)).min(1).max(500)
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('move'), ids, binId: z.string().nullable().optional(), shelfId: z.string().nullable().optional(), roomId: z.string().nullable().optional() }),
  z.object({ action: z.literal('category'), ids, categoryId: z.string().nullable() }),
  z.object({ action: z.literal('delete'), ids })
])

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Inventory manager access required' })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid bulk action' })
  const data = parsed.data
  const where = { id: { in: [...new Set(data.ids)] } }

  if (data.action === 'delete') {
    // Loan history goes with the items (ItemLoan cascades).
    const { count } = await prisma.inventoryItem.deleteMany({ where })
    return res.status(200).json({ affected: count })
  }

  if (data.action === 'category') {
    if (data.categoryId && !(await prisma.inventoryCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) {
      return res.status(404).json({ error: 'Category not found' })
    }
    const { count } = await prisma.inventoryItem.updateMany({ where, data: { categoryId: data.categoryId } })
    return res.status(200).json({ affected: count })
  }

  const place = toPlace(data)
  if (!place) return res.status(400).json({ error: 'Choose one bin, shelf or room' })
  try {
    await new InventoryPlaceManager().assertPlaceExists(place)
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({ error: error.message })
  }
  // Checked-out items are returned through a check-in (which records the loan), not moved.
  const { count } = await prisma.inventoryItem.updateMany({ where: { ...where, checkedOutToId: null }, data: place })
  return res.status(200).json({ affected: count, skipped: where.id.in.length - count })
}

export default withCORS(withAuth(handler))
