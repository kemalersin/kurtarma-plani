import type {
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import type { InstallmentLateFeeRates } from './installmentDisplay'
import { unpaidInstallmentOverrides } from './installmentDisplay'
import { buildAnnuitySchedule, payoffAmount, outstandingLateFeesTotal, remainingDebtTotal, remainingPrincipalBalance, type LoanSchedule } from '@/finance/loan'
import { D, roundMoney } from '@/finance/decimal'

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

function advanceRateInput(advance: InstallmentCashAdvance) {
  return {
    contractRate: { value: advance.interestRate, period: advance.interestPeriod },
    lateRate:
      advance.lateInterestRate !== undefined && advance.lateInterestPeriod
        ? { value: advance.lateInterestRate, period: advance.lateInterestPeriod }
        : undefined,
  }
}

/** Gecikme faizi hesabı için sözleşme oranları. */
export function installmentAdvanceLateFeeRates(
  advance: InstallmentCashAdvance,
): InstallmentLateFeeRates {
  return advanceRateInput(advance)
}

/** Kalan borç = ödenmemiş taksitler + biriken gecikme faizi. */
export function remainingDebtForInstallmentAdvance(
  advance: InstallmentCashAdvance,
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate = new Date().toISOString(),
  payments: InstallmentCashAdvancePayment[] = [],
): string {
  return remainingDebtTotal({
    schedule,
    paidThroughIndex,
    asOfDate,
    installmentOverrides: unpaidInstallmentOverrides(payments),
    ...advanceRateInput(advance),
  })
}

/** Erken kapama tahmini; faizsiz kapama bayrağında yalnızca anapara + gecikme faizi. */
export function payoffForInstallmentAdvance(
  advance: InstallmentCashAdvance,
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate = new Date().toISOString(),
  payments: InstallmentCashAdvancePayment[] = [],
): string {
  const rates = advanceRateInput(advance)
  const installmentOverrides = unpaidInstallmentOverrides(payments)
  if (advance.earlyPayoffWithoutInterest) {
    const principal = remainingPrincipalBalance(schedule, paidThroughIndex)
    const lateFees = outstandingLateFeesTotal({
      schedule,
      paidThroughIndex,
      asOfDate,
      installmentOverrides,
      ...rates,
    })
    return roundMoney(D(principal).plus(lateFees)).toString()
  }
  return payoffAmount({
    schedule,
    paidThroughIndex,
    asOfDate,
    installmentOverrides,
    ...rates,
  })
}

export { remainingPrincipalBalance }
