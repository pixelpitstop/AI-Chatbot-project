import { Router, type Request, type Response } from 'express';
import { clearRecentMemory } from '../memory';
import { clearStrategyMemory } from '../memory/strategyMemory';

const memoryRoute = Router();

memoryRoute.post('/memory/clear', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : 'default';

    await Promise.all([
      clearRecentMemory(sessionId),
      clearStrategyMemory(sessionId),
    ]);

    return res.json({
      ok: true,
      sessionId,
      cleared: ['recent_memory', 'strategy_memory'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown memory clear error';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default memoryRoute;
