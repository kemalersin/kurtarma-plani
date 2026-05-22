import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import { buildAnnuitySchedule, type LoanSchedule } from '@/finance/loan'

/**
 * Taksitli nakit avans = sabit faiz + sabit taksitli anüite plan (kredi gibi).
 * `LoanSchedule` üretici aynısı kullanılır.
 */
export function buildScheduleForInstallmentAdvance(
  advance: InstallmentCashAdvance,
): LoanSchedule {
  return buildAnnuitySchedule({
    principal: advance.principal,
    termMonths: advance.termMonths,
    interestRate: { value: advance.interestRate, period: advance.interestPeriod },
    lateInterestRate:
      advance.lateInterestRate !== undefined && advance.lateInterestPeriod
        ? { value: advance.lateInterestRate, period: advance.lateInterestPeriod }
        : undefined,
    firstInstallmentDate: advance.firstInstallmentDate,
    taxRateMonthly: advance.taxRateMonthly,
  })
}

export function indexAdvancePayments(
  payments: InstallmentCashAdvancePayment[],
): Map<number, InstallmentCashAdvancePayment> {
  const map = new Map<number, InstallmentCashAdvancePayment>()
  for (const p of payments) map.set(p.installmentIndex, p)
  return map
}

/**
 * Bkz. `loanHelpers.paidThroughIndex` — aynı sıra-bağımsız mantık.
 * Önceki sürüm payments array'inin gelme sırasına bağlıydı; düzeltildi.
 */
export function advancePaidThroughIndex(
  payments: InstallmentCashAdvancePayment[],
): number {
  const paid = new Set<number>()
  for (const p of payments) {
    if (p.paidDate) paid.add(p.installmentIndex)
  }
  let last = 0
  while (paid.has(last + 1)) last++
  return last
}
