import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import { buildCashAdvancePeriodSchedules } from '@/core/services/ai-context-export/cash-advance-period-schedules'
import { createAiContextFormatters } from '@/core/services/ai-context-export/format-helpers'

describe('buildCashAdvancePeriodSchedules', () => {
  it('geçmiş ay satırlarını export etmez; yalnızca güncel ay vadesi', () => {
    const asOf = '2026-05-26T12:00:00.000Z'
    const fmt = createAiContextFormatters(DEFAULT_LOCALE_SETTINGS)
    const schedules = buildCashAdvancePeriodSchedules({
      accounts: [
        {
          id: 'ca1',
          name: 'KMH',
          bankId: 'b1',
          currency: 'TRY',
          limit: 30_000,
          openingBalance: 0,
          openingDate: '2024-01-01T00:00:00.000Z',
          interestRate: 0.0425,
          interestPeriod: 'monthly',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      txns: [
        {
          id: 't1',
          accountId: 'ca1',
          date: '2024-03-15T10:00:00.000Z',
          amount: 10_000,
          type: 'draw',
          createdAt: '2024-03-15T10:00:00.000Z',
          updatedAt: '2024-03-15T10:00:00.000Z',
        },
      ],
      bankMap: new Map(),
      fmt,
      asOf,
    })

    expect(schedules).toHaveLength(1)
    expect(schedules[0]?.periods).toHaveLength(1)
    expect(schedules[0]?.periods[0]?.periodLabel).toBe('2026-05')
    expect(Number(schedules[0]?.periods[0]?.contractualInterest.value)).toBeGreaterThan(0)
  })

  it('asgari altında birikmiş gecikme faizi export satırında görünür', () => {
    const asOf = '2026-03-15T12:00:00.000Z'
    const fmt = createAiContextFormatters(DEFAULT_LOCALE_SETTINGS)
    const schedules = buildCashAdvancePeriodSchedules({
      accounts: [
        {
          id: 'ca1',
          name: 'KMH',
          bankId: 'b1',
          currency: 'TRY',
          limit: 30_000,
          openingBalance: 10_000,
          openingDate: '2026-01-01T00:00:00.000Z',
          interestRate: 0.0425,
          interestPeriod: 'monthly',
          lateInterestRate: 0.0455,
          lateInterestPeriod: 'monthly',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      txns: [],
      bankMap: new Map(),
      fmt,
      asOf,
    })

    expect(Number(schedules[0]?.periods[0]?.lateInterest.value)).toBeGreaterThan(0)
  })
})
