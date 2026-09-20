import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { generateItemBarcode } from '@/utils/barcodeGenerator'

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().max(100).nullable().optional()
})

// Random part grows on repeated collisions so a crowded category/title prefix still succeeds.
const RANDOM_LENGTHS = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5]

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') {
    return res.status(403).json({ error: 'Inventory manager access required' })
  }

  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' })
  const { name, categoryId } = parsed.data
  const category = categoryId ? await prisma.inventoryCategory.findUnique({ where: { id: categoryId }, select: { name: true } }) : null

  for (const length of RANDOM_LENGTHS) {
    const barcode = generateItemBarcode({ name, category: category?.name }, length)
    const exists = await prisma.inventoryItem.findUnique({ where: { barcode }, select: { id: true } })
    if (!exists) return res.status(200).json({ barcode })
  }
  return res.status(503).json({ error: 'Could not generate a unique barcode' })
}

export default withCORS(withAuth(handler))
