import { describe, expect, it } from 'vitest'
import {
  cashflowStatus,
  computeDebtCoverage,
  sumByDateRange,
} from '@/finance/cashflow'
import { D } from '@/finance/decimal'

describe('cashflowStatus', () => {
  const today = new Date('2026-05-15T00:00:00Z')

  it('gerçek tarihi olan → realized', () => {
    expect(
      cashflowStatus({ plannedDate: '2026-05-10', actualDate: '2026-05-12' }, today),
    ).toBe('realized')
  })
  it('vade dün → overdue', () => {
    expect(cashflowStatus({ plannedDate: '2026-05-10' }, today)).toBe('overdue')
  })
  it('vade bugün + 5 gün → due', () => {
    expect(cashflowStatus({ plannedDate: '2026-05-20' }, today)).toBe('due')
  })
  it('vade 1 ay sonra → upcoming', () => {
    expect(cashflowStatus({ plannedDate: '2026-06-30' }, today)).toBe('upcoming')
  })
})

describe('sumByDateRange', () => {
  const items = [
    { plannedDate: '2026-05-01', actualDate: '2026-05-02', amount: 100 },
    { plannedDate: '2026-05-10', amount: 200 },
    { plannedDate: '2026-05-20', actualDate: '2026-05-22', amount: 300 },
    { plannedDate: '2026-06-01', amount: 50 },
  ]

  it('aralıksız → tüm plan tarihleri', () => {
    expect(sumByDateRange(items)).toBe('650')
  })
  it('plan tarihi bazlı filtreleme', () => {
    expect(sumByDateRange(items, { from: '2026-05-05', to: '2026-05-25' })).toBe('500')
  })
  it('actual tarihli kayıtları say', () => {
    expect(
      sumByDateRange(items, { from: '2026-05-01', to: '2026-05-31', basis: 'actual' }),
    ).toBe('400')
  })
  it('effective: actual yoksa planı kullan', () => {
    expect(
      sumByDateRange(items, { from: '2026-05-05', to: '2026-05-25', basis: 'effective' }),
    ).toBe('500')
  })
})

describe('computeDebtCoverage', () => {
  it('yeterli nakit + gelir', () => {
    const r = computeDebtCoverage({
      cashOnHand: 10_000,
      expectedIncome: 5_000,
      expectedExpense: 2_000,
      debtDue: 8_000,
    })
    expect(D(r.netSurplus).toNumber()).toBeCloseTo(5_000, 2)
    expect(r.canCover).toBe(true)
    expect(r.coveragePercent).toBe(1)
  })
  it('borç karşılanamıyor', () => {
    const r = computeDebtCoverage({
      cashOnHand: 1_000,
      expectedIncome: 2_000,
      expectedExpense: 500,
      debtDue: 10_000,
    })
    expect(D(r.netSurplus).toNumber()).toBeLessThan(0)
    expect(r.canCover).toBe(false)
    expect(r.coveragePercent).toBeCloseTo(0.25, 2) // 2500 / 10000
  })
  it('borç sıfırsa ve nakit yeterliyse %100 karşılama', () => {
    const r = computeDebtCoverage({
      cashOnHand: 0,
      expectedIncome: 0,
      expectedExpense: 0,
      debtDue: 0,
    })
    expect(r.canCover).toBe(true)
    expect(r.coveragePercent).toBe(1)
    expect(r.debtDue).toBe('0')
  })
  it('borç sıfır ama giderler karşılanamıyorsa %0 gösterir', () => {
    const r = computeDebtCoverage({
      cashOnHand: 1_000,
      expectedIncome: 0,
      expectedExpense: 5_000,
      debtDue: 0,
    })
    expect(r.canCover).toBe(false)
    expect(r.coveragePercent).toBe(0)
  })
  it('available borca çok yakınken coveragePercent 1 olmaz', () => {
    const r = computeDebtCoverage({
      cashOnHand: 9_990,
      expectedIncome: 0,
      expectedExpense: 0,
      debtDue: 10_000,
    })
    expect(r.canCover).toBe(false)
    expect(r.coveragePercent).toBeLessThan(1)
  })
})
