import { describe, expect, it } from 'vitest'
import {
  compareByDisplayLabel,
  compareNumeric,
  compareProgressCounts,
  compareIsoDate,
} from '@/core/util/list-sorters'

describe('compareByDisplayLabel', () => {
  it('Türkçe locale ile sıralar', () => {
    expect(
      compareByDisplayLabel({ label: 'Avans' }, { label: 'Maaş' }, (item) => item.label),
    ).toBeLessThan(0)
  })
})

describe('compareNumeric', () => {
  it('sayısal fark döndürür', () => {
    expect(compareNumeric({ v: 10 }, { v: 3 }, (item) => item.v)).toBe(7)
  })
})

describe('compareIsoDate', () => {
  it('boş tarihler sonda kalır', () => {
    expect(compareIsoDate('2026-05-01', undefined)).toBeLessThan(0)
  })
})

describe('compareProgressCounts', () => {
  it('önce ödenen taksit sayısına göre sıralar', () => {
    expect(
      compareProgressCounts({ paidCount: 2, totalCount: 12 }, { paidCount: 5, totalCount: 12 }),
    ).toBeLessThan(0)
  })

  it('eşit ödemede toplam vadeye göre ayırır', () => {
    expect(
      compareProgressCounts({ paidCount: 3, totalCount: 10 }, { paidCount: 3, totalCount: 24 }),
    ).toBeLessThan(0)
  })
})
