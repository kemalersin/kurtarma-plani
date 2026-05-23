import type {
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import { buildScheduleForLoan, paidThroughIndex } from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import { buildCardPeriods } from '@/features/debts/cardHelpers'

export interface DebtDueEntry {
  dueDate: string
  amount: number
}

export interface CollectDebtDueEntriesInput {
  loans: Loan[]
  loanPayments: LoanPayment[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  installmentAdvances: InstallmentCashAdvance[]
  installmentAdvancePayments: InstallmentCashAdvancePayment[]
  localCurrency: string
  /** ISO bitiş (dahil); yoksa tüm vadeler */
  to?: string
}

/**
 * Borç karşılama / projeksiyon için vadesi gelen tutarlar:
 * kredi taksiti, taksitli avans, kredi kartı asgari ödemesi.
 */
export function collectDebtDueEntries(input: CollectDebtDueEntriesInput): DebtDueEntry[] {
  const out: DebtDueEntry[] = []
  const toKey = input.to?.slice(0, 10)

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    const schedule = buildScheduleForLoan(loan)
    const own = input.loanPayments.filter((p) => p.loanId === loan.id)
    const idx = paidThroughIndex(own)
    for (const row of schedule.rows) {
      if (row.index <= idx) continue
      if (toKey && row.dueDate.slice(0, 10) > toKey) continue
      out.push({ dueDate: row.dueDate, amount: Number(row.installment) })
    }
  }

  for (const adv of input.installmentAdvances) {
    if (adv.archived) continue
    if (adv.currency !== input.localCurrency) continue
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const own = input.installmentAdvancePayments.filter(
      (p) => p.installmentAdvanceId === adv.id,
    )
    const idx = advancePaidThroughIndex(own)
    for (const row of schedule.rows) {
      if (row.index <= idx) continue
      if (toKey && row.dueDate.slice(0, 10) > toKey) continue
      out.push({ dueDate: row.dueDate, amount: Number(row.installment) })
    }
  }

  for (const card of input.creditCards) {
    if (card.archived) continue
    if (card.currency !== input.localCurrency) continue
    const txns = input.creditCardTransactions.filter((t) => t.cardId === card.id)
    const periods = buildCardPeriods(card, txns, { periods: 18 })
    for (const period of periods) {
      if (toKey && period.dueDate.slice(0, 10) > toKey) continue
      const minPayment = Number(period.statement.minPayment)
      const endingBalance = Number(period.statement.endingBalance)
      if (minPayment <= 0 || endingBalance <= 0) continue
      out.push({ dueDate: period.dueDate, amount: minPayment })
    }
  }

  return out
}
