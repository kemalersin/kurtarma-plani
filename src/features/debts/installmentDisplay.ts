import { differenceInCalendarDays, parseISO } from 'date-fns'

/** Vade tarihi bugünden sonra mı (henüz ödenmemiş / ileride). */
export function isInstallmentUpcoming(dueDate: string, asOf = new Date()): boolean {
  return differenceInCalendarDays(parseISO(dueDate), asOf) > 0
}

/** Tabloda gösterilecek taksit tutarı (plan override veya ödeme). */
export function displayInstallmentAmount(
  planInstallment: string | number,
  payment?: { scheduledAmount?: number; paidDate?: string; paidAmount?: number },
): string | number {
  if (!payment) return planInstallment
  if (payment.paidDate) {
    return payment.paidAmount ?? payment.scheduledAmount ?? planInstallment
  }
  return payment.scheduledAmount ?? planInstallment
}

/** Sıradaki taksit ödenebilir mi (bir önceki ödenmiş olmalı). */
export function canMarkInstallmentAsPaid(
  installmentIndex: number,
  paidThroughIndex: number,
): boolean {
  return paidThroughIndex >= installmentIndex - 1
}

/** Ödenmemiş taksit override'ları (installmentIndex → scheduledAmount). */
export function unpaidInstallmentOverrides(
  payments: Array<{ installmentIndex: number; scheduledAmount: number; paidDate?: string }>,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const p of payments) {
    if (!p.paidDate) map.set(p.installmentIndex, p.scheduledAmount)
  }
  return map
}
