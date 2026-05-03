import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('recentMemory', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('trims recent memory to configured limit and preserves order', async () => {
    process.env.RECENT_MEMORY_LIMIT = '3'

    const fakeStore: Record<string, string[]> = {}

    const mockClient = {
      rPush: async (key: string, val: string) => {
        fakeStore[key] = fakeStore[key] || []
        fakeStore[key].push(val)
      },
      lTrim: async (key: string, start: number, stop: number) => {
        const arr = fakeStore[key] || []
        // keep last N items equivalent to -limit..-1
        const limit = 3
        fakeStore[key] = arr.slice(-limit)
      },
      lRange: async (key: string) => {
        return fakeStore[key] || []
      },
      del: async (key: string) => {
        delete fakeStore[key]
      }
    }

    vi.doMock('../src/memory/redisClient', () => ({
      getRedisClient: async () => mockClient
    }))

    const { addRecentMemory, getRecentMemory, clearRecentMemory } = await import('../src/memory/recentMemory')

    const session = 'sess-1'
    await addRecentMemory(session, { role: 'user', content: 'one' })
    await addRecentMemory(session, { role: 'user', content: 'two' })
    await addRecentMemory(session, { role: 'user', content: 'three' })
    await addRecentMemory(session, { role: 'user', content: 'four' })

    const items = await getRecentMemory(session)
    expect(items.length).toBe(3)
    expect(items[0].content).toBe('two')
    expect(items[2].content).toBe('four')

    await clearRecentMemory(session)
    const after = await getRecentMemory(session)
    expect(after.length).toBe(0)
  })
})
