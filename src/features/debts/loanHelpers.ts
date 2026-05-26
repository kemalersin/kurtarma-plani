import type { Loan, LoanPayment } from '@/core/types/entities'
import type { InstallmentLateFeeRates } from './installmentDisplay'
import { unpaidInstallmentOverrides } from './installmentDisplay'
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
    firstInstallmentDate: loan.firstInstallmentDate,
    taxRateMonthly: loan.taxRateMonthly,
  })
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
  const paid = new Set<number>()
  for (const p of payments) {
    if (p.paidDate) paid.add(p.installmentIndex)
  }
  let last = 0
  while (paid.has(last + 1)) last++
  return last
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
    ...loanRateInput(loan),
  })
}

export { remainingPrincipalBalance }
