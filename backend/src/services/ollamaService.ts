type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OllamaGenerateResult = {
  response: string;
};

type OllamaEmbeddingResult = {
  embedding?: number[];
  embeddings?: number[][];
};

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3';
const ollamaEmbeddingModel = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';

function buildOllamaUrl(pathname: string) {
  return new URL(pathname, ollamaBaseUrl).toString();
}

export async function generateResponse(prompt: string): Promise<string> {
  const response = await fetch(buildOllamaUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama generate failed (${response.status}): ${errorText}`);
  }

  const body = (await response.json()) as OllamaGenerateResult;
  return body.response ?? '';
}

export async function createEmbedding(input: string): Promise<number[]> {
  const response = await fetch(buildOllamaUrl('/api/embeddings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaEmbeddingModel,
      prompt: input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embedding failed (${response.status}): ${errorText}`);
  }

  const body = (await response.json()) as OllamaEmbeddingResult;
  if (Array.isArray(body.embedding) && body.embedding.length > 0) {
    return body.embedding;
  }

  if (Array.isArray(body.embeddings) && Array.isArray(body.embeddings[0]) && body.embeddings[0].length > 0) {
    return body.embeddings[0];
  }

  throw new Error('Ollama embedding response did not include a valid embedding vector');
}

export async function testOllamaConnection(): Promise<{ ok: boolean; model: string; response: string }> {
  const response = await generateResponse('Reply with exactly: Ollama is ready');

  return {
    ok: true,
    model: ollamaModel,
    response,
  };
}

export async function streamResponse(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch(buildOllamaUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Ollama stream failed (${response.status}): ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const parsed = JSON.parse(line) as Partial<{ response: string; done: boolean }>;
      if (parsed.response) {
        onChunk(parsed.response);
      }
    }
  }

  if (pending.trim()) {
    const parsed = JSON.parse(pending) as Partial<{ response: string; done: boolean }>;
    if (parsed.response) {
      onChunk(parsed.response);
    }
  }
}
