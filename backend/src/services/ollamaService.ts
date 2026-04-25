type OllamaGenerateResult = {
  response: string;
};

type LlamaCppChatCompletionChoice = {
  message?: {
    role?: string;
    content?: string;
  };
  delta?: {
    role?: string;
    content?: string | null;
  };
};

type LlamaCppChatCompletionResult = {
  choices?: LlamaCppChatCompletionChoice[];
};

type OllamaEmbeddingResult = {
  embedding?: number[];
  embeddings?: number[][];
};

const llmProvider = (process.env.LLM_PROVIDER ?? 'ollama').toLowerCase();
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const ollamaModel = process.env.OLLAMA_MODEL ?? 'llama3';
const ollamaEmbeddingModel = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text';
const ollamaNumGpu = Number(process.env.OLLAMA_NUM_GPU ?? 0);
const llamaCppBaseUrl = process.env.LLAMA_CPP_BASE_URL ?? 'http://127.0.0.1:8081';

function buildLlamaCppUrl(pathname: string) {
  return new URL(pathname, llamaCppBaseUrl).toString();
}

function buildOllamaUrl(pathname: string) {
  return new URL(pathname, ollamaBaseUrl).toString();
}

export async function generateResponse(prompt: string): Promise<string> {
  if (llmProvider === 'llamacpp') {
    const response = await fetch(buildLlamaCppUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a concise geopolitical strategist for Model United Nations research.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 384,
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`llama.cpp generate failed (${response.status}): ${errorText}`);
    }

    const body = (await response.json()) as LlamaCppChatCompletionResult;
    return body.choices?.[0]?.message?.content ?? '';
  }

  const response = await fetch(buildOllamaUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: false,
      options: {
        num_gpu: Number.isNaN(ollamaNumGpu) ? 0 : ollamaNumGpu,
      },
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
      options: {
        num_gpu: Number.isNaN(ollamaNumGpu) ? 0 : ollamaNumGpu,
      },
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
  if (llmProvider === 'llamacpp') {
    const health = await fetch(buildLlamaCppUrl('/health'));
    if (!health.ok) {
      const errorText = await health.text();
      throw new Error(`llama.cpp health failed (${health.status}): ${errorText}`);
    }

    return {
      ok: true,
      model: 'llamacpp',
      response: 'llama.cpp is ready',
    };
  }

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
  if (llmProvider === 'llamacpp') {
    const response = await fetch(buildLlamaCppUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a concise geopolitical strategist for Model United Nations research.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 384,
        temperature: 0.2,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`llama.cpp stream failed (${response.status}): ${errorText}`);
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
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }

        const payload = trimmed.slice(5).trim();
        if (!payload) {
          continue;
        }

        if (payload === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(payload) as LlamaCppChatCompletionResult;
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
          }
        } catch {
          // Ignore non-JSON control chunks such as [DONE].
        }
      }
    }

    if (pending.trim().startsWith('data:')) {
      const payload = pending.trim().slice(5).trim();
      if (payload) {
        if (payload === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(payload) as LlamaCppChatCompletionResult;
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (typeof chunk === 'string' && chunk.length > 0) {
            onChunk(chunk);
          }
        } catch {
          // Ignore non-JSON control chunks such as [DONE].
        }
      }
    }

    return;
  }

  const response = await fetch(buildOllamaUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaModel,
      prompt,
      stream: true,
      options: {
        num_gpu: Number.isNaN(ollamaNumGpu) ? 0 : ollamaNumGpu,
      },
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
