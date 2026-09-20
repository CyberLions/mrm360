import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import type { PlaceRef } from '@/utils/inventoryPlace'

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

  // Where each loan was returned to: a bin, a shelf or a room.
  const idsOf = (pick: (loan: (typeof loans)[number]) => string | null) => [...new Set(loans.map(pick).filter((id): id is string => Boolean(id)))]
  const [bins, shelves, rooms] = await Promise.all([
    prisma.inventoryBin.findMany({ where: { id: { in: idsOf(loan => loan.returnBinId) } }, select: { id: true, name: true, room: true, shelf: true } }),
    prisma.inventoryShelf.findMany({ where: { id: { in: idsOf(loan => loan.returnShelfId) } }, select: { id: true, name: true, room: { select: { name: true } } } }),
    prisma.inventoryRoom.findMany({ where: { id: { in: idsOf(loan => loan.returnRoomId) } }, select: { id: true, name: true } })
  ])
  const placesById = new Map<string, PlaceRef>([
    ...bins.map((bin): [string, PlaceRef] => [bin.id, { kind: 'bin', ...bin }]),
    ...shelves.map((shelf): [string, PlaceRef] => [shelf.id, { kind: 'shelf', id: shelf.id, name: shelf.name, room: shelf.room?.name ?? null, shelf: null }]),
    ...rooms.map((room): [string, PlaceRef] => [room.id, { kind: 'room', id: room.id, name: room.name, room: null, shelf: null }])
  ])

  return res.status(200).json({
    loans: loans.map(loan => ({ ...loan, returnPlace: placesById.get(loan.returnBinId ?? loan.returnShelfId ?? loan.returnRoomId ?? '') ?? null }))
  })
}

export default withCORS(withAuth(handler))
