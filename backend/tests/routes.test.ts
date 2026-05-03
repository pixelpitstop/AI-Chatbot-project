import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../src/services/chatService', () => ({
  handleChat: vi.fn(async ({ sessionId, message }: any) => ({ sessionId, message, memoryCount: 1 })),
  handleChatStream: vi.fn(async ({ sessionId, message }: any, onChunk: (chunk: string) => void) => {
    onChunk('first')
    onChunk('second')
    return { sessionId, memoryCount: 2 }
  })
}))

describe('chatRoute', () => {
  let app: express.Express

  beforeEach(async () => {
    vi.resetModules()
    app = express()
    app.use(express.json())
    const chatRoute = (await import('../src/routes/chatRoute')).default
    app.use(chatRoute)
  })

  it('returns 400 for missing message', async () => {
    await request(app).post('/chat').send({ sessionId: 's1' }).expect(400)
  })

  it('returns JSON response when stream=false', async () => {
    const res = await request(app).post('/chat').send({ sessionId: 's1', message: 'hello', stream: false }).expect(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.sessionId).toBe('s1')
  })

  it('streams SSE when stream=true', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ sessionId: 's2', message: 'stream me', stream: true })

    // SSE should set the correct content-type header and return 200
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
  })
})
