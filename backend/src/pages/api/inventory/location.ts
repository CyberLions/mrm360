import { NextApiResponse } from 'next'
import { z } from 'zod'
import { AuthenticatedRequest, withAuth } from '@/middleware/authMiddleware'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLocationManager } from '@/managers/inventoryLocationManager'

// Empty query values count as absent, so ?room=Lab+1&shelf= is a whole-room request.
const optionalText = z.preprocess(value => (typeof value === 'string' && value.trim() ? value.trim() : null), z.string().max(200).nullable())
const querySchema = z
  .object({ room: optionalText, shelf: optionalText, bin: optionalText })
  .refine(q => q.room || q.shelf || q.bin, 'Provide a room, a shelf or a bin')

// Any signed-in member: this is the page a shelf or room label's QR code opens.
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Provide a room, a shelf or a bin' })

  try {
    return res.status(200).json(await new InventoryLocationManager().getLocation({ room: parsed.data.room, shelf: parsed.data.shelf, binId: parsed.data.bin }, req.user.id))
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(withAuth(handler))
