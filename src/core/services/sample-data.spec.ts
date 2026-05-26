import { describe, expect, it } from 'vitest'
import { buildSampleProfileRows } from '@/core/services/sample-data'
import type {
  CashAdvanceAccount,
  CreditCard,
  InstallmentCashAdvance,
  Loan,
} from '@/core/types/entities'

describe('buildSampleProfileRows', () => {
  it('anlamlı çeşitlilikte kayıt üretir', () => {
    const rows = buildSampleProfileRows('TRY', new Date('2026-05-15T12:00:00.000Z'))
    expect(rows.length).toBeGreaterThan(25)

    const types = new Set(rows.map((r) => r.type))
    expect(types.has('bank')).toBe(true)
    expect(types.has('loan')).toBe(true)
    expect(types.has('creditCard')).toBe(true)
    expect(types.has('income')).toBe(true)
    expect(types.has('expense')).toBe(true)
    expect(types.has('transfer')).toBe(true)
  })

  it('gelir/gider kayıtları hesap veya kasaya bağlıdır', () => {
    const rows = buildSampleProfileRows()
    const incomes = rows.filter((r) => r.type === 'income')
    const expenses = rows.filter((r) => r.type === 'expense')
    for (const row of [...incomes, ...expenses]) {
      const data = row.data as { accountId?: string; cashRegisterId?: string }
      expect(Boolean(data.accountId) !== Boolean(data.cashRegisterId)).toBe(true)
    }
  })

  it('faiz oranları ondalık kesir olarak saklanır (yüzde değil)', () => {
    const rows = buildSampleProfileRows()
    const loan = rows.find((r) => r.id === 'sample-loan-need')?.data as Loan
    const card = rows.find((r) => r.id === 'sample-card-bonus')?.data as CreditCard
    const cashAdv = rows.find((r) => r.id === 'sample-cash-advance')?.data as CashAdvanceAccount
    const inst = rows.find((r) => r.id === 'sample-installment-advance')?.data as InstallmentCashAdvance

    expect(loan.interestRate).toBe(0.0289)
    expect(loan.lateInterestRate).toBe(0.03757)
    expect(loan.taxRateMonthly).toBe(0.3)
    expect(card.purchaseAprMonthly).toBe(0.0375)
    expect(card.lateAprMonthly).toBe(0.0405)
    expect(cashAdv.interestRate).toBe(0.0425)
    expect(cashAdv.lateInterestRate).toBe(0.0455)
    expect(inst.interestRate).toBe(0.0365)
    expect(inst.lateInterestRate).toBe(0.04745)
    expect(inst.taxRateMonthly).toBe(0.3)
  })
})
