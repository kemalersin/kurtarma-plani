import { describe, expect, it } from 'vitest'
import {
  cashflowMonthRows,
  debtInstallmentMonthlySeries,
  debtInstallmentRows,
  debtInstallmentTableAmount,
  debtInstallmentTypeLabel,
  filterCashflowRecords,
  movementRows,
} from './reports'
import { cashAdvanceState } from '@/features/debts/cashAdvanceHelpers'
import type { AccountMovement } from '@/features/cashflow/movements'
import type {
  Account,
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CreditCard,
  CreditCardTransaction,
  Expense,
  Income,
  InstallmentCashAdvance,
  Loan,
  LoanPayment,
} from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function installmentAdvance(over: Partial<InstallmentCashAdvance>): InstallmentCashAdvance {
  return {
    id: 'ica1',
    name: 'Taksitli avans',
    bankId: 'b1',
    currency: 'TRY',
    principal: 50_000,
    termMonths: 6,
    startDate: '2026-02-01T00:00:00.000Z',
    interestRate: 0.04,
    interestPeriod: 'monthly',
    firstInstallmentDate: '2026-03-01T00:00:00.000Z',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as InstallmentCashAdvance
}

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

function creditCard(over: Partial<CreditCard> = {}): CreditCard {
  return {
    id: 'card-1',
    bankId: 'b1',
    name: 'Bonus',
    currency: 'TRY',
    limit: 50_000,
    openingBalance: 0,
    statementCutoffDay: 15,
    paymentDueDay: 25,
    purchaseAprMonthly: 0,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as CreditCard
}

function cardTxn(
  partial: Pick<CreditCardTransaction, 'date' | 'amount' | 'type'> &
    Partial<CreditCardTransaction>,
): CreditCardTransaction {
  return {
    id: partial.id ?? `txn-${partial.date}`,
    cardId: 'card-1',
    createdAt: ISO,
    updatedAt: ISO,
    ...partial,
  } as CreditCardTransaction
}

const emptyDebtInput = {
  loans: [] as Loan[],
  loanPayments: [] as LoanPayment[],
  installmentAdvances: [] as InstallmentCashAdvance[],
  installmentAdvancePayments: [],
  cashAdvanceAccounts: [] as CashAdvanceAccount[],
  cashAdvanceTransactions: [] as CashAdvanceTransaction[],
  creditCards: [] as CreditCard[],
  creditCardTransactions: [] as CreditCardTransaction[],
  banks: [{ id: 'b1', name: 'Test Bankası' }],
  localCurrency: 'TRY',
}

function cashAdvanceAccount(over: Partial<CashAdvanceAccount> = {}): CashAdvanceAccount {
  return {
    id: 'ca-1',
    name: 'Nakit Avans',
    bankId: 'b1',
    currency: 'TRY',
    limit: 30_000,
    openingBalance: 5_000,
    openingDate: '2026-01-01T00:00:00.000Z',
    interestRate: 0.0425,
    interestPeriod: 'monthly',
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as CashAdvanceAccount
}

function cashAdvanceTxn(
  partial: Pick<CashAdvanceTransaction, 'date' | 'amount' | 'type'> &
    Partial<CashAdvanceTransaction>,
): CashAdvanceTransaction {
  return {
    id: partial.id ?? `ca-txn-${partial.date}`,
    accountId: 'ca-1',
    createdAt: ISO,
    updatedAt: ISO,
    ...partial,
  } as CashAdvanceTransaction
}

describe('debtInstallmentTypeLabel', () => {
  it('kredi ve avans satırlarında taksit sırasını tür etiketine ekler', () => {
    expect(
      debtInstallmentTypeLabel({
        key: '1',
        debtKind: 'loan',
        debtId: 'l1',
        debtName: 'Konut',
        bankId: 'b1',
        bankName: 'Bank',
        installmentIndex: 3,
        dueDate: '2026-06-01',
        amount: '1000',
        paid: false,
        status: 'upcoming',
      }),
    ).toBe('Kredi 3. taksiti')
    expect(
      debtInstallmentTypeLabel({
        key: '2',
        debtKind: 'creditCardMinPayment',
        debtId: 'c1',
        debtName: 'Bonus',
        bankId: 'b1',
        bankName: 'Bank',
        installmentIndex: 0,
        dueDate: '2026-06-01',
        amount: '500',
        paid: false,
        status: 'upcoming',
      }),
    ).toBe('Kart asgari ödeme')
    expect(
      debtInstallmentTypeLabel({
        key: '3',
        debtKind: 'cashAdvance',
        debtId: 'ca1',
        debtName: 'KMH',
        bankId: 'b1',
        bankName: 'Bank',
        installmentIndex: 0,
        dueDate: '2026-06-30',
        amount: '8500',
        paid: false,
        status: 'upcoming',
      }),
    ).toBe('Nakit avans asgari')
  })
})

describe('debtInstallmentRows', () => {
  it('aralıktaki taksitleri döner; banka filtresi uygular', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        loans: [loan({ bankId: 'b1' }), loan({ id: 'l2', bankId: 'b2', name: 'Taşıt' })],
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

  it('kredi planı aralıkla kesişiyorsa tüm taksitleri listeler (son vadeler aralık dışında olsa bile)', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        loans: [
          loan({
            firstInstallmentDate: '2026-02-01T00:00:00.000Z',
            termMonths: 12,
          }),
        ],
      },
      {
        range: { from: '2025-11-26', to: '2026-11-26' },
      },
      '2026-05-26T00:00:00.000Z',
    )
    const loanRows = rows.filter((r) => r.debtKind === 'loan')
    expect(loanRows).toHaveLength(12)
    expect(loanRows.map((r) => r.installmentIndex).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    expect(loanRows.some((r) => r.dueDate.startsWith('2027-'))).toBe(true)
  })

  it('kredi planı aralıkla kesişmiyorsa listede görünmez', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        loans: [
          loan({
            firstInstallmentDate: '2027-06-01T00:00:00.000Z',
            termMonths: 12,
          }),
        ],
      },
      {
        range: { from: '2025-11-26', to: '2026-11-26' },
      },
      '2026-05-26T00:00:00.000Z',
    )
    expect(rows.filter((r) => r.debtKind === 'loan')).toHaveLength(0)
  })

  it('geciken taksitli avans borcu tabloda rollup satırında dueAmount ile görünür', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        installmentAdvances: [
          installmentAdvance({
            firstInstallmentDate: '2026-03-01T00:00:00.000Z',
            termMonths: 6,
          }),
        ],
      },
      { range: { from: '2026-01-01', to: '2026-12-31' } },
      '2026-03-15T00:00:00.000Z',
    )
    const advRows = rows
      .filter((r) => r.debtKind === 'installmentAdvance')
      .sort((a, b) => a.installmentIndex - b.installmentIndex)
    expect(advRows[0]!.status).toBe('overdue')
    expect(Number(advRows[1]!.dueAmount)).toBeGreaterThan(Number(advRows[1]!.amount))
    expect(Number(debtInstallmentTableAmount(advRows[1]!))).toBe(
      Number(advRows[1]!.dueAmount),
    )
    expect(Number(debtInstallmentTableAmount(advRows[0]!))).toBe(
      Number(advRows[0]!.amount),
    )
  })

  it('geciken kredi taksitlerinde faiz bir sonraki vade satırına yansır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        loans: [
          loan({
            firstInstallmentDate: '2026-03-01T00:00:00.000Z',
            termMonths: 6,
            interestRate: 0.04,
            interestPeriod: 'monthly',
          }),
        ],
      },
      { range: { from: '2026-01-01', to: '2026-12-31' } },
      '2026-03-15T00:00:00.000Z',
    )
    const loanRows = rows
      .filter((r) => r.debtKind === 'loan')
      .sort((a, b) => a.installmentIndex - b.installmentIndex)
    expect(loanRows[0]!.installmentIndex).toBe(1)
    expect(Number(loanRows[1]!.amount)).toBe(Number(loanRows[0]!.amount))
    expect(Number(loanRows[2]!.amount)).toBe(Number(loanRows[0]!.amount))
    expect(Number(loanRows[1]!.dueAmount)).toBeGreaterThan(Number(loanRows[1]!.amount))
    expect(Number(loanRows[2]!.dueAmount)).toBe(Number(loanRows[2]!.amount))
  })

  it('kredi taksit listesinde Tutar plan, Ödenen gerçek ödeme tutarıdır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        loans: [
          loan({
            firstInstallmentDate: '2026-03-01T00:00:00.000Z',
            termMonths: 6,
            interestRate: 0.04,
            interestPeriod: 'monthly',
          }),
        ],
        loanPayments: [
          {
            id: 'p1',
            loanId: 'l1',
            installmentIndex: 1,
            paidDate: '2026-03-20T00:00:00.000Z',
            paidAmount: 10_500,
            createdAt: ISO,
            updatedAt: ISO,
          } as LoanPayment,
        ],
      },
      { range: { from: '2026-01-01', to: '2026-12-31' } },
      '2026-04-01T00:00:00.000Z',
    )
    const paid = rows.find((r) => r.debtKind === 'loan' && r.installmentIndex === 1)
    expect(paid).toBeDefined()
    expect(Number(paid!.paidAmount)).toBe(10_500)
    expect(Number(paid!.amount)).toBeGreaterThan(Number(paid!.paidAmount))
    expect(paid!.paid).toBe(true)
  })

  it('toplam ödeme modunda gelecek vadeler birbirine yansımaz; her dönem bağımsız', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard()],
        creditCardTransactions: [
          cardTxn({
            id: 'taksit',
            date: '2026-05-20T10:00:00.000Z',
            amount: 15_000,
            type: 'purchase',
            installmentCount: 3,
            repaymentTotal: 16_292.68,
            description: 'Alışveriş',
          }),
        ],
      },
      { range: { from: '2026-06-01', to: '2026-08-31' }, cardDueMode: 'statement' },
      '2026-05-26T00:00:00.000Z',
    )
    const stmtRows = rows.filter((r) => r.debtKind === 'creditCardStatement')
    expect(stmtRows).toHaveLength(3)
    expect(stmtRows.every((r) => r.debtName === 'Bonus')).toBe(true)
    const amounts = stmtRows
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((r) => Number(r.amount))
    for (const a of amounts) expect(a).toBeCloseTo(5430.89, 0)
    expect(rows.every((r) => r.debtKind !== 'creditCardMinPayment')).toBe(true)
  })

  it('toplam ödeme modunda geçmişte kalmış ödenmemiş borç sonraki vadeye faizle yansır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard({ purchaseAprMonthly: 0.03, lateAprMonthly: 0.035 })],
        creditCardTransactions: [
          cardTxn({
            id: 'taksit',
            date: '2026-05-20T10:00:00.000Z',
            amount: 15_000,
            type: 'purchase',
            installmentCount: 3,
            repaymentTotal: 16_292.68,
          }),
        ],
      },
      { range: { from: '2026-06-01', to: '2026-08-31' }, cardDueMode: 'statement' },
      '2026-08-31T00:00:00.000Z',
    )
    const amounts = rows
      .filter((r) => r.debtKind === 'creditCardStatement')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((r) => Number(r.amount))
    expect(amounts).toHaveLength(3)
    expect(amounts[1]!).toBeGreaterThan(amounts[0]!)
    expect(amounts[2]!).toBeGreaterThan(amounts[1]!)
  })

  it('toplam ödeme: tüm vadeler geçmiş + ödenmemişse taksitler bittikten sonra biriken borç devam eder', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard({ purchaseAprMonthly: 0.03, lateAprMonthly: 0.035 })],
        creditCardTransactions: [
          cardTxn({
            id: 'taksit',
            date: '2026-05-20T10:00:00.000Z',
            amount: 15_000,
            type: 'purchase',
            installmentCount: 3,
            repaymentTotal: 16_292.68,
          }),
        ],
      },
      { range: { from: '2026-09-01', to: '2026-10-31' }, cardDueMode: 'statement' },
      '2026-10-31T00:00:00.000Z',
    )
    const stmtRows = rows.filter((r) => r.debtKind === 'creditCardStatement')
    expect(stmtRows.length).toBeGreaterThan(0)
    expect(Number(stmtRows[0]!.amount)).toBeGreaterThan(16_292)
  })

  it('asgari modda gelecek dönemler bağımsız; her dönem yalnız o ayın asgarisi', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard({ limit: 20_000 })],
        creditCardTransactions: [
          cardTxn({
            id: 'taksit',
            date: '2026-05-20T10:00:00.000Z',
            amount: 15_000,
            type: 'purchase',
            installmentCount: 3,
            repaymentTotal: 16_292.68,
          }),
        ],
      },
      { range: { from: '2026-06-01', to: '2026-08-31' }, cardDueMode: 'min' },
      '2026-05-26T00:00:00.000Z',
    )
    const minRows = rows
      .filter((r) => r.debtKind === 'creditCardMinPayment')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    expect(minRows).toHaveLength(3)
    const amounts = minRows.map((r) => Number(r.amount))
    for (const a of amounts) expect(a).toBeCloseTo(amounts[0]!, 1)
    expect(amounts.every((a) => a > 0 && a < 6000)).toBe(true)
  })

  it('asgari modda geçmiş kalmış ödenmemiş borç sonraki asgariyi artırır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard({ limit: 20_000 })],
        creditCardTransactions: [
          cardTxn({
            id: 'taksit',
            date: '2026-05-20T10:00:00.000Z',
            amount: 15_000,
            type: 'purchase',
            installmentCount: 3,
            repaymentTotal: 16_292.68,
          }),
        ],
      },
      { range: { from: '2026-06-01', to: '2026-08-31' }, cardDueMode: 'min' },
      '2026-08-31T00:00:00.000Z',
    )
    const minRows = rows
      .filter((r) => r.debtKind === 'creditCardMinPayment')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    expect(minRows).toHaveLength(3)
    const amounts = minRows.map((r) => Number(r.amount))
    expect(amounts[1]!).toBeGreaterThan(amounts[0]!)
    expect(amounts[2]!).toBeGreaterThan(amounts[1]!)
  })

  it('varsayılan modda kart toplam ödeme vadelerini listeler; ödeme kaydı varsa ödendi sayar', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [creditCard({ limit: 20_000 })],
        creditCardTransactions: [
          cardTxn({
            id: 'buy',
            date: '2026-06-20T10:00:00.000Z',
            amount: 2000,
            type: 'purchase',
          }),
          cardTxn({
            id: 'pay',
            date: '2026-07-10T10:00:00.000Z',
            amount: 500,
            type: 'payment',
          }),
        ],
      },
      { range: { from: '2026-07-01', to: '2026-08-31' } },
      '2026-08-22T00:00:00.000Z',
    )
    const stmtRows = rows.filter((r) => r.debtKind === 'creditCardStatement')
    expect(stmtRows.length).toBeGreaterThan(0)
    const paidRow = stmtRows.find((r) => Number(r.paidAmount) === 500)
    expect(paidRow).toBeDefined()
    expect(paidRow!.paid).toBe(false)
    expect(rows.every((r) => r.debtKind !== 'creditCardMinPayment')).toBe(true)
  })

  it('asgari ödeme modunda pencere toplamı ödenen tutar olarak yansır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [
          creditCard({
            limit: 200_000,
            purchaseAprMonthly: 0.0375,
            lateAprMonthly: 0.0455,
          }),
        ],
        creditCardTransactions: [
          cardTxn({
            id: 'buy',
            date: '2026-02-05T12:00:00.000Z',
            amount: 10_000,
            type: 'purchase',
            repaymentTotal: 12_000,
          }),
          cardTxn({
            id: 'pay',
            date: '2026-02-20T12:00:00.000Z',
            amount: 5_000,
            type: 'payment',
          }),
        ],
      },
      {
        range: { from: '2026-02-01', to: '2026-05-31' },
        cardDueMode: 'min',
      },
      '2026-05-26T12:00:00.000Z',
    )
    const feb = rows.find(
      (r) => r.debtKind === 'creditCardMinPayment' && r.dueDate.startsWith('2026-02'),
    )
    expect(feb).toBeDefined()
    expect(feb!.paid).toBe(true)
    expect(Number(feb!.paidAmount)).toBeCloseTo(5_000, 0)
  })

  it('nakit avans hesabı ay sonu bakiyesini sonraki aya taşır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        cashAdvanceAccounts: [cashAdvanceAccount()],
        cashAdvanceTransactions: [
          cashAdvanceTxn({
            date: '2026-03-10T00:00:00.000Z',
            amount: 2_000,
            type: 'draw',
          }),
        ],
      },
      { range: { from: '2026-03-01', to: '2026-06-30' } },
      '2026-06-15T12:00:00.000Z',
    )
    const caRows = rows.filter((r) => r.debtKind === 'cashAdvanceStatement')
    expect(caRows.length).toBeGreaterThanOrEqual(2)
    expect(caRows.every((r) => r.debtName === 'Nakit Avans')).toBe(true)
    const amounts = caRows.map((r) => Number(r.amount))
    expect(Math.max(...amounts)).toBeGreaterThan(Math.min(...amounts))
  })

  it('nakit avans toplam ödeme modunda asgari tutardan büyük listelenir', () => {
    const input = {
      ...emptyDebtInput,
      cashAdvanceAccounts: [cashAdvanceAccount()],
      cashAdvanceTransactions: [
        cashAdvanceTxn({
          date: '2026-03-10T00:00:00.000Z',
          amount: 2_000,
          type: 'draw',
        }),
      ],
    }
    const range = { from: '2026-03-01', to: '2026-06-30' }
    const today = '2026-06-15T12:00:00.000Z'
    const minRows = debtInstallmentRows(input, { range, cardDueMode: 'min' }, today).filter(
      (r) => r.debtKind === 'cashAdvance',
    )
    const totalRows = debtInstallmentRows(
      input,
      { range, cardDueMode: 'statement' },
      today,
    ).filter((r) => r.debtKind === 'cashAdvanceStatement')
    expect(minRows.length).toBeGreaterThan(0)
    expect(totalRows.length).toBeGreaterThan(0)
    const marMin = minRows.find((r) => r.dueDate.startsWith('2026-03'))
    const marTotal = totalRows.find((r) => r.dueDate.startsWith('2026-03'))
    expect(marMin).toBeDefined()
    expect(marTotal).toBeDefined()
    expect(Number(marTotal!.amount)).toBeGreaterThan(Number(marMin!.amount))
  })

  it('nakit avans asgari satırı güncel ay minPayment ile borç listesi uyumlu', () => {
    const today = '2026-06-15T12:00:00.000Z'
    const account = cashAdvanceAccount()
    const txns = [
      cashAdvanceTxn({
        date: '2026-03-10T00:00:00.000Z',
        amount: 2_000,
        type: 'draw',
      }),
    ]
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        cashAdvanceAccounts: [account],
        cashAdvanceTransactions: txns,
        cashAdvanceTaxRateMonthly: 0.25,
      },
      { range: { from: '2026-06-01', to: '2026-06-30' }, cardDueMode: 'min' },
      today,
    )
    const june = rows.find(
      (r) => r.debtKind === 'cashAdvance' && r.dueDate.startsWith('2026-06'),
    )
    expect(june).toBeDefined()
    const state = cashAdvanceState(account, txns, today, 0.25)
    expect(Number(june!.amount)).toBeCloseTo(Number(state.minPayment), 0)
  })

  it('nakit avans borcu bugünden sonraki aylara yansımaz', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        cashAdvanceAccounts: [cashAdvanceAccount()],
        cashAdvanceTransactions: [
          cashAdvanceTxn({
            date: '2026-03-10T00:00:00.000Z',
            amount: 2_000,
            type: 'draw',
          }),
        ],
      },
      { range: { from: '2026-03-01', to: '2026-12-31' } },
      '2026-06-15T12:00:00.000Z',
    )
    const caRows = rows.filter((r) => r.debtKind === 'cashAdvanceStatement')
    expect(caRows.length).toBeGreaterThan(0)
    expect(caRows.every((r) => r.dueDate.slice(0, 7) <= '2026-06')).toBe(true)
    expect(caRows.some((r) => r.dueDate.startsWith('2026-07'))).toBe(false)
  })

  it('nakit avans kapama ödemesi grafik ve listede görünür', () => {
    const range = { from: '2026-06-01', to: '2026-06-30' }
    const today = '2026-06-25T12:00:00.000Z'
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        cashAdvanceAccounts: [cashAdvanceAccount({ openingBalance: 0 })],
        cashAdvanceTransactions: [
          cashAdvanceTxn({
            date: '2026-06-05T00:00:00.000Z',
            amount: 5_000,
            type: 'draw',
          }),
          cashAdvanceTxn({
            date: '2026-06-20T00:00:00.000Z',
            amount: 6_000,
            type: 'payment',
          }),
        ],
      },
      { range, cardDueMode: 'statement' },
      today,
    )
    const june = rows.find(
      (r) =>
        r.debtKind === 'cashAdvanceStatement' && r.dueDate.startsWith('2026-06'),
    )
    expect(june).toBeDefined()
    expect(june!.paid).toBe(true)
    expect(Number(june!.paidAmount)).toBeCloseTo(6_000, 0)

    const series = debtInstallmentMonthlySeries(rows, range)
    const idx = series.months.indexOf('2026-06')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(series.paid[idx]!).toBeGreaterThan(0)
  })

  it('devreden açılış bakiyesi dönem toplam ödemesine dahil edilir', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [
          creditCard({
            openingBalance: 25_000,
            openingDate: '2026-05-15T00:00:00.000Z',
          }),
        ],
        creditCardTransactions: [],
      },
      { range: { from: '2026-05-01', to: '2026-08-31' }, cardDueMode: 'statement' },
      '2026-07-15T12:00:00.000Z',
    )
    const stmtRows = rows
      .filter((r) => r.debtKind === 'creditCardStatement')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    expect(stmtRows.length).toBeGreaterThan(0)
    expect(Number(stmtRows[0]!.amount)).toBe(25_000)
    expect(rows.every((r) => r.debtKind !== 'creditCardOpeningBalance')).toBe(true)
  })

  it('açılış tarihi dönem ortasındaysa devreden bakiye o dönem ekstresine yansır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [
          creditCard({
            openingBalance: 10_000,
            openingDate: '2026-05-20T00:00:00.000Z',
          }),
        ],
        creditCardTransactions: [
          cardTxn({
            id: 'buy',
            date: '2026-05-25T10:00:00.000Z',
            amount: 2_000,
            type: 'purchase',
          }),
        ],
      },
      { range: { from: '2026-05-01', to: '2026-06-30' }, cardDueMode: 'statement' },
      '2026-06-10T12:00:00.000Z',
    )
    const juneStmt = rows.find(
      (r) => r.debtKind === 'creditCardStatement' && r.dueDate.startsWith('2026-06'),
    )
    expect(juneStmt).toBeDefined()
    expect(Number(juneStmt!.amount)).toBe(12_000)
  })

  it('toplam ödeme modunda geç ödeme pencere toplamını ödenen olarak yansıtır', () => {
    const rows = debtInstallmentRows(
      {
        ...emptyDebtInput,
        creditCards: [
          creditCard({
            limit: 200_000,
            purchaseAprMonthly: 0.0375,
            lateAprMonthly: 0.0455,
          }),
        ],
        creditCardTransactions: [
          cardTxn({
            id: 'buy',
            date: '2026-02-05T12:00:00.000Z',
            amount: 10_000,
            type: 'purchase',
            repaymentTotal: 12_000,
          }),
          cardTxn({
            id: 'pay',
            date: '2026-02-20T12:00:00.000Z',
            amount: 5_000,
            type: 'payment',
          }),
        ],
      },
      {
        range: { from: '2026-02-01', to: '2026-05-31' },
        cardDueMode: 'statement',
      },
      '2026-05-26T12:00:00.000Z',
    )
    const feb = rows.find(
      (r) => r.debtKind === 'creditCardStatement' && r.dueDate.startsWith('2026-02'),
    )
    expect(feb).toBeDefined()
    expect(feb!.paid).toBe(false)
    expect(Number(feb!.amount)).toBeCloseTo(12_000, 0)
    expect(Number(feb!.paidAmount)).toBeCloseTo(5_000, 0)
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

  it('kısmi ödemeleri ödenen tutara, kalanı bekleyene yansıtır', () => {
    const series = debtInstallmentMonthlySeries(
      [
        {
          key: 'card',
          debtKind: 'creditCardStatement',
          debtId: 'c1',
          debtName: 'Bonus',
          bankId: 'b1',
          bankName: 'Test Bankası',
          installmentIndex: 0,
          dueDate: '2026-06-25T00:00:00.000Z',
          amount: '10000',
          paid: false,
          paidAmount: '3000',
          status: 'overdue',
        },
      ],
      { from: '2026-06-01', to: '2026-06-30' },
    )
    expect(series.paid[0]).toBe(3000)
    expect(series.pending[0]).toBe(7000)
  })

  it('ödeme tutarı satır borcundan büyükse bekleyen satır tutarı kadar kalır', () => {
    const series = debtInstallmentMonthlySeries(
      [
        {
          key: 'card',
          debtKind: 'creditCardStatement',
          debtId: 'c1',
          debtName: 'Bonus',
          bankId: 'b1',
          bankName: 'Test Bankası',
          installmentIndex: 0,
          dueDate: '2026-03-25T00:00:00.000Z',
          amount: '338.03',
          paid: false,
          paidAmount: '12382.20',
          status: 'overdue',
        },
      ],
      { from: '2026-03-01', to: '2026-03-31' },
    )
    expect(series.paid[0]).toBeCloseTo(12_382.2, 0)
    expect(series.pending[0]).toBeCloseTo(338.03, 0)
  })
})
