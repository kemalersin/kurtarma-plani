import { describe, expect, it } from 'vitest'
import { assetSnapshot, debtSnapshot, debtTotalsByBankId, netWorth } from './snapshot'
import type { AccountMovement } from '@/features/cashflow/movements'
import { buildScheduleForLoan, payoffForLoan, remainingDebtForLoan } from '@/features/debts/loanHelpers'
import type {
  Account,
  CashAdvanceAccount,
  CashRegister,
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
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
    expect(snap.earlyPayoffTotal).toBe('0')
    expect(snap.byType.loans).toBe('0')
    expect(snap.byType.creditCards).toBe('0')
    expect(snap.breakdown).toEqual([])
    expect(snap.overdueCount).toBe(0)
  })

  it('kredi kalan borcunu ekler (ödenmemiş taksitler + gecikme faizi)', () => {
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
    const schedule = buildScheduleForLoan(loan)
    const expected = remainingDebtForLoan(loan, schedule, 0, ISO)
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
      asOf: ISO,
    })
    expect(snap.byType.loans).toBe(expected)
    expect(Number(snap.byType.loans)).toBeGreaterThan(12000)
    const payoff = payoffForLoan(loan, schedule, 0, ISO)
    expect(snap.earlyPayoffTotal).toBe(payoff)
    expect(Number(snap.earlyPayoffTotal)).toBeLessThan(Number(snap.byType.loans))
    expect(snap.breakdown.find((b) => b.name === 'Krediler')).toBeDefined()
  })

  it('taksitli kart alışverişi geri ödeme toplamını borca yansıtır', () => {
    const card: CreditCard = {
      id: 'cc1',
      bankId: 'b1',
      name: 'Kart',
      currency: 'TRY',
      limit: 50_000,
      openingBalance: 0,
      statementCutoffDay: 15,
      paymentDueDay: 25,
      purchaseAprMonthly: 0,
      createdAt: ISO,
      updatedAt: ISO,
    } as CreditCard
    const txn: CreditCardTransaction = {
      id: 'tx1',
      cardId: 'cc1',
      date: '2026-04-20T10:00:00.000Z',
      type: 'purchase',
      amount: 12_000,
      installmentCount: 12,
      repaymentTotal: 12_000,
      createdAt: ISO,
      updatedAt: ISO,
    } as CreditCardTransaction

    // asOf = 1 May 2026 → yalnız 1 taksit (20 Nis) tahakkuk
    const snap = debtSnapshot({
      loans: [],
      loanPayments: [],
      creditCards: [card],
      creditCardTransactions: [txn],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
      asOf: ISO,
    })
    // Toplam yükümlülük = 12.000 (1.000 ekstre + 11.000 gelecek)
    expect(snap.byType.creditCards).toBe('12000')
    expect(Number(snap.total)).toBe(12_000)
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

describe('debtTotalsByBankId', () => {
  it('banka başına kredi kalan borcunu toplar', () => {
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
    const loan2: Loan = {
      ...loan,
      id: 'l2',
      bankId: 'b2',
      name: 'Diğer',
      principal: 5000,
    } as Loan
    const totals = debtTotalsByBankId({
      loans: [loan, loan2],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
    })
    expect(Number(totals.get('b1') ?? '0')).toBeGreaterThan(0)
    expect(Number(totals.get('b2') ?? '0')).toBeGreaterThan(0)
    expect(Number(totals.get('b1') ?? '0')).toBeGreaterThan(Number(totals.get('b2') ?? '0'))
  })

  it('debtSnapshot toplamı banka toplamlarının birleşimine eşit', () => {
    const loan: Loan = {
      id: 'l1',
      bankId: 'b1',
      name: 'Test kredi',
      currency: 'TRY',
      principal: 8000,
      interestRate: 0.04,
      interestPeriod: 'monthly',
      termMonths: 12,
      startDate: '2026-02-01',
      firstInstallmentDate: '2026-03-01',
      createdAt: ISO,
      updatedAt: ISO,
    } as Loan
    const input = {
      loans: [loan],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
    }
    const snap = debtSnapshot(input)
    const byBank = debtTotalsByBankId(input)
    let sum = 0
    for (const total of byBank.values()) sum += Number(total)
    expect(sum).toBeCloseTo(Number(snap.total), 2)
  })

  it('bağlı taksitli avans nakit avans borcuna değil taksitli avans borcuna yazılır', () => {
    const account: CashAdvanceAccount = {
      id: 'ca-1',
      name: 'KMH',
      bankId: 'b1',
      currency: 'TRY',
      limit: 50_000,
      openingBalance: 0,
      openingDate: '2026-01-01T00:00:00.000Z',
      interestRate: 0.04,
      interestPeriod: 'monthly',
      createdAt: ISO,
      updatedAt: ISO,
    } as CashAdvanceAccount
    const linkedAdvance: InstallmentCashAdvance = {
      id: 'ia-1',
      name: 'Taksitli avans',
      bankId: 'b1',
      cashAdvanceAccountId: 'ca-1',
      currency: 'TRY',
      principal: 25_000,
      termMonths: 3,
      startDate: '2026-03-15T00:00:00.000Z',
      firstInstallmentDate: '2026-04-15T00:00:00.000Z',
      interestRate: 0.04,
      interestPeriod: 'monthly',
      createdAt: ISO,
      updatedAt: ISO,
    } as InstallmentCashAdvance
    const standaloneAdvance: InstallmentCashAdvance = {
      ...linkedAdvance,
      id: 'ia-2',
      name: 'Bağımsız avans',
      cashAdvanceAccountId: undefined,
    }

    const linkedSnap = debtSnapshot({
      loans: [],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [account],
      cashAdvanceTransactions: [],
      installmentAdvances: [linkedAdvance],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
      asOf: '2026-04-01T00:00:00.000Z',
    })
    const standaloneSnap = debtSnapshot({
      loans: [],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [],
      cashAdvanceTransactions: [],
      installmentAdvances: [standaloneAdvance],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
      asOf: '2026-04-01T00:00:00.000Z',
    })

    expect(Number(linkedSnap.byType.cashAdvances)).toBe(0)
    expect(Number(linkedSnap.byType.installmentAdvances)).toBeGreaterThan(0)
    expect(Number(standaloneSnap.byType.installmentAdvances)).toBeGreaterThan(0)
    expect(Number(standaloneSnap.byType.cashAdvances)).toBe(0)
  })

  it('bağlı taksitli avans banka borcunda taksitli avans kaleminde sayılır', () => {
    const account: CashAdvanceAccount = {
      id: 'ca-1',
      name: 'KMH',
      bankId: 'b1',
      currency: 'TRY',
      limit: 50_000,
      openingBalance: 0,
      openingDate: '2026-01-01T00:00:00.000Z',
      interestRate: 0.04,
      interestPeriod: 'monthly',
      createdAt: ISO,
      updatedAt: ISO,
    } as CashAdvanceAccount
    const linkedAdvance: InstallmentCashAdvance = {
      id: 'ia-1',
      name: 'Taksitli avans',
      bankId: 'b1',
      cashAdvanceAccountId: 'ca-1',
      currency: 'TRY',
      principal: 25_000,
      termMonths: 3,
      startDate: '2026-03-15T00:00:00.000Z',
      firstInstallmentDate: '2026-04-15T00:00:00.000Z',
      interestRate: 0.04,
      interestPeriod: 'monthly',
      createdAt: ISO,
      updatedAt: ISO,
    } as InstallmentCashAdvance
    const input = {
      loans: [],
      loanPayments: [],
      creditCards: [],
      creditCardTransactions: [],
      cashAdvanceAccounts: [account],
      cashAdvanceTransactions: [],
      installmentAdvances: [linkedAdvance],
      installmentAdvancePayments: [],
      localCurrency: 'TRY',
      asOf: '2026-04-01T00:00:00.000Z',
    }
    const snap = debtSnapshot(input)
    const byBank = debtTotalsByBankId(input)
    expect(Number(snap.byType.installmentAdvances)).toBeGreaterThan(0)
    expect(Number(snap.byType.cashAdvances)).toBe(0)
    expect(Number(byBank.get('b1') ?? '0')).toBe(Number(snap.byType.installmentAdvances))
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
