import { describe, expect, it } from 'vitest'
import { assetSnapshot, debtSnapshot, netWorth } from './snapshot'
import type { AccountMovement } from '@/features/cashflow/movements'
import type {
  Account,
  CashRegister,
  Loan,
} from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function acc(over: Partial<Account>): Account {
  return {
    id: 'a1',
    name: 'Vadesiz',
    bankId: 'b1',
    currency: 'TRY',
    openingBalance: 0,
    openingDate: ISO,
    type: 'checking',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as Account
}

function reg(over: Partial<CashRegister>): CashRegister {
  return {
    id: 'r1',
    name: 'Kasa',
    currency: 'TRY',
    openingBalance: 0,
    openingDate: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as CashRegister
}

describe('assetSnapshot', () => {
  it('local currency hesap+kasa toplar; dövizli olanı toplama dahil etmez', () => {
    const accounts = [
      acc({ id: 'try1', currency: 'TRY', openingBalance: 1000 }),
      acc({ id: 'usd1', currency: 'USD', openingBalance: 100 }),
    ]
    const registers = [reg({ id: 'k-try', currency: 'TRY', openingBalance: 200 })]
    const movements: AccountMovement[] = []
    const snap = assetSnapshot(accounts, registers, movements, 'TRY')
    expect(snap.total).toBe('1200')
    expect(snap.perAccount).toHaveLength(2)
    expect(snap.perRegister).toHaveLength(1)
  })

  it('archived hesapları hariç tutar', () => {
    const accounts = [
      acc({ id: 'a1', openingBalance: 1000 }),
      acc({ id: 'a2', openingBalance: 500, archived: true }),
    ]
    const snap = assetSnapshot(accounts, [], [], 'TRY')
    expect(snap.total).toBe('1000')
    expect(snap.perAccount).toHaveLength(1)
  })
})

describe('debtSnapshot', () => {
  it('boş input toplam 0', () => {
    const snap = debtSnapshot({
      loans: [],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
    })
    expect(snap.total).toBe('0')
    expect(snap.byType.loans).toBe('0')
    expect(snap.byType.creditCards).toBe('0')
    expect(snap.breakdown).toEqual([])
    expect(snap.overdueCount).toBe(0)
  })

  it('kredi anapara kalanını ekler', () => {
    const loan: Loan = {
      id: 'l1',
      bankId: 'b1',
      name: 'Test kredi',
      currency: 'TRY',
      principal: 12000,
      interestRate: 0.04,
      interestPeriod: 'monthly',
      termMonths: 12,
      startDate: '2026-02-01',
      firstInstallmentDate: '2026-03-01',
      createdAt: ISO,
      updatedAt: ISO,
    } as Loan
    const snap = debtSnapshot({
      loans: [loan],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
    })
    expect(Number(snap.byType.loans)).toBeGreaterThanOrEqual(11900)
    expect(Number(snap.byType.loans)).toBeLessThanOrEqual(12000)
    expect(snap.breakdown.find((b) => b.name === 'Krediler')).toBeDefined()
  })

  it('dövizli kredi local currency snap toplamına girmez', () => {
    const usdLoan: Loan = {
      id: 'l-usd',
      bankId: 'b1',
      name: 'USD kredi',
      currency: 'USD',
      principal: 10000,
      interestRate: 0.04,
      interestPeriod: 'monthly',
      termMonths: 12,
      startDate: '2026-02-01',
      firstInstallmentDate: '2026-03-01',
      createdAt: ISO,
      updatedAt: ISO,
    } as Loan
    const snap = debtSnapshot({
      loans: [usdLoan],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
    })
    expect(snap.total).toBe('0')
  })
})

describe('netWorth', () => {
  it('assets − debts', () => {
    const nw = netWorth(5000, 1500)
    expect(nw.net).toBe('3500')
    expect(nw.debtToAssetRatio).toBeCloseTo(0.3, 5)
  })

  it('assets 0 ise ratio 0', () => {
    const nw = netWorth(0, 1000)
    expect(nw.debtToAssetRatio).toBe(0)
    expect(nw.net).toBe('-1000')
  })
})
