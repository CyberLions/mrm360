import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { InventoryPlaceManager } from '@/managers/inventoryPlaceManager'
import { lastKnownPlace, mentionsPlace, NO_PLACE, pickReturnPlace, toPlace, formatPlace } from '@/utils/inventoryPlace'
import { sendItemCheckedInEmail, sendItemCheckedOutEmail } from '@/services/inventoryEmailService'

const schema = z.object({
  action: z.enum(['checkout', 'checkin']),
  barcode: z.string().trim().min(1),
  memberCode: z.string().trim().optional(),
  binId: z.string().nullable().optional(),
  shelfId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  selfCheckout: z.boolean().optional().default(false),
  note: z.string().trim().max(1000).optional()
})

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transaction' })
  const { action, barcode, memberCode, selfCheckout, note } = parsed.data
  const isManager = req.user.role === 'ADMIN' || req.user.role === 'EXEC_BOARD'
  if (!isManager && (action !== 'checkout' || !selfCheckout)) {
    return res.status(403).json({ error: 'Kiosk access required' })
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { barcode },
    include: { checkedOutTo: true }
  })
  if (!item) return res.status(404).json({ error: 'Item barcode not found' })

  if (action === 'checkout') {
    if (item.checkedOutToId) return res.status(409).json({ error: 'Item is already checked out' })
    if (!selfCheckout && !memberCode) return res.status(400).json({ error: 'Scan a member profile first' })
    let normalizedMemberCode = selfCheckout ? req.user.id : memberCode!
    let memberEmail: string | undefined
    try {
      const payload = JSON.parse(selfCheckout ? '' : memberCode || '')
      if (typeof payload?.userId === 'string') normalizedMemberCode = payload.userId
      if (typeof payload?.email === 'string') memberEmail = payload.email
    } catch {
      // Current profile codes are plain strings; legacy codes may be JSON.
    }
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(!selfCheckout && memberCode ? [{ qrCode: memberCode }] : []),
          { id: normalizedMemberCode },
          ...(memberEmail ? [{ email: memberEmail }] : [])
        ]
      }
    })
    if (!user) return res.status(404).json({ error: 'Member QR code not found' })
    const checkedOutAt = new Date()
    await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: user.id, ...NO_PLACE, lostAt: null, lostNote: null } }),
      prisma.itemLoan.create({ data: { itemId: item.id, userId: user.id, checkedOutAt, fromBinId: item.binId, fromShelfId: item.shelfId, fromRoomId: item.roomId, note: note || null } })
    ])
    await sendItemCheckedOutEmail(user, item, checkedOutAt)
    return res.status(200).json({ message: `${item.name} checked out to ${user.displayName || `${user.firstName} ${user.lastName}`}` })
  }

  if (!item.checkedOutToId) return res.status(409).json({ error: 'Item is not checked out' })
  const checkedInAt = new Date()

  // An explicit place (even "nowhere") is a manager's choice; otherwise it goes back where it came from.
  const requested = mentionsPlace(parsed.data) ? toPlace(parsed.data) : undefined
  if (requested === null) return res.status(400).json({ error: 'An item can only be in one bin, shelf or room' })

  // Checking out clears the item's place, so the last one comes from the loan (or, for older
  // loans that predate that, the previous return).
  const [openLoan, lastReturn] = await Promise.all([
    prisma.itemLoan.findFirst({ where: { itemId: item.id, checkedInAt: null }, orderBy: { checkedOutAt: 'desc' }, select: { fromBinId: true, fromShelfId: true, fromRoomId: true } }),
    prisma.itemLoan.findFirst({
      where: { itemId: item.id, OR: [{ returnBinId: { not: null } }, { returnShelfId: { not: null } }, { returnRoomId: { not: null } }] },
      orderBy: { checkedInAt: 'desc' },
      select: { returnBinId: true, returnShelfId: true, returnRoomId: true }
    })
  ])
  const memory = {
    from: openLoan && { binId: openLoan.fromBinId, shelfId: openLoan.fromShelfId, roomId: openLoan.fromRoomId },
    lastReturn: lastReturn && { binId: lastReturn.returnBinId, shelfId: lastReturn.returnShelfId, roomId: lastReturn.returnRoomId },
    current: { binId: item.binId, shelfId: item.shelfId, roomId: item.roomId }
  }
  const places = new InventoryPlaceManager()
  // A bin, shelf or room may have been deleted since; treat that as "nowhere".
  const [lastPlace, returnPlace] = await Promise.all([
    places.resolvePlace(lastKnownPlace(memory)),
    places.resolvePlace(pickReturnPlace({ requested, ...memory }))
  ])
  const idIf = (kind: string) => (returnPlace?.kind === kind ? returnPlace.id : null)
  const returnIds = { binId: idIf('bin'), shelfId: idIf('shelf'), roomId: idIf('room') }

  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: null, ...returnIds, lostAt: null, lostNote: null } }),
    prisma.itemLoan.updateMany({
      where: { itemId: item.id, checkedInAt: null },
      data: { checkedInAt, returnBinId: returnIds.binId, returnShelfId: returnIds.shelfId, returnRoomId: returnIds.roomId, ...(note ? { note } : {}) }
    })
  ])
  if (item.checkedOutTo) {
    await sendItemCheckedInEmail(item.checkedOutTo, item, checkedInAt, formatPlace(returnPlace))
  }
  // Extra fields let the kiosk show where the item was and where it is now.
  return res.status(200).json({ message: `${item.name} checked in`, itemId: item.id, itemName: item.name, place: returnPlace, lastPlace })
}

export default withCORS(withAuth(handler))
