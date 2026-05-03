import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { addDocument } from '../rag/vectorStore';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const uploadRoute = Router();

uploadRoute.post('/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'file is required' });
    }

    const originalName = req.file.originalname || 'uploaded';
    const title = typeof req.body.title === 'string' && req.body.title.trim() ? req.body.title.trim() : originalName;
    const tags = Array.isArray(req.body.tags) ? req.body.tags : (typeof req.body.tags === 'string' ? req.body.tags.split(',').map((t) => t.trim()).filter(Boolean) : []);

    const mime = req.file.mimetype || '';
    let text = '';

    if (mime === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      text = typeof data.text === 'string' ? data.text : '';
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalName.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = typeof result.value === 'string' ? result.value : '';
    } else {
      // Treat as plain text / markdown / fallback
      text = req.file.buffer.toString('utf8');
    }

    if (!text.trim()) {
      return res.status(400).json({ ok: false, error: 'extracted text is empty' });
    }

    const result = await addDocument({ title, content: text, source: 'upload', tags });
    return res.json({ ok: true, file: originalName, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';
    return res.status(500).json({ ok: false, error: message });
  }
});

export default uploadRoute;
