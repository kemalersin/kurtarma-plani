import type { KpColumnTag } from '@/core/util/table-columns'

export type InstallmentDebtStatusKey = 'overdue' | 'closed' | 'active'

/** Kredi / taksitli avans liste satırı özet alanları (durum hesabı için). */
export interface InstallmentDebtSummary {
  paidCount: number
  totalCount: number
  overdue: number
}

export function installmentDebtStatusKey(
  summary: InstallmentDebtSummary,
): InstallmentDebtStatusKey {
  if (summary.overdue > 0) return 'overdue'
  if (summary.totalCount > 0 && summary.paidCount >= summary.totalCount) return 'closed'
  return 'active'
}

export function installmentDebtStatusLabel(summary: InstallmentDebtSummary): string {
  if (summary.overdue > 0) return `${summary.overdue} gecikmiş`
  if (summary.totalCount > 0 && summary.paidCount >= summary.totalCount) return 'Kapandı'
  return 'Devam ediyor'
}

const STATUS_TAG_COLORS: Record<InstallmentDebtStatusKey, string> = {
  overdue: 'error',
  closed: 'success',
  active: 'processing',
}

export function installmentDebtStatusTag(summary: InstallmentDebtSummary): KpColumnTag {
  const key = installmentDebtStatusKey(summary)
  return {
    color: STATUS_TAG_COLORS[key],
    label: installmentDebtStatusLabel(summary),
  }
}
