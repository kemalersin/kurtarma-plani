import type { RecurrenceInterval } from '@/core/types/recurrence'
import { RECURRENCE_LABELS } from '@/core/types/recurrence'
import type { KpColumnTag } from '@/core/util/table-columns'
import { cashflowStatus, type CashflowStatus } from '@/finance/cashflow'

export const CASHFLOW_STATUS_LABELS: Record<CashflowStatus, string> = {
  realized: 'Gerçekleşti',
  overdue: 'Vadesi geçti',
  due: 'Yaklaşan',
  upcoming: 'Planlı',
}

const CASHFLOW_STATUS_TAG_COLORS: Record<CashflowStatus, string> = {
  realized: 'success',
  overdue: 'error',
  due: 'warning',
  upcoming: 'processing',
}

export type CashflowListItem = {
  plannedDate: string
  actualDate?: string
  recurrence?: RecurrenceInterval
}

export function cashflowStatusLabel(item: CashflowListItem): string {
  if (item.recurrence) {
    return `Yinelenen · ${RECURRENCE_LABELS[item.recurrence]}`
  }
  return CASHFLOW_STATUS_LABELS[cashflowStatus(item)]
}

/** Gelir / gider listesi Durum sütunu etiketi. */
export function cashflowStatusTag(item: CashflowListItem): KpColumnTag {
  if (item.recurrence) {
    return {
      color: 'purple',
      label: cashflowStatusLabel(item),
    }
  }
  const status = cashflowStatus(item)
  return {
    color: CASHFLOW_STATUS_TAG_COLORS[status],
    label: CASHFLOW_STATUS_LABELS[status],
  }
}
