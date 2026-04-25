import { Router, type Request, type Response } from 'express';
import { addDocument, searchDocuments } from '../rag/vectorStore';

const documentRoute = Router();

documentRoute.post('/documents/add', async (req: Request, res: Response) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    const source = typeof req.body.source === 'string' ? req.body.source.trim() : 'user';
    const tags = Array.isArray(req.body.tags) ? req.body.tags : [];

    if (!title) {
      return res.status(400).json({ ok: false, error: 'title is required' });
    }

    if (!content) {
      return res.status(400).json({ ok: false, error: 'content is required' });
    }

    const result = await addDocument({ title, content, source, tags });
    return res.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown document add error';
    return res.status(502).json({ ok: false, error: message });
  }
});

documentRoute.get('/documents/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const topK = typeof req.query.k === 'string' ? Number(req.query.k) : Number(process.env.RAG_TOP_K ?? 4);

    if (!query) {
      return res.status(400).json({ ok: false, error: 'q query parameter is required' });
    }

    const results = await searchDocuments(query, Number.isNaN(topK) ? 4 : topK);
    return res.json({ ok: true, count: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown document search error';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default documentRoute;
