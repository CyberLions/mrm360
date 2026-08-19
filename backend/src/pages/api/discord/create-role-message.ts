import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/utils/logger';
import { withCORS } from '@/middleware/corsMiddleware';
import { discordQueue } from '@/tasks/queue';

export default withCORS(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if required environment variables are set
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const channelId = process.env.DISCORD_ROLE_SELECTION_CHANNEL_ID;

    if (!botToken || !guildId || !channelId) {
      return res.status(500).json({ 
        error: 'Discord configuration missing. Please check environment variables.' 
      });
    }

    // Keep Discord gateway activity in the dedicated worker process.
    const job = await discordQueue.add('createRoleSelectionMessage', {
      action: 'createRoleSelectionMessage',
      channelId
    });

    logger.info('Discord role selection message queued', { jobId: job.id });

    return res.status(200).json({
      success: true,
      message: 'Role selection message queued successfully',
      data: { jobId: job.id }
    });

  } catch (error) {
    logger.error('Failed to create Discord role selection message:', error);
    return res.status(500).json({ 
      error: 'Failed to create role selection message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
