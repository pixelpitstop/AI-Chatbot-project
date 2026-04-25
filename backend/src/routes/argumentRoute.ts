import { Router, type Request, type Response } from 'express';
import { generateArgumentSet } from '../services/argumentService';

const argumentRoute = Router();

argumentRoute.post('/argument/generate', async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : 'default';
    const opponent = typeof req.body.opponent === 'string' ? req.body.opponent.trim() : '';
    const country = typeof req.body.country === 'string' ? req.body.country.trim() : undefined;
    const context = typeof req.body.context === 'string' ? req.body.context.trim() : undefined;

    if (!opponent) {
      return res.status(400).json({ ok: false, error: 'opponent is required' });
    }

    const result = await generateArgumentSet({
      sessionId,
      opponent,
      country,
      context,
    });

    return res.json({ ok: true, sessionId, opponent, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown argument generation error';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default argumentRoute;
