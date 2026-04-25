import { Router, type Request, type Response } from 'express';
import { handleChat, handleChatStream } from '../services/chatService';

const chatRoute = Router();

function sendSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

chatRoute.post('/chat', async (req: Request, res: Response) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const sessionId = typeof req.body.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : 'default';
    const stream = req.body.stream === true;

    if (!message) {
      return res.status(400).json({
        ok: false,
        error: 'message is required',
      });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const result = await handleChatStream({ sessionId, message }, (chunk) => {
        sendSse(res, 'chunk', { text: chunk });
      });

      sendSse(res, 'done', {
        sessionId: result.sessionId,
        memoryCount: result.memoryCount,
      });
      return res.end();
    }

    const result = await handleChat({ sessionId, message });

    return res.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown chat error';
    if (req.body?.stream === true) {
      sendSse(res, 'error', { error: errorMessage });
      return res.end();
    }

    return res.status(502).json({
      ok: false,
      error: errorMessage,
    });
  }
});

export default chatRoute;