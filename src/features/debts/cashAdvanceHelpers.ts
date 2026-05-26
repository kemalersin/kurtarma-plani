import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'
import {
  monthEndIsoFromKey,
  runRevolvingLedger,
  simulateRevolvingLedger,
  type RevolvingRateConfig,
  type RevolvingState,
} from '@/finance/cash-advance'

/** Hesap + opsiyonel preset vergi yükünden revolving faiz bağlamı. */
export function revolvingRatesFromAccount(
  account: CashAdvanceAccount,
  taxRateMonthly?: number,
): RevolvingRateConfig {
  return {
    apr: { value: account.interestRate, period: account.interestPeriod },
    lateApr:
      account.lateInterestRate != null && account.lateInterestPeriod
        ? { value: account.lateInterestRate, period: account.lateInterestPeriod }
        : undefined,
    taxRateMonthly: account.taxRateMonthly ?? taxRateMonthly,
    limit: account.limit,
  }
}

function mapTransactions(
  accountId: string,
  transactions: CashAdvanceTransaction[],
) {
  return transactions
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({
      date: t.date,
      amount: t.amount,
      type: t.type,
    }))
}

/** Bir nakit avans hesabının bugünkü durumunu hesaplar. */
export function cashAdvanceState(
  account: CashAdvanceAccount,
  transactions: CashAdvanceTransaction[],
  asOf?: string,
  taxRateMonthly?: number,
): RevolvingState {
  return runRevolvingLedger({
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
    transactions: mapTransactions(account.id, transactions),
    rates: revolvingRatesFromAccount(account, taxRateMonthly),
    asOf,
  })
}

/** `YYYY-MM` ayının son günü (UTC öğlen). @deprecated `monthEndIsoFromKey` kullanın */
export function monthEndIso(monthKey: string): string {
  return monthEndIsoFromKey(monthKey)
}

export interface CashAdvanceMonthlyDebt {
  dueDate: string
  endingBalance: number
  minPayment: number
  paidAmount?: number
  /** Asgari ödeme karşılandı mı */
  paidMin: boolean
  /** Ay sonu bakiyesi sıfırlandı mı */
  paidInFull: boolean
}

/**
 * Revolving nakit avans hesabının ay sonu vadeleri (asgari + toplam bakiye).
 * Bakiye sıfır olan aylar listede yer almaz.
 * `todayIso` ayından sonraki aylar **dahil edilmez** (tahmini taşıma yok).
 */
export function cashAdvanceAccountMonthlyDebts(
  account: CashAdvanceAccount,
  transactions: CashAdvanceTransaction[],
  months: string[],
  todayIso: string,
  taxRateMonthly?: number,
): CashAdvanceMonthlyDebt[] {
  const own = transactions.filter((t) => t.accountId === account.id)
  const openingMonth = account.openingDate.slice(0, 7)
  const todayMonth = todayIso.slice(0, 7)
  const { periods } = simulateRevolvingLedger({
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
    transactions: mapTransactions(account.id, own),
    rates: revolvingRatesFromAccount(account, taxRateMonthly),
    asOf: todayIso,
  })
  const byMonth = new Map(periods.map((p) => [p.monthKey, p]))
  const out: CashAdvanceMonthlyDebt[] = []

  for (const monthKey of months) {
    if (monthKey < openingMonth) continue
    if (monthKey > todayMonth) continue
    const row = byMonth.get(monthKey)
    if (!row) continue
    const hadPayment = row.paymentsInMonth > 0
    if (row.endingBalance <= 0 && !hadPayment) continue
    out.push({
      dueDate: row.dueDate,
      endingBalance: row.endingBalance,
      minPayment: row.minPayment,
      paidAmount: row.paymentsInMonth > 0 ? row.paymentsInMonth : undefined,
      paidMin: row.paid,
      paidInFull: row.paidInFull,
    })
  }

  return out
}

/** Belirli tarihte yapılabilecek maksimum kullanım (limit − anapara). */
export function cashAdvanceDrawCapacity(
  account: CashAdvanceAccount,
  transactions: CashAdvanceTransaction[],
  drawDateIso: string,
  options?: {
    taxRateMonthly?: number
    /** Düzenlemede mevcut hareket hariç tutulur (eski tutar kapasiteye geri eklenir). */
    excludeTransactionId?: string
  },
): number {
  const relevant = transactions.filter(
    (t) =>
      t.accountId === account.id &&
      t.id !== options?.excludeTransactionId &&
      t.date <= drawDateIso,
  )
  const state = cashAdvanceState(
    account,
    relevant,
    drawDateIso,
    options?.taxRateMonthly,
  )
  const available = account.limit - Number(state.principal)
  return available > 0 ? available : 0
}
