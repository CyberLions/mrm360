import { randomBytes } from 'crypto'
import { NextApiResponse } from 'next'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') {
    return res.status(403).json({ error: 'Inventory manager access required' })
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const barcode = `ITEM-${randomBytes(6).toString('hex').toUpperCase()}`
    const exists = await prisma.inventoryItem.findUnique({ where: { barcode }, select: { id: true } })
    if (!exists) return res.status(200).json({ barcode })
  }
  return res.status(503).json({ error: 'Could not generate a unique barcode' })
}

export default withCORS(withAuth(handler))
