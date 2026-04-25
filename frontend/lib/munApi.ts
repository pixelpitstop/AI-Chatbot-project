const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export type StrategyMemory = {
  country: string;
  allies: string[];
  enemies: string[];
  strategy_notes: string[];
  opponent_models: Record<string, string>;
  updated_at: string;
};

export type ArgumentResult = {
  opening_statement: string;
  attack_arguments: string[];
  counters: string[];
  trap_question: string;
};

type ChatStreamHandlers = {
  onChunk: (text: string) => void;
  onDone?: (payload: { sessionId?: string; memoryCount?: number; retrievedCount?: number }) => void;
};

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return data;
}

export async function loadStrategy(sessionId: string): Promise<StrategyMemory> {
  const response = await fetch(`${apiBaseUrl}/strategy?sessionId=${encodeURIComponent(sessionId)}`);
  const data = (await response.json()) as { ok: boolean; strategy?: StrategyMemory; error?: string };

  if (!response.ok || !data.ok || !data.strategy) {
    throw new Error(data.error ?? `Strategy fetch failed (${response.status})`);
  }

  return data.strategy;
}

export async function saveStrategy(sessionId: string, strategy: Partial<StrategyMemory>) {
  return postJson<{ ok: boolean; strategy: StrategyMemory; error?: string }>('/strategy/update', {
    sessionId,
    ...strategy,
  });
}

export async function clearMemory(sessionId: string) {
  return postJson<{ ok: boolean; cleared: string[]; error?: string }>('/memory/clear', {
    sessionId,
  });
}

export async function generateArguments(input: {
  sessionId: string;
  opponent: string;
  country?: string;
  context?: string;
}): Promise<ArgumentResult> {
  const result = await postJson<
    { ok: boolean } & ArgumentResult & { error?: string }
  >('/argument/generate', input);

  return {
    opening_statement: result.opening_statement,
    attack_arguments: result.attack_arguments,
    counters: result.counters,
    trap_question: result.trap_question,
  };
}

function parseSseBlock(rawBlock: string) {
  const lines = rawBlock.split('\n').map((line) => line.trim());
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLine = lines.find((line) => line.startsWith('data:'));

  if (!eventLine || !dataLine) {
    return null;
  }

  const event = eventLine.replace('event:', '').trim();
  const dataText = dataLine.replace('data:', '').trim();

  try {
    return {
      event,
      data: JSON.parse(dataText) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export async function streamChat(
  input: { sessionId: string; message: string },
  handlers: ChatStreamHandlers
) {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: input.sessionId,
      message: input.message,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    let message = `Chat stream failed (${response.status})`;
    try {
      const errorPayload = (await response.json()) as { error?: string };
      if (errorPayload.error) {
        message = errorPayload.error;
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        message = errorText;
      }
    }

    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) {
        continue;
      }

      if (parsed.event === 'chunk') {
        const text = typeof parsed.data.text === 'string' ? parsed.data.text : '';
        if (text) {
          handlers.onChunk(text);
        }
      }

      if (parsed.event === 'error') {
        const errorMessage = typeof parsed.data.error === 'string' ? parsed.data.error : 'Unknown stream error';
        throw new Error(errorMessage);
      }

      if (parsed.event === 'done' && handlers.onDone) {
        handlers.onDone({
          sessionId: typeof parsed.data.sessionId === 'string' ? parsed.data.sessionId : undefined,
          memoryCount: typeof parsed.data.memoryCount === 'number' ? parsed.data.memoryCount : undefined,
          retrievedCount: typeof parsed.data.retrievedCount === 'number' ? parsed.data.retrievedCount : undefined,
        });
      }
    }
  }
}
