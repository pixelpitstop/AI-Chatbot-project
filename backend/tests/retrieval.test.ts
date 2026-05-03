import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'

const vectorStoreModulePath = '../src/rag/vectorStore'


describe('vectorStore', () => {
  const tmpFile = path.resolve(process.cwd(), 'data', 'test-vector-store.json')
  beforeEach(() => {
    process.env.VECTOR_STORE_FILE = tmpFile
    // ensure fresh module state
    vi.resetModules()
    vi.doMock('../src/services/ollamaService', () => ({
      createEmbedding: vi.fn(async (text: string) => {
        const len = Math.min(64, Math.max(1, Math.floor(text.length / 5)))
        return Array.from({ length: len }, (_, i) => (i + 1) * 0.01)
      }),
    }))
  })

  afterEach(async () => {
    try {
      await fs.unlink(tmpFile)
    } catch { }
  })

  it('adds a document and returns chunkCount and usedEmbeddings', async () => {
    const { addDocument, searchDocuments } = await import(vectorStoreModulePath)

    const res = await addDocument({ title: 'T', content: 'alpha beta gamma delta', source: 'unit-test' })
    expect(res.chunkCount).toBeGreaterThanOrEqual(1)
    expect(res.usedEmbeddings).toBe(true)

    const results = await searchDocuments('alpha', 3)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].text).toContain('alpha')
  })

  it('falls back to lexical search when embeddings unavailable', async () => {
    // make createEmbedding throw for search
    const ollama = await import('../src/services/ollamaService')
      ; (ollama as any).createEmbedding = vi.fn(async () => { throw new Error('no embedding') })

    const { addDocument, searchDocuments } = await import(vectorStoreModulePath)
    // add with real embeddings by resetting mock
    const realCreate = vi.mocked(ollama.createEmbedding)
    // temporarily restore deterministic embedding for add
    vi.resetModules()
    // re-mock with deterministic for add
    vi.mock('../src/services/ollamaService', () => ({
      createEmbedding: vi.fn(async (text: string) => Array.from({ length: 4 }, () => 0.1))
    }))

    const vs = await import(vectorStoreModulePath)
    const added = await vs.addDocument({ title: 'Lex', content: 'the quick brown fox', source: 'unit-test' })
    expect(added.chunkCount).toBeGreaterThanOrEqual(1)

    // now force embedding failure during search by mocking createEmbedding to throw
    vi.mock('../src/services/ollamaService', () => ({
      createEmbedding: vi.fn(async () => { throw new Error('fail') })
    }))
    const vs2 = await import(vectorStoreModulePath)
    const results = await vs2.searchDocuments('quick fox', 3)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].text).toContain('quick')
  })
})
