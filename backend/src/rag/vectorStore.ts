import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createEmbedding } from '../services/ollamaService';
import { chunkText } from './textChunker';

type StoredChunk = {
  id: string;
  docId: string;
  title: string;
  source: string;
  tags: string[];
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: string;
};

type PersistedVectorStore = {
  chunks: StoredChunk[];
};

export type AddDocumentInput = {
  title: string;
  content: string;
  source?: string;
  tags?: string[];
};

export type SearchResult = {
  id: string;
  docId: string;
  title: string;
  source: string;
  tags: string[];
  text: string;
  score: number;
};

const vectorStoreFile = path.resolve(process.cwd(), process.env.VECTOR_STORE_FILE ?? 'data/vector-store.json');
let inMemoryChunks: StoredChunk[] = [];
let loaded = false;

function cosineSimilarity(first: number[], second: number[]): number {
  const size = Math.min(first.length, second.length);
  if (size === 0) {
    return 0;
  }

  let dot = 0;
  let firstNorm = 0;
  let secondNorm = 0;

  for (let index = 0; index < size; index += 1) {
    dot += first[index] * second[index];
    firstNorm += first[index] * first[index];
    secondNorm += second[index] * second[index];
  }

  if (firstNorm === 0 || secondNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(firstNorm) * Math.sqrt(secondNorm));
}

async function ensureLoaded() {
  if (loaded) {
    return;
  }

  try {
    const raw = await fs.readFile(vectorStoreFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedVectorStore>;
    inMemoryChunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }

    inMemoryChunks = [];
  }

  loaded = true;
}

async function persist() {
  const dir = path.dirname(vectorStoreFile);
  await fs.mkdir(dir, { recursive: true });

  const payload: PersistedVectorStore = {
    chunks: inMemoryChunks,
  };

  await fs.writeFile(vectorStoreFile, JSON.stringify(payload, null, 2), 'utf8');
}

export async function addDocument(input: AddDocumentInput) {
  await ensureLoaded();

  const docId = randomUUID();
  const source = input.source?.trim() || 'user';
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : [];
  const chunks = chunkText(input.content);

  if (chunks.length === 0) {
    throw new Error('Document content is empty after normalization');
  }

  const createdAt = new Date().toISOString();
  const newChunks: StoredChunk[] = [];
  let usedEmbeddings = true;

  for (let index = 0; index < chunks.length; index += 1) {
    const text = chunks[index];
    let embedding: number[] = [];

    try {
      embedding = await createEmbedding(text);
    } catch {
      usedEmbeddings = false;
    }

    newChunks.push({
      id: randomUUID(),
      docId,
      title: input.title,
      source,
      tags,
      chunkIndex: index,
      text,
      embedding,
      createdAt,
    });
  }

  inMemoryChunks.push(...newChunks);
  await persist();

  return {
    docId,
    chunkCount: newChunks.length,
    usedEmbeddings,
  };
}

export async function searchDocuments(query: string, limit = Number(process.env.RAG_TOP_K ?? 4)): Promise<SearchResult[]> {
  await ensureLoaded();

  if (!query.trim() || inMemoryChunks.length === 0) {
    return [];
  }

  const minSimilarity = Number(process.env.RAG_MIN_SCORE ?? 0.15);
  let queryEmbedding: number[];

  try {
    queryEmbedding = await createEmbedding(query);
  } catch {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3);

    const lexicalResults = inMemoryChunks
      .map((chunk) => {
        const text = chunk.text.toLowerCase();
        let score = 0;

        if (text.includes(query.toLowerCase())) {
          score += 1.5;
        }

        for (const term of terms) {
          if (text.includes(term)) {
            score += 1;
          }
        }

        return { chunk, score };
      })
      .filter(({ score }) => score > 0)
      .sort((first, second) => second.score - first.score)
      .slice(0, Math.max(1, limit));

    return lexicalResults.map(({ chunk, score }) => ({
      id: chunk.id,
      docId: chunk.docId,
      title: chunk.title,
      source: chunk.source,
      tags: chunk.tags,
      text: chunk.text,
      score,
    }));
  }

  const scored = inMemoryChunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter(({ score }) => score >= (Number.isNaN(minSimilarity) ? 0 : minSimilarity))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit * 3));

  const bestByDocument = new Map<string, { chunk: StoredChunk; score: number }>();
  for (const item of scored) {
    const existing = bestByDocument.get(item.chunk.docId);
    if (!existing || item.score > existing.score) {
      bestByDocument.set(item.chunk.docId, item);
    }
  }

  const finalResults = Array.from(bestByDocument.values())
    .sort((first, second) => second.score - first.score)
    .slice(0, Math.max(1, limit));

  return finalResults.map(({ chunk, score }) => ({
    id: chunk.id,
    docId: chunk.docId,
    title: chunk.title,
    source: chunk.source,
    tags: chunk.tags,
    text: chunk.text,
    score,
  }));
}
