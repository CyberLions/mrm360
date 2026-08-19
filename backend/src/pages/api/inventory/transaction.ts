import { NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/models/prismaClient'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'

const schema = z.object({
  action: z.enum(['checkout', 'checkin']),
  barcode: z.string().trim().min(1),
  memberCode: z.string().trim().optional(),
  binId: z.string().nullable().optional()
})

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (req.user.role !== 'ADMIN' && req.user.role !== 'EXEC_BOARD') return res.status(403).json({ error: 'Kiosk access required' })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transaction' })
  const { action, barcode, memberCode, binId } = parsed.data

  const item = await prisma.inventoryItem.findUnique({ where: { barcode } })
  if (!item) return res.status(404).json({ error: 'Item barcode not found' })

  if (action === 'checkout') {
    if (!memberCode) return res.status(400).json({ error: 'Scan a member profile first' })
    if (item.checkedOutToId) return res.status(409).json({ error: 'Item is already checked out' })
    let normalizedMemberCode = memberCode
    let memberEmail: string | undefined
    try {
      const payload = JSON.parse(memberCode)
      if (typeof payload?.userId === 'string') normalizedMemberCode = payload.userId
      if (typeof payload?.email === 'string') memberEmail = payload.email
    } catch {
      // Current profile codes are plain strings; legacy codes may be JSON.
    }
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { qrCode: memberCode },
          { id: normalizedMemberCode },
          ...(memberEmail ? [{ email: memberEmail }] : [])
        ]
      }
    })
    if (!user) return res.status(404).json({ error: 'Member QR code not found' })
    await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: user.id, binId: null } }),
      prisma.itemLoan.create({ data: { itemId: item.id, userId: user.id } })
    ])
    return res.status(200).json({ message: `${item.name} checked out to ${user.displayName || `${user.firstName} ${user.lastName}`}` })
  }

  if (!item.checkedOutToId) return res.status(409).json({ error: 'Item is not checked out' })
  await prisma.$transaction([
    prisma.inventoryItem.update({ where: { id: item.id }, data: { checkedOutToId: null, binId: binId !== undefined ? binId : item.binId } }),
    prisma.itemLoan.updateMany({ where: { itemId: item.id, checkedInAt: null }, data: { checkedInAt: new Date(), returnBinId: binId } })
  ])
  return res.status(200).json({ message: `${item.name} checked in` })
}

export default withCORS(withAuth(handler))
