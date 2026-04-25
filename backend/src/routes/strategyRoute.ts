import { Router, type Request, type Response } from 'express';
import { getStrategyMemory, updateStrategyMemory } from '../memory/strategyMemory';

const strategyRoute = Router();

strategyRoute.post('/strategy/update', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : 'default';

    const strategy = await updateStrategyMemory(sessionId, {
      country: req.body.country,
      allies: req.body.allies,
      enemies: req.body.enemies,
      strategy_notes: req.body.strategy_notes,
      opponent_models: req.body.opponent_models,
    });

    return res.json({
      ok: true,
      sessionId,
      strategy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown strategy update error';
    return res.status(502).json({ ok: false, error: message });
  }
});

strategyRoute.get('/strategy', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' && req.query.sessionId.trim()
      ? req.query.sessionId.trim()
      : 'default';
    const strategy = await getStrategyMemory(sessionId);

    return res.json({ ok: true, sessionId, strategy });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown strategy read error';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default strategyRoute;
