import { describe, expect, it } from 'vitest'
import {
  compareByDisplayLabel,
  compareCashflowActualDate,
  compareCashflowStatus,
} from '@/features/cashflow/cashflowListSorters'

function isoDaysFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe('compareByDisplayLabel', () => {
  it('açıklama boşsa yedek etikete göre sıralar', () => {
    const labelOf = (item: { description?: string; type: string }) =>
      item.description?.trim() || item.type
    expect(
      compareByDisplayLabel(
        { type: 'Avans' },
        { description: 'Bonus', type: 'Maaş' },
        labelOf,
      ),
    ).toBeLessThan(0)
  })
})

describe('compareCashflowActualDate', () => {
  it('boş tarihler sonda kalır', () => {
    expect(
      compareCashflowActualDate(
        { plannedDate: '2026-05-01', actualDate: '2026-05-02' },
        { plannedDate: '2026-05-01' },
      ),
    ).toBeLessThan(0)
  })

  it('ISO tarihe göre sıralar', () => {
    expect(
      compareCashflowActualDate(
        { plannedDate: '2026-05-01', actualDate: '2026-05-10' },
        { plannedDate: '2026-05-01', actualDate: '2026-05-02' },
      ),
    ).toBeGreaterThan(0)
  })
})

describe('compareCashflowStatus', () => {
  it('Türkçe etikete göre sıralar (Gerçekleşti < Planlı)', () => {
    expect(
      compareCashflowStatus(
        { plannedDate: isoDaysFromToday(-10), actualDate: isoDaysFromToday(-8) },
        { plannedDate: isoDaysFromToday(30) },
      ),
    ).toBeLessThan(0)
  })

  it('aynı etiket ailesinde periyot etiketine göre ayırır', () => {
    expect(
      compareCashflowStatus(
        { plannedDate: '2026-06-01', recurrence: 'monthly' },
        { plannedDate: '2026-06-01', recurrence: 'weekly' },
      ),
    ).not.toBe(0)
  })
})
