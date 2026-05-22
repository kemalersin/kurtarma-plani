import { describe, expect, it } from 'vitest'
import { resolveAnthropicModelId } from '@/features/ai/providers/anthropic-models'

describe('resolveAnthropicModelId', () => {
  it('maps convenience aliases to pinned snapshot IDs', () => {
    expect(resolveAnthropicModelId('claude-opus-4-0')).toBe('claude-opus-4-20250514')
    expect(resolveAnthropicModelId('claude-sonnet-4-5')).toBe('claude-sonnet-4-5-20250929')
  })

  it('passes through dateless and dated IDs unchanged', () => {
    expect(resolveAnthropicModelId('claude-opus-4-6')).toBe('claude-opus-4-6')
    expect(resolveAnthropicModelId('claude-opus-4-20250514')).toBe('claude-opus-4-20250514')
  })
})
