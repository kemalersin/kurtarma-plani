import type { Loan, LoanPayment } from '@/core/types/entities'
import {
  unpaidInstallmentOverrides,
  computePaidThroughIndex,
  type InstallmentLateFeeRates,
} from './installmentDisplay'
import { buildAnnuitySchedule, payoffAmount, remainingDebtTotal, remainingPrincipalBalance, type LoanSchedule } from '@/finance/loan'

export function buildScheduleForLoan(loan: Loan): LoanSchedule {
  return buildAnnuitySchedule({
    principal: loan.principal,
    termMonths: loan.termMonths,
    interestRate: { value: loan.interestRate, period: loan.interestPeriod },
    lateInterestRate:
      loan.lateInterestRate !== undefined && loan.lateInterestPeriod
        ? { value: loan.lateInterestRate, period: loan.lateInterestPeriod }
        : undefined,
    startDate: loan.startDate,
    firstInstallmentDate: loan.firstInstallmentDate,
    taxRateMonthly: loan.taxRateMonthly,
  })
}

/** Krediler listesinde «Aylık taksit» — plandaki tutar (gecikme faizi ve rollup yok). */
export function listInstallmentAmountForLoan(
  schedule: LoanSchedule,
  payments: LoanPayment[],
  paidThroughIdx: number,
): string {
  const paymentMap = indexPayments(payments)
  const nextIndex = paidThroughIdx + 1
  if (nextIndex > schedule.rows.length) {
    return schedule.rows[0]?.installment ?? schedule.installment
  }
  const row = schedule.rows.find((r) => r.index === nextIndex)
  if (!row) return schedule.installment
  const payment = paymentMap.get(row.index)
  if (payment?.scheduledAmount != null && !payment.paidDate) {
    return String(payment.scheduledAmount)
  }
  return row.installment
}

/** Bir kredinin ödemelerini installmentIndex ile dizin haline getir. */
export function indexPayments(payments: LoanPayment[]): Map<number, LoanPayment> {
  const map = new Map<number, LoanPayment>()
  for (const p of payments) map.set(p.installmentIndex, p)
  return map
}

/**
 * Boşluksuz ödenmiş ardışık en yüksek taksit index'i.
 *
 * **Bug fix:** Önceki sürüm `payments` array'inin sırasına bağımlıydı; IndexedDB
 * insertion-order ile geldiğinde 2 → 1 → 3 sırasında index'ler `last + 1`'e
 * eşleşmeyip atlanıyordu (örn. ödemeler [1,2,3] tamamlanmışken sonuç 1 çıkıyordu).
 * Şimdi paid index'leri `Set`'e koyup `last + 1`'i ileri doğru tarıyoruz — sıra
 * bağımsız ve sıralı amortizasyon invariant'ıyla tutarlı.
 */
export function paidThroughIndex(payments: LoanPayment[]): number {
  return computePaidThroughIndex(payments)
}

function loanRateInput(loan: Loan) {
  return {
    contractRate: { value: loan.interestRate, period: loan.interestPeriod },
    lateRate:
      loan.lateInterestRate !== undefined && loan.lateInterestPeriod
        ? { value: loan.lateInterestRate, period: loan.lateInterestPeriod }
        : undefined,
  }
}

/** Gecikme faizi hesabı için sözleşme oranları. */
export function loanLateFeeRates(loan: Loan): InstallmentLateFeeRates {
  return loanRateInput(loan)
}

/** Kalan borç = ödenmemiş taksitler + biriken gecikme faizi. */
export function remainingDebtForLoan(
  loan: Loan,
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate = new Date().toISOString(),
  payments: LoanPayment[] = [],
): string {
  return remainingDebtTotal({
    schedule,
    paidThroughIndex,
    asOfDate,
    installmentOverrides: unpaidInstallmentOverrides(payments),
    ...loanRateInput(loan),
  })
}

/** Erken kapama tahmini (anapara + kısmi faiz + gecikme faizi). */
export function payoffForLoan(
  loan: Loan,
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate = new Date().toISOString(),
  payments: LoanPayment[] = [],
): string {
  return payoffAmount({
    schedule,
    paidThroughIndex,
    asOfDate,
    installmentOverrides: unpaidInstallmentOverrides(payments),
    startDate: loan.startDate,
    ...loanRateInput(loan),
  })
}

export { remainingPrincipalBalance }
