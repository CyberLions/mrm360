import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { withCORS } from '@/middleware/corsMiddleware'
import { handleApiError } from '@/middleware/errorHandler'
import { InventoryLostManager } from '@/managers/inventoryLostManager'
import { getClientIp, isRateLimited } from '@/utils/rateLimit'

const schema = z.object({
  code: z.string().trim().min(1).max(100),
  note: z.string().trim().max(500).optional(),
  contact: z.string().trim().max(200).optional()
})

const REPORTS_PER_WINDOW = 10
const WINDOW_SECONDS = 10 * 60

// Intentionally unauthenticated: anyone who finds an item can scan its label and report it.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter the code printed on the label' })

  if (await isRateLimited(`inventory-lost:${getClientIp(req)}`, REPORTS_PER_WINDOW, WINDOW_SECONDS)) {
    return res.status(429).json({ error: 'Too many reports. Please try again in a few minutes.' })
  }

  try {
    const { code, note, contact } = parsed.data
    const result = await new InventoryLostManager().reportLost(code, { note: note || undefined, contact: contact || undefined })
    return res.status(200).json(result)
  } catch (error) {
    return handleApiError(error, req, res)
  }
}

export default withCORS(handler)
