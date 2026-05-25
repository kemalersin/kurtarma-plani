import { describe, expect, it } from 'vitest'
import {
  installmentDebtStatusLabel,
  installmentDebtStatusTag,
} from './installmentDebtListStatus'

describe('installmentDebtListStatus', () => {
  it('aktif durumda mavi etiket döner', () => {
    expect(
      installmentDebtStatusTag({ paidCount: 2, totalCount: 12, overdue: 0 }),
    ).toEqual({ color: 'processing', label: 'Devam ediyor' })
  })

  it('kapandı durumunda yeşil etiket döner', () => {
    expect(
      installmentDebtStatusTag({ paidCount: 12, totalCount: 12, overdue: 0 }),
    ).toEqual({ color: 'success', label: 'Kapandı' })
  })

  it('gecikmede kırmızı etiket döner', () => {
    expect(
      installmentDebtStatusLabel({ paidCount: 1, totalCount: 12, overdue: 2 }),
    ).toBe('2 gecikmiş')
    expect(
      installmentDebtStatusTag({ paidCount: 1, totalCount: 12, overdue: 2 }),
    ).toEqual({ color: 'error', label: '2 gecikmiş' })
  })
})
