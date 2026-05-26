import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import type { AiSnapshotSourceRow } from '@/features/ai/snapshot'
import { cardCommittedTotal, type CardProjectionRateContext } from '@/features/debts/cardHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  remainingDebtForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import {
  buildScheduleForLoan,
  paidThroughIndex,
  remainingDebtForLoan,
} from '@/features/debts/loanHelpers'
import { revolvingRatesFromAccount } from '@/features/debts/cashAdvanceHelpers'
import { D } from '@/finance/decimal'
import { runRevolvingLedger } from '@/finance/cash-advance'

export interface SettledDebtIndex {
  loanIds: ReadonlySet<string>
  installmentAdvanceIds: ReadonlySet<string>
  creditCardIds: ReadonlySet<string>
  cashAdvanceAccountIds: ReadonlySet<string>
}

export interface SettledDebtInput {
  loans: Loan[]
  loanPayments: LoanPayment[]
  installmentAdvances: InstallmentCashAdvance[]
  installmentAdvancePayments: InstallmentCashAdvancePayment[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  cashAdvanceAccounts: CashAdvanceAccount[]
  cashAdvanceTransactions: CashAdvanceTransaction[]
}

export interface SettledDebtOptions {
  asOf?: string
  creditCardRateContext?: CardProjectionRateContext
  cashAdvanceTaxRateMonthly?: number
}

function isZeroDebt(value: string | number): boolean {
  return D(value).lte(0)
}

function emptySettledDebtIndex(): SettledDebtIndex {
  return {
    loanIds: new Set(),
    installmentAdvanceIds: new Set(),
    creditCardIds: new Set(),
    cashAdvanceAccountIds: new Set(),
  }
}

/** Kalan borcu sıfır olan borç kayıtlarını tespit eder (AI bağlamından çıkarılır). */
export function computeSettledDebtIndex(
  input: SettledDebtInput,
  options: SettledDebtOptions = {},
): SettledDebtIndex {
  const asOf = options.asOf ?? new Date().toISOString()
  const asOfDate = new Date(asOf)
  const rateContext = options.creditCardRateContext ?? {}
  const index = emptySettledDebtIndex()

  for (const loan of input.loans) {
    const schedule = buildScheduleForLoan(loan)
    const ownPayments = input.loanPayments.filter((p) => p.loanId === loan.id)
    const paidIdx = paidThroughIndex(ownPayments)
    const remaining = remainingDebtForLoan(loan, schedule, paidIdx, asOf, ownPayments)
    if (isZeroDebt(remaining)) index.loanIds.add(loan.id)
  }

  for (const adv of input.installmentAdvances) {
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const ownPayments = input.installmentAdvancePayments.filter(
      (p) => p.installmentAdvanceId === adv.id,
    )
    const paidIdx = advancePaidThroughIndex(ownPayments)
    const remaining = remainingDebtForInstallmentAdvance(
      adv,
      schedule,
      paidIdx,
      asOf,
      ownPayments,
    )
    if (isZeroDebt(remaining)) index.installmentAdvanceIds.add(adv.id)
  }

  for (const card of input.creditCards) {
    const txns = input.creditCardTransactions.filter((t) => t.cardId === card.id)
    const committed = cardCommittedTotal(card, txns, asOfDate, rateContext)
    if (isZeroDebt(committed.committed)) index.creditCardIds.add(card.id)
  }

  for (const acc of input.cashAdvanceAccounts) {
    const txns = input.cashAdvanceTransactions.filter((t) => t.accountId === acc.id)
    const ledger = runRevolvingLedger({
      openingBalance: acc.openingBalance ?? 0,
      openingDate: acc.openingDate,
      transactions: txns.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      rates: revolvingRatesFromAccount(acc, options.cashAdvanceTaxRateMonthly),
      asOf,
    })
    if (isZeroDebt(ledger.total)) index.cashAdvanceAccountIds.add(acc.id)
  }

  return index
}

function groupSnapshotRows(rows: AiSnapshotSourceRow[]): SettledDebtInput {
  const input: SettledDebtInput = {
    loans: [],
    loanPayments: [],
    installmentAdvances: [],
    installmentAdvancePayments: [],
    creditCards: [],
    creditCardTransactions: [],
    cashAdvanceAccounts: [],
    cashAdvanceTransactions: [],
  }
  for (const row of rows) {
    if (row.type === 'loan') input.loans.push(row.data as Loan)
    if (row.type === 'loanPayment') input.loanPayments.push(row.data as LoanPayment)
    if (row.type === 'installmentCashAdvance') {
      input.installmentAdvances.push(row.data as InstallmentCashAdvance)
    }
    if (row.type === 'installmentCashAdvancePayment') {
      input.installmentAdvancePayments.push(row.data as InstallmentCashAdvancePayment)
    }
    if (row.type === 'creditCard') input.creditCards.push(row.data as CreditCard)
    if (row.type === 'creditCardTransaction') {
      input.creditCardTransactions.push(row.data as CreditCardTransaction)
    }
    if (row.type === 'cashAdvanceAccount') {
      input.cashAdvanceAccounts.push(row.data as CashAdvanceAccount)
    }
    if (row.type === 'cashAdvanceTransaction') {
      input.cashAdvanceTransactions.push(row.data as CashAdvanceTransaction)
    }
  }
  return input
}

export function computeSettledDebtIndexFromSnapshotRows(
  rows: AiSnapshotSourceRow[],
  options: SettledDebtOptions = {},
): SettledDebtIndex {
  return computeSettledDebtIndex(groupSnapshotRows(rows), options)
}

/** Kapatılmış (kalan borcu sıfır) borç ve ilişkili kayıtları AI bağlamından çıkarır. */
export function isSettledDebtSnapshotRow(
  row: Pick<AiSnapshotSourceRow, 'id' | 'type' | 'data'>,
  settled: SettledDebtIndex,
): boolean {
  switch (row.type) {
    case 'loan':
      return settled.loanIds.has(row.id)
    case 'loanPayment':
      return settled.loanIds.has((row.data as LoanPayment).loanId)
    case 'installmentCashAdvance':
      return settled.installmentAdvanceIds.has(row.id)
    case 'installmentCashAdvancePayment':
      return settled.installmentAdvanceIds.has(
        (row.data as InstallmentCashAdvancePayment).installmentAdvanceId,
      )
    case 'creditCard':
      return settled.creditCardIds.has(row.id)
    case 'creditCardTransaction':
      return settled.creditCardIds.has((row.data as CreditCardTransaction).cardId)
    case 'cashAdvanceAccount':
      return settled.cashAdvanceAccountIds.has(row.id)
    case 'cashAdvanceTransaction':
      return settled.cashAdvanceAccountIds.has(
        (row.data as CashAdvanceTransaction).accountId,
      )
    default:
      return false
  }
}

export function filterSettledDebtInput<T extends SettledDebtInput>(input: T, settled: SettledDebtIndex): T {
  return {
    ...input,
    loans: input.loans.filter((l) => !settled.loanIds.has(l.id)),
    loanPayments: input.loanPayments.filter((p) => !settled.loanIds.has(p.loanId)),
    installmentAdvances: input.installmentAdvances.filter(
      (a) => !settled.installmentAdvanceIds.has(a.id),
    ),
    installmentAdvancePayments: input.installmentAdvancePayments.filter(
      (p) => !settled.installmentAdvanceIds.has(p.installmentAdvanceId),
    ),
    creditCards: input.creditCards.filter((c) => !settled.creditCardIds.has(c.id)),
    creditCardTransactions: input.creditCardTransactions.filter(
      (t) => !settled.creditCardIds.has(t.cardId),
    ),
    cashAdvanceAccounts: input.cashAdvanceAccounts.filter(
      (a) => !settled.cashAdvanceAccountIds.has(a.id),
    ),
    cashAdvanceTransactions: input.cashAdvanceTransactions.filter(
      (t) => !settled.cashAdvanceAccountIds.has(t.accountId),
    ),
  }
}
