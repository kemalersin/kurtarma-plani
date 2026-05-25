import { describe, expect, it } from 'vitest'
import {
  cashflowMonthRows,
  debtInstallmentMonthlySeries,
  debtInstallmentRows,
  filterCashflowRecords,
  movementRows,
} from './reports'
import type { AccountMovement } from '@/features/cashflow/movements'
import type {
  Account,
  Expense,
  Income,
  InstallmentCashAdvance,
  Loan,
  LoanPayment,
} from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function loan(over: Partial<Loan>): Loan {
  return {
    id: 'l1',
    name: 'Konut',
    bankId: 'b1',
    currency: 'TRY',
    principal: 100_000,
    termMonths: 12,
    interestRate: 2,
    interestPeriod: 'monthly',
    firstInstallmentDate: '2026-06-01T00:00:00.000Z',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as Loan
}

function income(over: Partial<Income>): Income {
  return {
    id: 'i1',
    name: 'Maaş',
    amount: 5000,
    plannedDate: '2026-05-15T00:00:00.000Z',
    actualDate: '2026-05-15T00:00:00.000Z',
    incomeTypeId: 'it1',
    accountId: 'a1',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as Income
}

function expense(over: Partial<Expense>): Expense {
  return {
    id: 'e1',
    name: 'Kira',
    amount: 2000,
    plannedDate: '2026-05-10T00:00:00.000Z',
    actualDate: '2026-05-10T00:00:00.000Z',
    expenseTypeId: 'et1',
    accountId: 'a1',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as Expense
}

function account(over: Partial<Account> = {}): Account {
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

describe('debtInstallmentRows', () => {
  it('aralıktaki taksitleri döner; banka filtresi uygular', () => {
    const rows = debtInstallmentRows(
      {
        loans: [loan({ bankId: 'b1' }), loan({ id: 'l2', bankId: 'b2', name: 'Taşıt' })],
        loanPayments: [] as LoanPayment[],
        installmentAdvances: [] as InstallmentCashAdvance[],
        installmentAdvancePayments: [],
        banks: [{ id: 'b1', name: 'Test Bankası' }],
        localCurrency: 'TRY',
      },
      {
        range: { from: '2026-06-01', to: '2026-12-31' },
        bankId: 'b1',
      },
      '2026-05-22T00:00:00.000Z',
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.bankId === 'b1')).toBe(true)
    expect(rows.every((r) => r.bankName === 'Test Bankası')).toBe(true)
    expect(rows.some((r) => r.status === 'upcoming')).toBe(true)
  })
})

describe('filterCashflowRecords', () => {
  it('banka ve kategori filtresini gelir kayıtlarına uygular', () => {
    const accounts = [
      account({ id: 'a1', bankId: 'b1' }),
      account({ id: 'a2', bankId: 'b2' }),
    ]
    const items = [
      income({ id: 'i1', accountId: 'a1', incomeTypeId: 'it1' }),
      income({ id: 'i2', accountId: 'a2', incomeTypeId: 'it2' }),
    ]
    const filtered = filterCashflowRecords(items, accounts, {
      range: { from: '2026-01-01', to: '2026-12-31' },
      bankId: 'b1',
      categoryId: 'it1',
    }, 'income')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.id).toBe('i1')
  })
})

describe('cashflowMonthRows', () => {
  it('aylık gelir/gider/net satırları üretir', () => {
    const rows = cashflowMonthRows(
      [income({ amount: 5000 })],
      [expense({ amount: 2000 })],
      { range: { from: '2026-05-01', to: '2026-05-31' } },
      [account()],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.month).toBe('2026-05')
    expect(Number(rows[0]!.income)).toBe(5000)
    expect(Number(rows[0]!.expense)).toBe(2000)
    expect(Number(rows[0]!.net)).toBe(3000)
  })
})

describe('movementRows', () => {
  it('tarih ve hesap filtresine göre hareketleri listeler', () => {
    const movements: AccountMovement[] = [
      {
        date: '2026-05-15T00:00:00.000Z',
        amount: 1000,
        accountId: 'a1',
        source: 'income',
        sourceId: 'i1',
      },
      {
        date: '2026-05-16T00:00:00.000Z',
        amount: -500,
        accountId: 'a2',
        source: 'expense',
        sourceId: 'e1',
      },
    ]
    const rows = movementRows(
      movements,
      [account({ id: 'a1' }), account({ id: 'a2', bankId: 'b2', name: 'Diğer' })],
      [],
      {
        range: { from: '2026-05-01', to: '2026-05-31' },
        endpointId: 'acc:a1',
      },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.endpointName).toBe('Vadesiz')
    expect(rows[0]!.amount).toBe(1000)
  })
})

describe('debtInstallmentMonthlySeries', () => {
  it('ödenmiş ve bekleyen tutarları ay bazında ayırır', () => {
    const series = debtInstallmentMonthlySeries(
      [
        {
          key: '1',
          debtKind: 'loan',
          debtId: 'l1',
          debtName: 'Konut',
          bankId: 'b1',
          bankName: 'Test Bankası',
          installmentIndex: 1,
          dueDate: '2026-06-01T00:00:00.000Z',
          amount: '1000',
          paid: true,
          status: 'paid',
        },
        {
          key: '2',
          debtKind: 'loan',
          debtId: 'l1',
          debtName: 'Konut',
          bankId: 'b1',
          bankName: 'Test Bankası',
          installmentIndex: 2,
          dueDate: '2026-07-01T00:00:00.000Z',
          amount: '2000',
          paid: false,
          status: 'upcoming',
        },
      ],
      { from: '2026-06-01', to: '2026-07-31' },
    )
    expect(series.months).toEqual(['2026-06', '2026-07'])
    expect(series.paid[0]).toBe(1000)
    expect(series.pending[1]).toBe(2000)
  })
})
