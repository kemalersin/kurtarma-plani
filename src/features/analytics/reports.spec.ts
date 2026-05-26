import { describe, expect, it } from 'vitest'
import {
  cashflowMonthRows,
  debtInstallmentMonthlySeries,
  debtInstallmentPaidDisplay,
  debtInstallmentRows,
  debtInstallmentStatusDisplay,
  debtInstallmentTypeLabel,
  filterCashflowRecords,
  movementRows,
} from './reports'
import type { AccountMovement } from '@/features/cashflow/movements'
import type {
  Account,
  CreditCard,
  CreditCardTransaction,
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
  creditCards: [] as CreditCard[],
  creditCardTransactions: [] as CreditCardTransaction[],
  banks: [{ id: 'b1', name: 'Test Bankası' }],
  localCurrency: 'TRY',
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

  it('varsayılan modda kart asgari ödeme vadelerini listeler; ödeme kaydı varsa ödendi sayar', () => {
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
    const minRows = rows.filter((r) => r.debtKind === 'creditCardMinPayment')
    expect(minRows.length).toBeGreaterThan(0)
    expect(minRows.some((r) => r.paid)).toBe(true)
    expect(minRows.some((r) => r.paid && Number(r.paidAmount) === 500)).toBe(true)
    expect(rows.every((r) => r.debtKind !== 'creditCardStatement')).toBe(true)
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
