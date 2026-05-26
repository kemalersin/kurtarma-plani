import { describe, expect, it } from 'vitest'
import {
  resolveRevolvingEffectiveRates,
  runRevolvingLedger,
  simulateRevolvingLedger,
} from '@/finance/cash-advance'
import { D } from '@/finance/decimal'

const RATES = {
  apr: { value: 0.0425, period: 'monthly' as const },
  limit: 30_000,
}

describe('resolveRevolvingEffectiveRates', () => {
  it('vergi yükünü brüt orana ekler', () => {
    const r = resolveRevolvingEffectiveRates({
      ...RATES,
      taxRateMonthly: 0.25,
    })
    expect(r.contractualMonthly).toBeCloseTo(0.0425 * 1.25, 6)
  })

  it('gecikme oranı yoksa akdi × 1.087 varsayar', () => {
    const r = resolveRevolvingEffectiveRates(RATES)
    expect(r.lateMonthly).toBeCloseTo(0.0425 * 1.087, 6)
  })
})

describe('runRevolvingLedger', () => {
  it('hareket yok, sadece açılış → bugüne kadar faiz tahakkuk eder', () => {
    const state = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [],
      rates: RATES,
      asOf: '2026-03-03T00:00:00Z', // 30 gün
    })
    expect(D(state.principal).toNumber()).toBeCloseTo(10_000, 2)
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(438, 0)
    expect(D(state.total).toNumber()).toBeCloseTo(10_438, 0)
  })

  it('vergi ile efektif faiz artar', () => {
    const base = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [],
      rates: RATES,
      asOf: '2026-03-03T00:00:00Z',
    })
    const taxed = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [],
      rates: { ...RATES, taxRateMonthly: 0.25 },
      asOf: '2026-03-03T00:00:00Z',
    })
    expect(Number(taxed.accruedInterest)).toBeGreaterThan(Number(base.accruedInterest))
  })

  it('ek kullanım sonrası faiz yeni anapara üzerinden işler', () => {
    const state = runRevolvingLedger({
      openingBalance: 0,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-02-01T00:00:00Z', amount: 10_000, type: 'draw' },
      ],
      rates: RATES,
      asOf: '2026-03-03T00:00:00Z',
    })
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(438, 0)
  })

  it('ödeme önce faizi, sonra anaparayı kapatır', () => {
    const state = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-03-03T00:00:00Z', amount: 500, type: 'payment' },
      ],
      rates: RATES,
      asOf: '2026-03-03T00:00:00Z',
    })
    expect(D(state.principal).toNumber()).toBeCloseTo(9938, 0)
    expect(D(state.accruedInterest).toNumber()).toBeCloseTo(0, 1)
  })

  it('aşırı ödeme anaparayı negatife düşürmez', () => {
    const state = runRevolvingLedger({
      openingBalance: 1_000,
      openingDate: '2026-02-01T00:00:00Z',
      transactions: [
        { date: '2026-02-02T00:00:00Z', amount: 100_000, type: 'payment' },
      ],
      rates: RATES,
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
      rates: RATES,
      asOf: '2026-02-20T00:00:00Z',
    })
    const expected = D(10_000).times('0.0425').div(30).times(5)
      .plus(D(15_000).times('0.0425').div(30).times(5))
    expect(D(a.accruedInterest).toNumber()).toBeCloseTo(expected.toNumber(), 1)
  })

  it('limit altında asgari ödeme %20 hesaplanır', () => {
    const state = runRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-03-01T00:00:00Z',
      transactions: [],
      rates: { ...RATES, limit: 20_000 },
      asOf: '2026-03-15T00:00:00Z',
    })
    expect(state.minPaymentRate).toBe(0.2)
    expect(Number(state.minPayment)).toBeGreaterThan(0)
  })

  it('asgari altı ödemede gecikme faizi tahakkuk eder', () => {
    const { state, periods } = simulateRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-01-01T00:00:00Z',
      transactions: [],
      rates: {
        ...RATES,
        lateApr: { value: 0.0455, period: 'monthly' },
      },
      asOf: '2026-03-15T00:00:00Z',
    })
    const jan = periods.find((p) => p.monthKey === '2026-01')
    expect(jan?.paid).toBe(false)
    expect(jan?.lateInterest ?? 0).toBeGreaterThan(0)
    expect(Number(state.lateInterest)).toBeGreaterThan(0)
  })

  it('asgari ödendiğinde gecikme faizi yok', () => {
    const { periods } = simulateRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-01-01T00:00:00Z',
      transactions: [
        { date: '2026-01-20T00:00:00Z', amount: 3_000, type: 'payment' },
      ],
      rates: RATES,
      asOf: '2026-02-15T00:00:00Z',
    })
    const jan = periods.find((p) => p.monthKey === '2026-01')
    expect(jan?.paid).toBe(true)
    expect(jan?.lateInterest).toBe(0)
  })

  it('devam eden ay için dönem satırı üretir (ay sonu gelmeden)', () => {
    const asOf = '2026-03-15T12:00:00.000Z'
    const { state, periods } = simulateRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-01-01T00:00:00Z',
      transactions: [],
      rates: RATES,
      asOf,
    })
    const current = periods.find((p) => p.monthKey === '2026-03')
    expect(current).toBeDefined()
    expect(current!.minPayment).toBeCloseTo(Number(state.minPayment), 2)
    expect(current!.endingBalance).toBeCloseTo(Number(state.total), 2)
    expect(current!.contractualInterest).toBeGreaterThan(0)
  })

  it('devam eden ay dönem satırında birikmiş gecikme faizi görünür', () => {
    const asOf = '2026-03-15T12:00:00.000Z'
    const { state, periods } = simulateRevolvingLedger({
      openingBalance: 10_000,
      openingDate: '2026-01-01T00:00:00Z',
      transactions: [],
      rates: {
        ...RATES,
        lateApr: { value: 0.0455, period: 'monthly' },
      },
      asOf,
    })
    expect(Number(state.lateInterest)).toBeGreaterThan(0)
    const current = periods.find((p) => p.monthKey === '2026-03')
    expect(current?.lateInterest ?? 0).toBeGreaterThan(0)
    expect(current!.lateInterest).toBe(Number(state.lateInterest))
  })

  it('ay içindeki tüm akdi tahakkuk dönem satırında toplanır', () => {
    const { periods } = simulateRevolvingLedger({
      openingBalance: 0,
      openingDate: '2026-03-01T00:00:00Z',
      transactions: [
        { date: '2026-03-01T00:00:00Z', amount: 10_000, type: 'draw' },
        { date: '2026-03-15T00:00:00Z', amount: 5_000, type: 'draw' },
      ],
      rates: RATES,
      asOf: '2026-03-20T00:00:00Z',
    })
    const mar = periods.find((p) => p.monthKey === '2026-03')
    expect(mar?.contractualInterest ?? 0).toBeGreaterThan(0)
  })
})
