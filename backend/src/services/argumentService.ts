import { getStrategyMemory } from '../memory/strategyMemory';
import { searchDocuments } from '../rag/vectorStore';
import { generateResponse } from './ollamaService';

type ArgumentRequest = {
  sessionId: string;
  opponent: string;
  country?: string;
  context?: string;
};

type ArgumentOutput = {
  opening_statement: string;
  attack_arguments: string[];
  counters: string[];
  trap_question: string;
};

function safeJsonParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function asStringArray(value: unknown, expectedLength: number) {
  if (!Array.isArray(value)) {
    return Array.from({ length: expectedLength }, () => '');
  }

  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, expectedLength);

  while (cleaned.length < expectedLength) {
    cleaned.push('');
  }

  return cleaned;
}

function buildPrompt(input: {
  country: string;
  opponent: string;
  context: string;
  allies: string[];
  enemies: string[];
  strategyNotes: string[];
  opponentModel: string;
  retrievedText: string;
}) {
  return [
    '[SYSTEM]',
    'You are a MUN strategic advisor.',
    'Return valid JSON only with keys: opening_statement, attack_arguments, counters, trap_question.',
    'attack_arguments must have exactly 3 items and counters exactly 2 items.',
    '',
    '[USER CONTEXT]',
    `country: ${input.country || 'Unknown'}`,
    `allies: ${input.allies.join(', ') || 'None'}`,
    `enemies: ${input.enemies.join(', ') || 'None'}`,
    `opponent_model: ${input.opponentModel || 'Unknown'}`,
    `strategy_notes: ${input.strategyNotes.join(' | ') || 'None'}`,
    '',
    '[RETRIEVED CONTEXT]',
    input.retrievedText || 'No retrieved context.',
    '',
    '[TASK]',
    `Prepare strategy for ${input.country || 'our delegation'} against ${input.opponent}.`,
    `Additional context: ${input.context || 'None'}`,
  ].join('\n');
}

export async function generateArgumentSet(request: ArgumentRequest): Promise<ArgumentOutput> {
  const strategy = await getStrategyMemory(request.sessionId);
  const country = request.country?.trim() || strategy.country || 'Unknown';
  const query = `${country} ${request.opponent} ${request.context ?? ''}`.trim();
  const retrieved = await searchDocuments(query, Number(process.env.RAG_TOP_K ?? 4));
  const retrievedText = retrieved
    .map((item, index) => `${index + 1}. ${item.title}: ${item.text}`)
    .join('\n');

  const prompt = buildPrompt({
    country,
    opponent: request.opponent,
    context: request.context ?? '',
    allies: strategy.allies,
    enemies: strategy.enemies,
    strategyNotes: strategy.strategy_notes,
    opponentModel: strategy.opponent_models[request.opponent] ?? '',
    retrievedText,
  });

  const raw = await generateResponse(prompt);
  const parsed = safeJsonParse(raw);

  if (!parsed) {
    throw new Error('Argument generator returned non-JSON output');
  }

  return {
    opening_statement: typeof parsed.opening_statement === 'string' ? parsed.opening_statement.trim() : '',
    attack_arguments: asStringArray(parsed.attack_arguments, 3),
    counters: asStringArray(parsed.counters, 2),
    trap_question: typeof parsed.trap_question === 'string' ? parsed.trap_question.trim() : '',
  };
}
