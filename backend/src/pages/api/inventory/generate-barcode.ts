import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { generateItemBarcode } from '@/utils/barcodeGenerator'

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().max(100).nullable().optional(),
  // A category that doesn't exist yet (typed into the add-item form) still shapes the code.
  categoryName: z.string().trim().max(100).optional(),
  // How many distinct codes to return, for adding several of an item at once.
  count: z.number().int().min(1).max(100).optional()
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
  const { name, categoryId, categoryName, count = 1 } = parsed.data
  const category = categoryId ? await prisma.inventoryCategory.findUnique({ where: { id: categoryId }, select: { name: true } }) : null
  const categoryLabel = category?.name ?? categoryName

  // Codes must be unique against the database and against each other (nothing is saved yet).
  const barcodes: string[] = []
  const taken = new Set<string>()
  for (const length of RANDOM_LENGTHS) {
    const candidates = new Set<string>()
    for (let i = 0; i < (count - barcodes.length) * 2 + 2; i++) {
      const barcode = generateItemBarcode({ name, category: categoryLabel }, length)
      if (!taken.has(barcode)) candidates.add(barcode)
    }
    const existing = await prisma.inventoryItem.findMany({ where: { barcode: { in: [...candidates] } }, select: { barcode: true } })
    for (const { barcode } of existing) taken.add(barcode)
    for (const barcode of candidates) {
      if (taken.has(barcode)) continue
      taken.add(barcode)
      barcodes.push(barcode)
      if (barcodes.length === count) return res.status(200).json({ barcode: barcodes[0], barcodes })
    }
  }
  return res.status(503).json({ error: 'Could not generate a unique barcode' })
}

export default withCORS(withAuth(handler))
