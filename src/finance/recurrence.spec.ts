import { describe, expect, it } from 'vitest'
import {
  expandRecurrenceOccurrences,
  iterateCashflowOccurrences,
  sumCashflowOccurrences,
} from '@/finance/recurrence'

describe('expandRecurrenceOccurrences', () => {
  it('aylık yinelenmeyi plan tarihinden üretir', () => {
    const occ = expandRecurrenceOccurrences(
      {
        plannedDate: '2026-01-15T00:00:00.000Z',
        amount: 1000,
        recurrence: 'monthly',
      },
      { from: '2026-01-01', to: '2026-03-31' },
    )
    expect(occ).toHaveLength(3)
    expect(occ[0]?.date.slice(0, 10)).toBe('2026-01-15')
    expect(occ[1]?.date.slice(0, 10)).toBe('2026-02-15')
    expect(occ[2]?.date.slice(0, 10)).toBe('2026-03-15')
  })

  it('haftalık yinelenmede aralık dışı atlanır', () => {
    const occ = expandRecurrenceOccurrences(
      {
        plannedDate: '2026-05-01T00:00:00.000Z',
        amount: 50,
        recurrence: 'weekly',
      },
      { from: '2026-05-10', to: '2026-05-20' },
    )
    expect(occ.length).toBeGreaterThan(0)
    for (const row of occ) {
      expect(row.date.slice(0, 10) >= '2026-05-10').toBe(true)
      expect(row.date.slice(0, 10) <= '2026-05-20').toBe(true)
    }
  })
})

describe('sumCashflowOccurrences', () => {
  it('yinelenen geliri aralıkta toplar', () => {
    const total = sumCashflowOccurrences(
      [
        {
          plannedDate: '2026-05-01T00:00:00.000Z',
          amount: 100,
          recurrence: 'monthly',
        },
        { plannedDate: '2026-05-10T00:00:00.000Z', amount: 200 },
      ],
      { from: '2026-05-01', to: '2026-05-31', basis: 'effective' },
    )
    expect(total).toBe('300')
  })

  it('actual bazında yinelenmeyi sayar, tek kayıtta actual yoksa atlar', () => {
    const total = sumCashflowOccurrences(
      [
        {
          plannedDate: '2026-05-01T00:00:00.000Z',
          amount: 100,
          recurrence: 'monthly',
        },
        { plannedDate: '2026-05-10T00:00:00.000Z', amount: 200 },
      ],
      { from: '2026-05-01', to: '2026-05-31', basis: 'actual' },
    )
    expect(total).toBe('100')
  })
})

describe('iterateCashflowOccurrences', () => {
  it('yinelenen kayıt gerçekleşmiş kabul edilir', () => {
    const occ = iterateCashflowOccurrences(
      {
        plannedDate: '2026-05-01T00:00:00.000Z',
        amount: 10,
        recurrence: 'daily',
      },
      { from: '2026-05-01', to: '2026-05-03', basis: 'actual' },
    )
    expect(occ).toHaveLength(3)
  })
})
