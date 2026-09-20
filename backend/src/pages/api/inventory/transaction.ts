import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { lastKnownBinId, pickReturnBinId } from '@/utils/inventoryBins'
import { sendItemCheckedInEmail, sendItemCheckedOutEmail } from '@/services/inventoryEmailService'

const schema = z.object({
  action: z.enum(['checkout', 'checkin']),
  barcode: z.string().trim().min(1),
  memberCode: z.string().trim().optional(),
  binId: z.string().nullable().optional(),
  selfCheckout: z.boolean().optional().default(false),
  note: z.string().trim().max(1000).optional()
})

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transaction' })
  const { action, barcode, memberCode, binId, selfCheckout, note } = parsed.data
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
      prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: user.id, binId: null, lostAt: null, lostNote: null } }),
      prisma.itemLoan.create({ data: { itemId: item.id, userId: user.id, checkedOutAt, fromBinId: item.binId, note: note || null } })
    ])
    await sendItemCheckedOutEmail(user, item, checkedOutAt)
    return res.status(200).json({ message: `${item.name} checked out to ${user.displayName || `${user.firstName} ${user.lastName}`}` })
  }

  if (!item.checkedOutToId) return res.status(409).json({ error: 'Item is not checked out' })
  const checkedInAt = new Date()

  // Checking out clears the item's bin, so the last one comes from the loan (or, for older
  // loans that predate that, the previous return).
  const [openLoan, lastReturn] = await Promise.all([
    prisma.itemLoan.findFirst({ where: { itemId: item.id, checkedInAt: null }, orderBy: { checkedOutAt: 'desc' }, select: { fromBinId: true } }),
    prisma.itemLoan.findFirst({ where: { itemId: item.id, returnBinId: { not: null } }, orderBy: { checkedInAt: 'desc' }, select: { returnBinId: true } })
  ])
  const memory = { fromBinId: openLoan?.fromBinId, lastReturnBinId: lastReturn?.returnBinId, currentBinId: item.binId }
  const [lastBin, returnBin] = await Promise.all(
    [lastKnownBinId(memory), pickReturnBinId({ requested: binId, ...memory })].map(id =>
      // A bin may have been deleted since; treat that as "no bin".
      id ? prisma.inventoryBin.findUnique({ where: { id }, select: { id: true, name: true, room: true, shelf: true } }) : null
    )
  )

  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: null, binId: returnBin?.id ?? null, lostAt: null, lostNote: null } }),
    prisma.itemLoan.updateMany({
      where: { itemId: item.id, checkedInAt: null },
      data: { checkedInAt, returnBinId: returnBin?.id ?? null, ...(note ? { note } : {}) }
    })
  ])
  if (item.checkedOutTo) {
    await sendItemCheckedInEmail(item.checkedOutTo, item, checkedInAt, returnBin?.name)
  }
  // Extra fields let the kiosk show where the item was and where it is now.
  return res.status(200).json({ message: `${item.name} checked in`, itemId: item.id, itemName: item.name, bin: returnBin, lastBin })
}

export default withCORS(withAuth(handler))
