import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { testOllamaConnection } from './services/ollamaService';
import chatRoute from './routes/chatRoute';
import documentRoute from './routes/documentRoute';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(chatRoute);
app.use(documentRoute);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'ai-mun-research-assistant-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/llm/test', async (_req: Request, res: Response) => {
  try {
    const result = await testOllamaConnection();
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Ollama error';
    res.status(502).json({
      ok: false,
      error: message,
    });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
  });
});

export default app;
