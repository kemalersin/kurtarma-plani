import { cashflowStatusLabel } from '@/features/cashflow/cashflowLabels'
import type { RecurrenceInterval } from '@/core/types/recurrence'
import { compareByDisplayLabel } from '@/core/util/list-sorters'

export { compareByDisplayLabel }

export interface CashflowSortItem {
  plannedDate: string
  actualDate?: string
  recurrence?: RecurrenceInterval
}

export function compareCashflowActualDate(a: CashflowSortItem, b: CashflowSortItem): number {  const ad = a.actualDate ?? ''
  const bd = b.actualDate ?? ''
  if (!ad && !bd) return 0
  if (!ad) return 1
  if (!bd) return -1
  return ad.localeCompare(bd)
}

/** Durum — Türkçe etiket (Krediler listesi ile aynı mantık). */
export function compareCashflowStatus(a: CashflowSortItem, b: CashflowSortItem): number {
  return compareByDisplayLabel(a, b, cashflowStatusLabel)
}
