import { describe, expect, it } from 'vitest'
import { formatFractionAsPercent } from '@/core/locale/number-format'

describe('formatFractionAsPercent', () => {
  it('tr-TR locale ondalık ayırıcı kullanır', () => {
    expect(formatFractionAsPercent(0.0425, 'tr-TR')).toBe('4,25%')
  })

  it('en-US locale nokta ondalık kullanır', () => {
    expect(formatFractionAsPercent(0.3, 'en-US')).toBe('30%')
  })
})
