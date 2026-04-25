import { promises as fs } from 'node:fs';
import path from 'node:path';

export type OpponentModels = Record<string, string>;

export type StrategyMemory = {
  country: string;
  allies: string[];
  enemies: string[];
  strategy_notes: string[];
  opponent_models: OpponentModels;
  updated_at: string;
};

type StrategyStore = {
  sessions: Record<string, StrategyMemory>;
};

type StrategyUpdateInput = {
  country?: string;
  allies?: string[];
  enemies?: string[];
  strategy_notes?: string[];
  opponent_models?: Record<string, unknown>;
};

const strategyStoreFile = path.resolve(process.cwd(), process.env.STRATEGY_STORE_FILE ?? 'data/strategy-memory.json');
let strategyStore: StrategyStore = { sessions: {} };
let loaded = false;

function normalizeList(values: string[] | undefined, fallback: string[]) {
  if (!Array.isArray(values)) {
    return fallback;
  }

  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeOpponentModels(input: Record<string, unknown> | undefined, fallback: OpponentModels) {
  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const normalized: OpponentModels = {};
  for (const [name, model] of Object.entries(input)) {
    const key = name.trim();
    const value = typeof model === 'string' ? model.trim() : '';
    if (key && value) {
      normalized[key] = value;
    }
  }

  return {
    ...fallback,
    ...normalized,
  };
}

function emptyStrategyMemory(): StrategyMemory {
  return {
    country: '',
    allies: [],
    enemies: [],
    strategy_notes: [],
    opponent_models: {},
    updated_at: new Date().toISOString(),
  };
}

async function ensureLoaded() {
  if (loaded) {
    return;
  }

  try {
    const raw = await fs.readFile(strategyStoreFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StrategyStore>;
    strategyStore = {
      sessions: parsed.sessions ?? {},
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }

    strategyStore = { sessions: {} };
  }

  loaded = true;
}

async function persistStore() {
  const dir = path.dirname(strategyStoreFile);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(strategyStoreFile, JSON.stringify(strategyStore, null, 2), 'utf8');
}

export async function getStrategyMemory(sessionId: string): Promise<StrategyMemory> {
  await ensureLoaded();
  return strategyStore.sessions[sessionId] ?? emptyStrategyMemory();
}

export async function updateStrategyMemory(sessionId: string, updates: StrategyUpdateInput): Promise<StrategyMemory> {
  await ensureLoaded();

  const previous = strategyStore.sessions[sessionId] ?? emptyStrategyMemory();
  const next: StrategyMemory = {
    country: typeof updates.country === 'string' ? updates.country.trim() : previous.country,
    allies: normalizeList(updates.allies, previous.allies),
    enemies: normalizeList(updates.enemies, previous.enemies),
    strategy_notes: normalizeList(updates.strategy_notes, previous.strategy_notes),
    opponent_models: normalizeOpponentModels(updates.opponent_models, previous.opponent_models),
    updated_at: new Date().toISOString(),
  };

  strategyStore.sessions[sessionId] = next;
  await persistStore();

  return next;
}

export async function clearStrategyMemory(sessionId: string) {
  await ensureLoaded();
  delete strategyStore.sessions[sessionId];
  await persistStore();
}
