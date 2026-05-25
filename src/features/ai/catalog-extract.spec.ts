import { describe, expect, it } from 'vitest'
import { extractCatalogFromApiJson } from '@/features/ai/catalog-extract'

describe('extractCatalogFromApiJson', () => {
  it('desteklenen provider modellerini çıkarır', () => {
    const raw = {
      anthropic: {
        name: 'Anthropic',
        models: {
          'claude-3-haiku': {
            id: 'claude-3-haiku',
            name: 'Claude 3 Haiku',
            cost: { input: 0.25, output: 1.25, cache_read: 0.03 },
            limit: { context: 200000 },
          },
        },
      },
      openai: { name: 'OpenAI', models: {} },
    }
    const catalog = extractCatalogFromApiJson(raw, '2026-05-22T00:00:00.000Z')
    expect(catalog.fetchedAt).toBe('2026-05-22T00:00:00.000Z')
    expect(catalog.providers.anthropic?.models['claude-3-haiku']?.cost.input).toBe(0.25)
    expect(catalog.providers.openai?.models).toEqual({})
    expect(catalog.providers.gemini).toBeUndefined()
  })

  it('geçersiz yanıtta hata fırlatır', () => {
    expect(() => extractCatalogFromApiJson(null)).toThrow()
  })
})
