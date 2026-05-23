import { D, roundMoney, type DecimalInput } from '@/finance/decimal'

import type { RecurrenceInterval } from '@/core/types/recurrence'
import { isRecurringCashflow, iterateCashflowOccurrences, sumCashflowOccurrences } from '@/finance/recurrence'

/**
 * Bir gelir veya gider hareketinin **vade durumu**:
 *   - `realized`  → fiili tarihi var (gerçekleşti)
 *   - `overdue`   → planlı; vade bugün dahil geçmişte; gerçekleşme yok
 *   - `due`       → planlı; vade önümüzdeki 7 gün içinde
 *   - `upcoming`  → planlı; vade 7 günden uzakta
 */
export type CashflowStatus = 'realized' | 'overdue' | 'due' | 'upcoming'

export interface CashflowItemLike {
  plannedDate: string
  actualDate?: string
  recurrence?: RecurrenceInterval
  archived?: boolean
}

export function cashflowStatus(
  item: CashflowItemLike,
  asOf: Date = new Date(),
): CashflowStatus {
  if (item.recurrence) return 'realized'
  if (item.actualDate) return 'realized'
  const due = new Date(item.plannedDate)
  const ms = due.getTime() - asOf.getTime()
  const days = Math.ceil(ms / 86_400_000)
  if (days < 0) return 'overdue'
  if (days <= 7) return 'due'
  return 'upcoming'
}

/** Bir tarihin (ISO veya Date) [from, to] aralığında olup olmadığı (her ikisi dahil). */
export function inRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

export interface SumOptions {
  /** ISO başlangıç (dahil) */
  from?: string
  /** ISO bitiş (dahil) */
  to?: string
  /**
   * Hangi tarih kullanılsın?
   *   - `plan`   → her zaman `plannedDate`
   *   - `actual` → varsa `actualDate`, yoksa atla
   *   - `effective` → varsa `actualDate`, yoksa `plannedDate`
   */
  basis?: 'plan' | 'actual' | 'effective'
}

/** Bir item kümesinin verili aralıkta toplam tutarı. */
export function sumByDateRange(
  items: {
    plannedDate: string
    actualDate?: string
    amount: DecimalInput
    archived?: boolean
    recurrence?: RecurrenceInterval
  }[],
  options: SumOptions = {},
): string {
  return sumCashflowOccurrences(items, {
    from: options.from,
    to: options.to,
    basis: options.basis ?? 'plan',
  })
}

export { isRecurringCashflow, iterateCashflowOccurrences, sumCashflowOccurrences }

export interface DebtCoverageInput {
  /** Bugünkü nakit (hesap + kasa toplamı) */
  cashOnHand: DecimalInput
  /** Aralıktaki beklenen gelirler (plan veya effective) */
  expectedIncome: DecimalInput
  /** Aralıktaki bilinen giderler (plan + gerçekleşen) */
  expectedExpense: DecimalInput
  /** Aralıktaki vadesi gelen borç ödemeleri (kredi taksitleri vb.) */
  debtDue: DecimalInput
}

export interface DebtCoverage {
  /** Net karşılama: nakit + gelir − gider − borç */
  netSurplus: string
  /** Vadesi gelen borç toplamı (karşılama hesabına giren) */
  debtDue: string
  /** Borç / (nakit + gelir − gider) oranı; >1 ise yetersiz */
  coverageRatio: number
  /** `netSurplus >= 0` */
  canCover: boolean
  /** Borç tutarının ne kadarının karşılanabildiği (ör. 0.85 = %85) */
  coveragePercent: number
}

/**
 * Belirli bir aralıkta nakit + beklenen gelir − bilinen gider ile, bu aralıkta
 * vadesi gelen borçların ne kadarının karşılanabildiğini hesaplar.
 */
export function computeDebtCoverage(input: DebtCoverageInput): DebtCoverage {
  const cash = D(input.cashOnHand)
  const inc = D(input.expectedIncome)
  const exp = D(input.expectedExpense)
  const debt = D(input.debtDue)
  const available = cash.plus(inc).minus(exp)
  const net = available.minus(debt)
  const canCover = net.gte(0)
  const ratio = debt.lte(0) ? 0 : debt.div(available.eq(0) ? 1 : available).toNumber()
  const coverage = debt.lte(0)
    ? canCover
      ? 1
      : 0
    : available.lte(0)
      ? 0
      : Math.min(1, available.div(debt).toNumber())
  return {
    netSurplus: roundMoney(net).toString(),
    debtDue: roundMoney(debt).toString(),
    coverageRatio: Number.isFinite(ratio) ? ratio : 0,
    canCover,
    coveragePercent: coverage,
  }
}
