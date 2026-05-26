/**
 * Yeni profiller için anlamlı demo verisi.
 * Türkiye bağlamında tipik bir hane bütçesi senaryosu.
 */
import { addDays, addMonths, startOfMonth, subMonths } from 'date-fns'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import type { EntityType } from '@/core/db/profile-db'
import type {
  Account,
  Bank,
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CashRegister,
  CreditCard,
  CreditCardTransaction,
  Expense,
  ExpenseType,
  Income,
  IncomeType,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
  Transfer,
} from '@/core/types/entities'
import { newId } from '@/core/util/id'

const SAMPLE_IDS = {
  bankZiraat: 'sample-bank-ziraat',
  bankGaranti: 'sample-bank-garanti',
  accountMain: 'sample-account-main',
  accountSavings: 'sample-account-savings',
  cashHome: 'sample-cash-home',
  incomeSalary: 'sample-income-type-salary',
  incomeFreelance: 'sample-income-type-freelance',
  expenseRent: 'sample-expense-type-rent',
  expenseMarket: 'sample-expense-type-market',
  expenseBills: 'sample-expense-type-bills',
  expenseTransport: 'sample-expense-type-transport',
  loanNeed: 'sample-loan-need',
  cardBonus: 'sample-card-bonus',
  cashAdvance: 'sample-cash-advance',
  installmentAdvance: 'sample-installment-advance',
} as const

interface SampleRow {
  id: string
  type: EntityType
  data: unknown
  sensitive?: boolean
}

function atMonthStart(monthsAgo: number, ref = new Date()): string {
  return startOfMonth(subMonths(ref, monthsAgo)).toISOString()
}

