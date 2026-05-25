import type { RecurrenceInterval } from '@/core/types/recurrence'
import { RECURRENCE_LABELS } from '@/core/types/recurrence'
import { cashflowStatus, type CashflowStatus } from '@/finance/cashflow'

export const CASHFLOW_STATUS_LABELS: Record<CashflowStatus, string> = {
  realized: 'Gerçekleşti',
  overdue: 'Vadesi geçti',
  due: 'Yaklaşan',
  upcoming: 'Planlı',
}

export function cashflowStatusLabel(item: {
  plannedDate: string
  actualDate?: string
  recurrence?: RecurrenceInterval
}): string {
  if (item.recurrence) {
    return `Yinelenen · ${RECURRENCE_LABELS[item.recurrence]}`
  }
  return CASHFLOW_STATUS_LABELS[cashflowStatus(item)]
}
