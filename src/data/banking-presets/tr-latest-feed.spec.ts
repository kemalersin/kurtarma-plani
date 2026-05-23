import { describe, expect, it } from 'vitest'
import { BankingPresetSchema } from '@/core/types/banking-preset'
import feed from '../../../banking-presets/tr-latest.json'

describe('banking-presets/tr-latest.json feed', () => {
  it('BankingPresetSchema ile doğrulanır (source/fetchedAt olmadan)', () => {
    const parsed = BankingPresetSchema.parse(feed)
    expect(parsed.source).toBeUndefined()
    expect(parsed.fetchedAt).toBeUndefined()
    expect(parsed.id).toBe('tr-2026-01')
  })
})