function daysAgo(days: number, ref = new Date()): string {
  const d = new Date(ref)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function daysFromNow(days: number, ref = new Date()): string {
  return addDays(ref, days).toISOString()
}

function ts(ref = new Date()): string {
  return ref.toISOString()
}

/** Profil DB'sine yazılacak örnek kayıtları üretir. */
export function buildSampleProfileRows(currency = 'TRY', ref = new Date()): SampleRow[] {
  const now = ts(ref)
  const rows: SampleRow[] = []

  const push = (type: EntityType, id: string, data: { createdAt: string; updatedAt: string }) => {
    rows.push({ id, type, data })
  }

  const banks: Bank[] = [
    {
      id: SAMPLE_IDS.bankZiraat,
      name: 'Ziraat Bankası',
      shortName: 'Ziraat',
      notes: 'Maaş hesabı bankası',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SAMPLE_IDS.bankGaranti,
      name: 'Garanti BBVA',
      shortName: 'Garanti',
      notes: 'Kredi kartı ve birikim',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const bank of banks) push('bank', bank.id, bank)

  const accounts: Account[] = [
    {
      id: SAMPLE_IDS.accountMain,
      bankId: SAMPLE_IDS.bankZiraat,
      name: 'Ana Vadesiz',
      type: 'checking',
      currency,
      iban: 'TR000001000000000000000001',
      openingBalance: 18_500,
      openingDate: atMonthStart(12, ref),
      notes: 'Maaş ve günlük harcamalar',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SAMPLE_IDS.accountSavings,
      bankId: SAMPLE_IDS.bankGaranti,
      name: 'Birikim Hesabı',
      type: 'savings',
      currency,
      openingBalance: 42_000,
      openingDate: atMonthStart(12, ref),
      notes: 'Acil durum fonu',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const account of accounts) push('account', account.id, account)

  const registers: CashRegister[] = [
    {
      id: SAMPLE_IDS.cashHome,
      name: 'Ev Kasası',
      currency,
      openingBalance: 2_800,
      openingDate: atMonthStart(6, ref),
      notes: 'Market ve küçük harcamalar',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const register of registers) push('cashRegister', register.id, register)

  const incomeTypes: IncomeType[] = [
    {
      id: SAMPLE_IDS.incomeSalary,
      name: 'Maaş',
      color: '#1677ff',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SAMPLE_IDS.incomeFreelance,
      name: 'Serbest Gelir',
      color: '#52c41a',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const item of incomeTypes) push('incomeType', item.id, item)

  const expenseTypes: ExpenseType[] = [
    { id: SAMPLE_IDS.expenseRent, name: 'Kira', color: '#722ed1', createdAt: now, updatedAt: now },
    { id: SAMPLE_IDS.expenseMarket, name: 'Market', color: '#fa8c16', createdAt: now, updatedAt: now },
    { id: SAMPLE_IDS.expenseBills, name: 'Faturalar', color: '#13c2c2', createdAt: now, updatedAt: now },
    {
      id: SAMPLE_IDS.expenseTransport,
      name: 'Ulaşım',
      color: '#eb2f96',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const item of expenseTypes) push('expenseType', item.id, item)

  const loanStart = atMonthStart(6, ref)
  const loanFirstInstallment = addMonths(new Date(loanStart), 1).toISOString()
  const loanInstallmentDue = (index: number) =>
    addMonths(new Date(loanFirstInstallment), index - 1).toISOString()
  /** Faiz oranları DB'de ondalık kesir (4,25 % → 0.0425). */
  const loan: Loan = {
    id: SAMPLE_IDS.loanNeed,
    name: 'Ziraat İhtiyaç Kredisi',
    bankId: SAMPLE_IDS.bankZiraat,
    disbursementAccountId: SAMPLE_IDS.accountMain,
    currency,
    principal: 180_000,
    termMonths: 36,
    startDate: loanStart,
    firstInstallmentDate: loanFirstInstallment,
    interestRate: 0.0289,
    interestPeriod: 'monthly',
    lateInterestRate: 0.03757,
    lateInterestPeriod: 'monthly',
    taxRateMonthly: 0.3,
    notes: 'Örnek tüketici kredisi',
    createdAt: now,
    updatedAt: now,
  }
  push('loan', loan.id, loan)

  const loanPayments: LoanPayment[] = [1, 2, 3, 4].map((installmentIndex) => ({
    id: newId(),
    loanId: SAMPLE_IDS.loanNeed,
    installmentIndex,
    dueDate: loanInstallmentDue(installmentIndex),
    scheduledAmount: 7_842.5,
    paidDate: loanInstallmentDue(installmentIndex),
    paidAmount: 7_842.5,
    sourceAccountId: SAMPLE_IDS.accountMain,
    createdAt: now,
    updatedAt: now,
  }))
  // 5. ve 6. taksit vadesi geçmiş — ödenmemiş (gecikme örneği)
  for (const payment of loanPayments) push('loanPayment', payment.id, payment)

  const card: CreditCard = {
    id: SAMPLE_IDS.cardBonus,
    name: 'Garanti Bonus',
    bankId: SAMPLE_IDS.bankGaranti,
    currency,
    limit: 75_000,
    openingBalance: 6_200,
    statementCutoffDay: 15,
    paymentDueDay: 5,
    purchaseAprMonthly: 0.0375,
    lateAprMonthly: 0.0405,
    cashAdvanceAprMonthly: 0.0425,
    taxRateMonthly: 0.25,
    rateMode: 'balanceTier',
    notes: 'Günlük harcamalar',
    createdAt: now,
    updatedAt: now,
  }
  push('creditCard', card.id, card)

  const cardTxns: CreditCardTransaction[] = [
    {
      id: newId(),
      cardId: SAMPLE_IDS.cardBonus,
      date: daysAgo(18, ref),
      type: 'purchase',
      amount: 1_240,
      description: 'Market alışverişi',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      cardId: SAMPLE_IDS.cardBonus,
      date: daysAgo(9, ref),
      type: 'purchase',
      amount: 890,
      description: 'Online alışveriş',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      cardId: SAMPLE_IDS.cardBonus,
      date: daysAgo(4, ref),
      type: 'payment',
      amount: 3_500,
      description: 'Ekstre ödemesi',
      sourceAccountId: SAMPLE_IDS.accountMain,
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const txn of cardTxns) push('creditCardTransaction', txn.id, txn)

  const cashAdv: CashAdvanceAccount = {
    id: SAMPLE_IDS.cashAdvance,
    name: 'Garanti Nakit Avans',
    bankId: SAMPLE_IDS.bankGaranti,
    currency,
    limit: 30_000,
    openingBalance: 8_500,
    openingDate: atMonthStart(4, ref),
    interestRate: 0.0425,
    interestPeriod: 'monthly',
    lateInterestRate: 0.0455,
    lateInterestPeriod: 'monthly',
    notes: 'Dönen kredi limiti',
    createdAt: now,
    updatedAt: now,
  }
  push('cashAdvanceAccount', cashAdv.id, cashAdv)

  const cashAdvTxns: CashAdvanceTransaction[] = [
    {
      id: newId(),
      accountId: SAMPLE_IDS.cashAdvance,
      date: daysAgo(45, ref),
      type: 'draw',
      amount: 5_000,
      description: 'Nakit çekim',
      targetAccountId: SAMPLE_IDS.accountMain,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      accountId: SAMPLE_IDS.cashAdvance,
      date: daysAgo(12, ref),
      type: 'payment',
      amount: 2_000,
      description: 'Kısmi ödeme',
      sourceAccountId: SAMPLE_IDS.accountMain,
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const txn of cashAdvTxns) push('cashAdvanceTransaction', txn.id, txn)

  const instStart = atMonthStart(5, ref)
  const instFirst = addMonths(new Date(instStart), 1).toISOString()
  const installmentAdvance: InstallmentCashAdvance = {
    id: SAMPLE_IDS.installmentAdvance,
    name: 'Taksitli Nakit Avans',
    bankId: SAMPLE_IDS.bankGaranti,
    cashAdvanceAccountId: SAMPLE_IDS.cashAdvance,
    currency,
    principal: 24_000,
    termMonths: 12,
    startDate: instStart,
    firstInstallmentDate: instFirst,
    interestRate: 0.0365,
    interestPeriod: 'monthly',
    lateInterestRate: 0.04745,
    lateInterestPeriod: 'monthly',
    taxRateMonthly: 0.3,
    earlyPayoffWithoutInterest: false,
    notes: '12 ay taksitli avans',
    createdAt: now,
    updatedAt: now,
  }
  push('installmentCashAdvance', installmentAdvance.id, installmentAdvance)

  const instInstallmentDue = (index: number) =>
    addMonths(new Date(instFirst), index - 1).toISOString()
  const instScheduledAmount = 2_280
  const installmentAdvancePayments: InstallmentCashAdvancePayment[] = [1, 2].map(
    (installmentIndex) => ({
      id: newId(),
      installmentAdvanceId: SAMPLE_IDS.installmentAdvance,
      installmentIndex,
      dueDate: instInstallmentDue(installmentIndex),
      scheduledAmount: instScheduledAmount,
      paidDate: instInstallmentDue(installmentIndex),
      paidAmount: instScheduledAmount,
      sourceAccountId: SAMPLE_IDS.accountMain,
      createdAt: now,
      updatedAt: now,
    }),
  )
  // 3. taksit gecikmiş, 4. yaklaşan — ödenmemiş
  for (const payment of installmentAdvancePayments) {
    push('installmentCashAdvancePayment', payment.id, payment)
  }

  const incomes: Income[] = [
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeSalary,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 48_500,
      plannedDate: atMonthStart(3, ref),
      actualDate: atMonthStart(3, ref),
      description: 'Aylık maaş',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeSalary,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 48_500,
      plannedDate: atMonthStart(2, ref),
      actualDate: atMonthStart(2, ref),
      description: 'Aylık maaş',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeSalary,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 48_500,
      plannedDate: atMonthStart(1, ref),
      actualDate: atMonthStart(1, ref),
      description: 'Aylık maaş',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeSalary,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 48_500,
      plannedDate: daysFromNow(5, ref),
      description: 'Planlanan maaş (henüz tahsil edilmedi)',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeFreelance,
      cashRegisterId: SAMPLE_IDS.cashHome,
      currency,
      amount: 6_500,
      plannedDate: daysAgo(35, ref),
      actualDate: daysAgo(35, ref),
      description: 'Danışmanlık geliri (tahsil edildi)',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      incomeTypeId: SAMPLE_IDS.incomeFreelance,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 4_200,
      plannedDate: daysAgo(11, ref),
      description: 'Proje faturası (vadesi geçti, tahsil bekleniyor)',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const income of incomes) push('income', income.id, income)

  const expenses: Expense[] = [
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseRent,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 18_000,
      plannedDate: atMonthStart(2, ref),
      actualDate: atMonthStart(2, ref),
      description: 'Konut kirası',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseRent,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 18_000,
      plannedDate: atMonthStart(1, ref),
      actualDate: atMonthStart(1, ref),
      description: 'Konut kirası',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseRent,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 18_000,
      plannedDate: daysAgo(8, ref),
      description: 'Bu ay kira (vadesi geçti, ödenmedi)',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseBills,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 1_850,
      plannedDate: daysAgo(18, ref),
      actualDate: daysAgo(18, ref),
      description: 'Elektrik faturası',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseBills,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 420,
      plannedDate: daysFromNow(4, ref),
      description: 'Su faturası (yaklaşan vade)',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseMarket,
      cashRegisterId: SAMPLE_IDS.cashHome,
      currency,
      amount: 680,
      plannedDate: daysAgo(3, ref),
      actualDate: daysAgo(3, ref),
      description: 'Haftalık market',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      expenseTypeId: SAMPLE_IDS.expenseTransport,
      accountId: SAMPLE_IDS.accountMain,
      currency,
      amount: 1_200,
      plannedDate: daysFromNow(18, ref),
      description: 'Aylık ulaşım kartı (planlı)',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const expense of expenses) push('expense', expense.id, expense)

  const transfers: Transfer[] = [
    {
      id: newId(),
      fromAccountId: SAMPLE_IDS.accountMain,
      toAccountId: SAMPLE_IDS.accountSavings,
      currency,
      amount: 5_000,
      date: atMonthStart(1, ref),
      description: 'Aylık birikim',
      createdAt: now,
      updatedAt: now,
    },
  ]
  for (const transfer of transfers) push('transfer', transfer.id, transfer)

  return rows
}

/** Örnek veriyi profil veritabanına yazar. */
export async function seedSampleProfileData(
  profileId: string,
  key: CryptoKey | null,
  currency = 'TRY',
): Promise<number> {
  const repo = new EncryptedRepo(profileId, key)
  const rows = buildSampleProfileRows(currency)
  const now = new Date().toISOString()
  await Promise.all(
    rows.map((row) =>
      repo.put({
        id: row.id,
        type: row.type,
        updatedAt: now,
        data: row.data,
        sensitive: row.sensitive,
      }),
    ),
  )
  return rows.length
}

export { SAMPLE_IDS }
