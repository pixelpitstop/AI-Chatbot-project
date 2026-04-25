import { addRecentMemory, getRecentMemory } from '../memory';
import { searchDocuments } from '../rag/vectorStore';
import { generateResponse, streamResponse } from './ollamaService';

type ChatRequest = {
  sessionId: string;
  message: string;
};

type RetrievedChunk = {
  title: string;
  source: string;
  text: string;
  score: number;
};

function trimText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function buildPrompt(
  sessionId: string,
  message: string,
  memory: Array<{ role: string; content: string }>,
  retrievedChunks: RetrievedChunk[]
) {
  const recentMessages = memory
    .map((entry) => `${entry.role.toUpperCase()}: ${trimText(entry.content, 260)}`)
    .join('\n');

  const retrievedContext = retrievedChunks
    .map((chunk, index) => {
      const score = chunk.score.toFixed(3);
      return `${index + 1}. ${chunk.title} (${chunk.source}, score=${score}): ${trimText(chunk.text, 360)}`;
    })
    .join('\n');

  return [
    '[SYSTEM]',
    'You are a concise geopolitical strategist for Model United Nations research.',
    'Give direct, high-signal answers and avoid unnecessary verbosity.',
    '',
    '[SESSION]',
    `Session ID: ${sessionId}`,
    '',
    '[RETRIEVED CONTEXT]',
    retrievedContext || 'No retrieved context.',
    '',
    '[RECENT MEMORY]',
    recentMessages || 'No prior memory.',
    '',
    '[TASK]',
    message,
  ].join('\n');
}

async function prepareChat(sessionId: string, message: string) {
  const recentMessages = await getRecentMemory(sessionId);
  const topK = Number(process.env.RAG_TOP_K ?? 4);
  const retrievedChunks = await searchDocuments(message, Number.isNaN(topK) ? 4 : topK);
  const prompt = buildPrompt(sessionId, message, recentMessages, retrievedChunks);

  await addRecentMemory(sessionId, {
    role: 'user',
    content: message,
  });

  return { prompt, recentMessages, retrievedChunks };
}

export async function handleChat(request: ChatRequest) {
  const { prompt, recentMessages, retrievedChunks } = await prepareChat(request.sessionId, request.message);

  const reply = await generateResponse(prompt);

  await addRecentMemory(request.sessionId, {
    role: 'assistant',
    content: reply,
  });

  return {
    sessionId: request.sessionId,
    reply,
    memoryCount: recentMessages.length + 2,
    retrievedCount: retrievedChunks.length,
  };
}

export async function handleChatStream(request: ChatRequest, onChunk: (chunk: string) => void) {
  const { prompt, recentMessages, retrievedChunks } = await prepareChat(request.sessionId, request.message);
  let fullReply = '';

  await streamResponse(prompt, (chunk) => {
    fullReply += chunk;
    onChunk(chunk);
  });

  await addRecentMemory(request.sessionId, {
    role: 'assistant',
    content: fullReply,
  });

  return {
    sessionId: request.sessionId,
    reply: fullReply,
    memoryCount: recentMessages.length + 2,
    retrievedCount: retrievedChunks.length,
  };
}