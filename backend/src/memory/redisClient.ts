import { createClient } from 'redis';

let clientPromise: Promise<ReturnType<typeof createClient>> | null = null;

function createRedisClient() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  return createClient({ url });
}

export async function getRedisClient() {
  if (!clientPromise) {
    const client = createRedisClient();

    client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    clientPromise = client.connect().then(() => client);
  }

  return clientPromise;
}
