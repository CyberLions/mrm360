import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const requestedUserId = z.string().optional().safeParse(req.query.userId)
  if (!requestedUserId.success) return res.status(400).json({ error: 'Invalid user ID' })

  const canViewOthers = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  const userId = requestedUserId.data || req.user.id
  if (userId !== req.user.id && !canViewOthers) {
    return res.status(403).json({ error: 'You can only view your own checkout history' })
  }

  const loans = await prisma.itemLoan.findMany({
    where: { userId },
    include: {
      item: { include: { bin: true } }
    },
    orderBy: { checkedOutAt: 'desc' },
    take: 250
  })

  const returnBinIds = [...new Set(loans.map(loan => loan.returnBinId).filter((id): id is string => Boolean(id)))]
  const returnBins = returnBinIds.length
    ? await prisma.inventoryBin.findMany({ where: { id: { in: returnBinIds } } })
    : []
  const binsById = new Map(returnBins.map(bin => [bin.id, bin]))

  return res.status(200).json({
    loans: loans.map(loan => ({ ...loan, returnBin: loan.returnBinId ? binsById.get(loan.returnBinId) || null : null }))
  })
}

export default withCORS(withAuth(handler))
