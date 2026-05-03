import { describe, it, expect } from 'vitest'
import { chunkText } from '../src/rag/textChunker'

describe('textChunker', () => {
  it('returns empty array for empty/whitespace input', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n  ')).toEqual([])
  })

  it('returns a single chunk when text shorter than chunk size', () => {
    const text = 'short text example'
    const chunks = chunkText(text, 100, 10)
    expect(chunks.length).toBe(1)
    expect(chunks[0]).toContain('short text example')
  })

  it('produces overlapping chunks for long text', () => {
    const sentence = 'word '.repeat(500).trim()
    const chunks = chunkText(sentence, 200, 50)
    expect(chunks.length).toBeGreaterThan(1)
    // ensure overlap: last 10 chars of chunk i included in chunk i+1
    for (let i = 0; i < chunks.length - 1; i++) {
      const a = chunks[i]
      const b = chunks[i + 1]
      const overlap = a.slice(-30)
      expect(b.includes(overlap) || overlap.length < 1).toBe(true)
    }
  })
})
