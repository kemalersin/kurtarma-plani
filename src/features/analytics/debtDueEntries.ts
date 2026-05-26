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
import { buildScheduleForLoan, paidThroughIndex } from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import { buildCardPeriods } from '@/features/debts/cardHelpers'
import { cashAdvanceAccountMonthlyDebts } from '@/features/debts/cashAdvanceHelpers'

export interface DebtDueEntry {
  dueDate: string
  amount: number
}

export interface CollectDebtDueEntriesInput {
  loans: Loan[]
  loanPayments: LoanPayment[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  cashAdvanceAccounts?: CashAdvanceAccount[]
  cashAdvanceTransactions?: CashAdvanceTransaction[]
  installmentAdvances: InstallmentCashAdvance[]
  installmentAdvancePayments: InstallmentCashAdvancePayment[]
  localCurrency: string
  /** ISO bitiş (dahil); yoksa tüm vadeler */
  to?: string
  /** Preset KKDF+BSMV; hesapta tanımlı değilse kullanılır */
  cashAdvanceTaxRateMonthly?: number
}

/**
 * Borç karşılama / projeksiyon için vadesi gelen tutarlar:
 * kredi taksiti, taksitli avans, kredi kartı asgari ödemesi, nakit avans asgari.
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

  const todayIso = input.to ?? new Date().toISOString()
  const monthKeys: string[] = []
  if (toKey) {
    const endMonth = toKey.slice(0, 7)
    const startMonth = endMonth.slice(0, 4) + '-01'
    let [y, mo] = startMonth.split('-').map(Number)
    const [ey, emo] = endMonth.split('-').map(Number)
    while (y < ey || (y === ey && mo <= emo)) {
      monthKeys.push(`${y}-${String(mo).padStart(2, '0')}`)
      mo += 1
      if (mo > 12) {
        mo = 1
        y += 1
      }
    }
  }

  for (const acc of input.cashAdvanceAccounts ?? []) {
    if (acc.archived) continue
    if (acc.currency !== input.localCurrency) continue
    const txns = (input.cashAdvanceTransactions ?? []).filter((t) => t.accountId === acc.id)
    const rows = cashAdvanceAccountMonthlyDebts(
      acc,
      txns,
      monthKeys.length ? monthKeys : [todayIso.slice(0, 7)],
      todayIso,
      input.cashAdvanceTaxRateMonthly,
    )
    for (const row of rows) {
      if (toKey && row.dueDate.slice(0, 10) > toKey) continue
      if (row.minPayment <= 0) continue
      out.push({ dueDate: row.dueDate, amount: row.minPayment })
    }
  }

  return out
}
