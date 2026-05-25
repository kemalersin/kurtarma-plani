import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'
import {
  runRevolvingLedger,
  type RevolvingState,
} from '@/finance/cash-advance'

/** Bir nakit avans hesabının bugünkü durumunu hesaplar. */
export function cashAdvanceState(
  account: CashAdvanceAccount,
  transactions: CashAdvanceTransaction[],
  asOf?: string,
): RevolvingState {
  const own = transactions
    .filter((t) => t.accountId === account.id)
    .sort((a, b) => a.date.localeCompare(b.date))
  return runRevolvingLedger({
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
    transactions: own.map((t) => ({
      date: t.date,
      amount: t.amount,
      type: t.type,
    })),
    apr: { value: account.interestRate, period: account.interestPeriod },
    asOf,
  })
}
