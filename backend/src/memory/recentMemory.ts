import { getRedisClient } from './redisClient';

export type MemoryRole = 'system' | 'user' | 'assistant';

export type MemoryItem = {
  role: MemoryRole;
  content: string;
  createdAt: string;
};

const keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'ai-mun';
const recentLimit = Number(process.env.RECENT_MEMORY_LIMIT ?? 12);

function recentMemoryKey(sessionId: string) {
  return `${keyPrefix}:recent:${sessionId}`;
}

export async function addRecentMemory(sessionId: string, item: Omit<MemoryItem, 'createdAt'>) {
  const client = await getRedisClient();
  const entry: MemoryItem = {
    ...item,
    createdAt: new Date().toISOString(),
  };

  await client.rPush(recentMemoryKey(sessionId), JSON.stringify(entry));
  await client.lTrim(recentMemoryKey(sessionId), -recentLimit, -1);
}

export async function getRecentMemory(sessionId: string) {
  const client = await getRedisClient();
  const rawItems = await client.lRange(recentMemoryKey(sessionId), 0, -1);

  return rawItems
    .map((item) => {
      try {
        return JSON.parse(item) as MemoryItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is MemoryItem => item !== null);
}

export async function clearRecentMemory(sessionId: string) {
  const client = await getRedisClient();
  await client.del(recentMemoryKey(sessionId));
}
