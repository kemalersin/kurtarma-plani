import { describe, expect, it } from 'vitest'
import { runRevolvingLedger } from '@/finance/cash-advance'
import { D } from '@/finance/decimal'

const APR = { value: 0.0425, period: 'monthly' as const }

describe('runRevolvingLedger', () => {
  it('hareket yok, sadece açılış → bugüne kadar faiz tahakkuk eder', () => {
    const state = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [],
      apr: APR,
      asOf: '2026-03-03T00:00:00Z', // 30 gün
    })
    // 30 günde: 10000 * (0.0425/30) * 30 = 425
    expect(D(state.principal).toNumber()).toBeCloseTo(10_000, 2)
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(425, 1)
    expect(D(state.total).toNumber()).toBeCloseTo(10_425, 1)
  })

  it('ek kullanım sonrası faiz yeni anapara üzerinden işler', () => {
    const state = runRevolvingLedger({
      openingBalance: 0,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-02-01T00:00:00Z', amount: 10_000, type: 'draw' },
      ],
      apr: APR,
      asOf: '2026-03-03T00:00:00Z',
    })
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(425, 1)
  })

  it('ödeme önce faizi, sonra anaparayı kapatır', () => {
    const state = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        // 30 gün sonra 500 öde → 425 faizi kapatır + 75 anaparadan düşer
        { date: '2026-03-03T00:00:00Z', amount: 500, type: 'payment' },
      ],
      apr: APR,
      asOf: '2026-03-03T00:00:00Z',
    })
    expect(D(state.principal).toNumber()).toBeCloseTo(9_925, 1)
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(0, 1)
  })

  it('aşırı ödeme anaparayı negatife düşürmez', () => {
    const state = runRevolvingLedger({
      openingBalance: 1_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-02-02T00:00:00Z', amount: 100_000, type: 'payment' },
      ],
      apr: APR,
      asOf: '2026-02-02T00:00:00Z',
    })
    expect(state.principal).toBe('0')
  })

  it('hareketler kronolojik sıraya konur', () => {
    const a = runRevolvingLedger({
      openingBalance: 0,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-02-15T00:00:00Z', amount: 5_000, type: 'draw' },
        { date: '2026-02-10T00:00:00Z', amount: 10_000, type: 'draw' },
      ],
      apr: APR,
      asOf: '2026-02-20T00:00:00Z',
    })
    // 02-10 sonrası 10000 → 5 gün faiz (0.0425/30*5*10000)
    // 02-15 sonrası 15000 → 5 gün faiz (0.0425/30*5*15000)
    const expected = D(10_000).times('0.0425').div(30).times(5)
      .plus(D(15_000).times('0.0425').div(30).times(5))
    expect(D(a.accruedInterest).toNumber()).toBeCloseTo(expected.toNumber(), 1)
  })
})
