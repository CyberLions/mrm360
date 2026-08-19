import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '@/utils/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    logger.info('Discord bot health check requested');

    // The API must not create a Discord gateway client just to answer a health
    // check. Report configuration readiness; the worker owns live connectivity.
    const environment = {
      botToken: Boolean(process.env.DISCORD_BOT_TOKEN),
      guildId: Boolean(process.env.DISCORD_GUILD_ID),
      categoryId: Boolean(process.env.DISCORD_CATEGORY_ID)
    };
    const isProductionReady = Object.values(environment).every(Boolean);

    const healthData = {
      status: isProductionReady ? 'configured' : 'unconfigured',
      timestamp: new Date().toISOString(),
      environment,
      production: {
        ready: isProductionReady
      }
    };

    const statusCode = isProductionReady ? 200 : 503;
    
    res.status(statusCode).json(healthData);
    
    logger.info(`Discord bot health check completed with status: ${healthData.status}`);
    
  } catch (error) {
    logger.error('Discord bot health check failed:', error);
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
