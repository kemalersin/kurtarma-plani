import { differenceInCalendarDays, parseISO } from 'date-fns'
import { D, roundMoney, Decimal } from '@/finance/decimal'
import { computeLateFee, lateDays } from '@/finance/loan'
import type { RateInput } from '@/finance/rates'

/** Taksit planı satırı (projeksiyon girdisi). */
export interface InstallmentScheduleRowRef {
  index: number
  dueDate: string
  installment: string
}

/** Vade tarihi bugünden sonra mı (henüz ödenmemiş / ileride). */
export function isInstallmentUpcoming(dueDate: string, asOf = new Date()): boolean {
  return differenceInCalendarDays(parseISO(dueDate), asOf) > 0
}

export interface InstallmentLateFeeRates {
  contractRate: RateInput
  lateRate?: RateInput
}

export interface InstallmentPaymentLateSnapshot {
  paidDate?: string
  lateFee?: number
}

/**
 * Plan taksiti + gecikme faizi (vadesi geçmiş ve henüz ödenmemişse bugüne kadar;
 * ödendiyse ödeme tarihine veya kayıtlı lateFee'ye göre).
 */
export function installmentDueWithLateFee(
  planInstallment: string | number,
  dueDate: string,
  asOfIso: string,
  rates: InstallmentLateFeeRates,
  payment?: InstallmentPaymentLateSnapshot,
): string {
  const plan = D(planInstallment)
  if (payment?.paidDate && payment.lateFee != null && payment.lateFee > 0) {
    return roundMoney(plan.plus(payment.lateFee)).toString()
  }
  const refIso = payment?.paidDate ?? asOfIso
  const days = lateDays(dueDate, refIso)
  if (days <= 0) return roundMoney(plan).toString()
  const fee = D(
    computeLateFee(planInstallment, days, rates.contractRate, rates.lateRate),
  )
  return roundMoney(plan.plus(fee)).toString()
}

export interface InstallmentDueDisplayPayment extends InstallmentPaymentLateSnapshot {
  scheduledAmount?: number
  paidAmount?: number
}

export interface InstallmentPaymentSettlement {
  paidDate?: string
  paidAmount?: number
  scheduledAmount?: number
  lateFee?: number
}

function paymentSettlement(
  payment: InstallmentPaymentSettlement,
  planFallback?: string | number,
): InstallmentPaymentSettlement & { scheduledAmount: number } {
  return {
    ...payment,
    scheduledAmount: payment.scheduledAmount ?? Number(planFallback ?? 0),
  }
}

/** Taksit borcunun tamamı (plan + kayıtlı gecikme faizi) kapatıldı mı. */
export function isInstallmentFullyPaid(payment: InstallmentPaymentSettlement): boolean {
  if (!payment.paidDate) return false
  if (payment.scheduledAmount == null) {
    // Geriye dönük kayıtlar: plan tutarı yoksa paidDate tam ödeme sayılır.
    return true
  }
  const due = roundMoney(D(payment.scheduledAmount).plus(payment.lateFee ?? 0))
  const paid = payment.paidAmount != null ? D(payment.paidAmount) : due
  return paid.gte(due)
}

/** Ödenen tutar var ama taksit tam kapanmadı. */
export function isInstallmentPartiallyPaid(payment: InstallmentPaymentSettlement): boolean {
  return Boolean(payment.paidDate) && !isInstallmentFullyPaid(payment)
}

/** Kısmi ödemede planda kalan anapara+taksit tutarı (gecikme faizi hariç). */
export function installmentUnpaidPlanAmount(
  payment: InstallmentPaymentSettlement,
  planFallback?: string | number,
): number {
  const settled = paymentSettlement(payment, planFallback)
  if (!settled.paidDate) return settled.scheduledAmount
  if (isInstallmentFullyPaid(settled)) return 0
  const plan = D(settled.scheduledAmount)
  const paid = D(settled.paidAmount ?? 0)
  return roundMoney(Decimal.max(0, plan.minus(Decimal.min(paid, plan)))).toNumber()
}

/**
 * Boşluksuz tam ödenmiş ardışık en yüksek taksit index'i.
 * Kısmi ödemeler (paidDate var, tutar eksik) sayılmaz.
 */
export function computePaidThroughIndex(
  payments: Array<{ installmentIndex: number } & InstallmentPaymentSettlement>,
): number {
  const paid = new Set<number>()
  for (const p of payments) {
    if (isInstallmentFullyPaid(p)) paid.add(p.installmentIndex)
  }
  let last = 0
  while (paid.has(last + 1)) last++
  return last
}

/**
 * Liste / grafik / taksit planında görünen tutar: plan (veya override) +
 * yalnızca bugüne (veya ödeme tarihine) kadar biriken gecikme faizi.
 * Vadesi gelmemiş taksitlerde gelecek gecikme faizi eklenmez.
 */
export function displayInstallmentDueAmount(
  planInstallment: string | number,
  dueDate: string,
  asOfIso: string,
  rates: InstallmentLateFeeRates,
  payment?: InstallmentDueDisplayPayment,
): string {
  const settled = payment ? paymentSettlement(payment, planInstallment) : undefined
  if (settled?.paidDate && isInstallmentFullyPaid(settled)) {
    if (settled.paidAmount != null) {
      return roundMoney(settled.paidAmount).toString()
    }
  }
  const plan = payment?.scheduledAmount ?? planInstallment
  if (settled?.paidDate && isInstallmentPartiallyPaid(settled)) {
    const totalIfUnpaid = installmentDueWithLateFee(plan, dueDate, asOfIso, rates)
    const remaining = D(totalIfUnpaid).minus(settled.paidAmount ?? 0)
    return roundMoney(Decimal.max(0, remaining)).toString()
  }
  const baseDue = installmentDueWithLateFee(plan, dueDate, asOfIso, rates, payment)
  return baseDue
}

function planInstallmentForRow(
  row: InstallmentScheduleRowRef,
  payment?: InstallmentDueDisplayPayment,
): string {
  const override = payment?.scheduledAmount
  return override != null ? String(override) : row.installment
}

/**
 * Geciken ödenmemiş taksitlerin birikeceği hedef taksit index'i.
 * Ardışık gecikmiş ödenmemiş blok bir sonraki taksit satırına taşınır;
 * blok sonrası vadeler yalnızca kendi plan tutarını gösterir.
 */
export function findInstallmentRollupIndex(
  rows: readonly InstallmentScheduleRowRef[],
  paidThroughIndex: number,
  isPaid: (index: number) => boolean,
  asOfKey: string,
): number | null {
  const firstUnpaid = paidThroughIndex + 1
  if (firstUnpaid > rows.length) return null

  let lastOverdueUnpaid: number | null = null
  for (const row of rows) {
    if (row.index < firstUnpaid) continue
    if (isPaid(row.index)) continue
    if (row.dueDate.slice(0, 10) < asOfKey) {
      lastOverdueUnpaid = row.index
      continue
    }
    break
  }

  if (lastOverdueUnpaid == null) return null
  if (lastOverdueUnpaid < rows.length) return lastOverdueUnpaid + 1
  return lastOverdueUnpaid
}

function owedPlanAmountForRow(
  schedRow: InstallmentScheduleRowRef,
  rowPayment?: InstallmentDueDisplayPayment,
): string {
  if (rowPayment?.paidDate) {
    const settled = paymentSettlement(rowPayment, schedRow.installment)
    if (isInstallmentFullyPaid(settled)) return '0'
    if (isInstallmentPartiallyPaid(settled)) {
      return String(installmentUnpaidPlanAmount(settled, schedRow.installment))
    }
  }
  return planInstallmentForRow(schedRow, rowPayment)
}

/**
 * Liste / grafikte görünen taksit tutarı — geciken ödenmemiş taksitler + faiz/ücret
 * bir sonraki vade satırına taşınır; sonraki vadeler yalnızca kendi plan tutarını gösterir.
 */
export function projectInstallmentRowDueAmount(
  row: InstallmentScheduleRowRef,
  scheduleRows: readonly InstallmentScheduleRowRef[],
  paidThroughIndex: number,
  asOfIso: string,
  rates: InstallmentLateFeeRates,
  payments: ReadonlyMap<number, InstallmentDueDisplayPayment>,
): string {
  const payment = payments.get(row.index)
  const settled = payment ? paymentSettlement(payment, row.installment) : undefined
  if (settled?.paidDate && isInstallmentFullyPaid(settled)) {
    return displayInstallmentDueAmount(row.installment, row.dueDate, asOfIso, rates, payment)
  }

  const asOfKey = asOfIso.slice(0, 10)
  const isPaid = (index: number) => {
    if (index <= paidThroughIndex) return true
    const rowPayment = payments.get(index)
    return rowPayment != null && isInstallmentFullyPaid(paymentSettlement(rowPayment))
  }

  const rollup = findInstallmentRollupIndex(scheduleRows, paidThroughIndex, isPaid, asOfKey)

  // Kısmi ödenmiş taksit: kalan borç kendi satırında değil, rollup hedefinde toplanır.
  if (settled?.paidDate && isInstallmentPartiallyPaid(settled) && row.index !== rollup) {
    return '0'
  }

  if (rollup == null) {
    return installmentDueWithLateFee(
      planInstallmentForRow(row, payment),
      row.dueDate,
      asOfIso,
      rates,
      payment,
    )
  }

  const firstUnpaid = paidThroughIndex + 1
  const plan = planInstallmentForRow(row, payment)

  if (row.index !== rollup) {
    return roundMoney(plan).toString()
  }

  const rollupRow = scheduleRows.find((r) => r.index === rollup)
  if (!rollupRow) return roundMoney(plan).toString()

  const rollupDueKey = rollupRow.dueDate.slice(0, 10)
  const priorFeeEnd = rollupDueKey > asOfKey ? rollupRow.dueDate : asOfIso
  let total = D(0)

  for (const schedRow of scheduleRows) {
    if (schedRow.index < firstUnpaid || schedRow.index > rollup) continue
    if (isPaid(schedRow.index)) continue

    const rowPayment = payments.get(schedRow.index)
    const rowPlan = owedPlanAmountForRow(schedRow, rowPayment)
    if (D(rowPlan).lte(0)) continue
    total = total.plus(rowPlan)

    if (schedRow.index < rollup) {
      const days = lateDays(schedRow.dueDate, priorFeeEnd)
      if (days > 0) {
        total = total.plus(
          computeLateFee(rowPlan, days, rates.contractRate, rates.lateRate),
        )
      }
      continue
    }

    if (rollupDueKey <= asOfKey) {
      const days = lateDays(schedRow.dueDate, asOfIso)
      if (days > 0) {
        total = total.plus(
          computeLateFee(rowPlan, days, rates.contractRate, rates.lateRate),
        )
      }
    }
  }

  return roundMoney(total).toString()
}

/** Tabloda gösterilecek plan taksit tutarı (override; kısmi ödemede kalan değil). */
export function displayInstallmentAmount(
  planInstallment: string | number,
  payment?: { scheduledAmount?: number; paidDate?: string; paidAmount?: number; lateFee?: number },
): string | number {
  if (!payment) return planInstallment
  if (payment.paidDate && isInstallmentFullyPaid(paymentSettlement(payment, planInstallment))) {
    return payment.paidAmount ?? payment.scheduledAmount ?? planInstallment
  }
  if (!payment.paidDate && payment.scheduledAmount != null) {
    return payment.scheduledAmount
  }
  return planInstallment
}

/**
 * Taksit planı drawer «Taksit» sütunu: plan tutarı; rollup hedefinde devredilen kalan +
 * gecikme faizi dahil güncel vade borcu. Kısmi ödenmiş kaynak satırda plan tutarı kalır.
 */
export function displayInstallmentScheduleAmount(
  row: InstallmentScheduleRowRef,
  scheduleRows: readonly InstallmentScheduleRowRef[],
  paidThroughIndex: number,
  asOfIso: string,
  rates: InstallmentLateFeeRates,
  payments: ReadonlyMap<number, InstallmentDueDisplayPayment>,
): string {
  const payment = payments.get(row.index)
  const settled = payment ? paymentSettlement(payment, row.installment) : undefined

  if (settled?.paidDate && isInstallmentFullyPaid(settled)) {
    return String(displayInstallmentAmount(row.installment, payment))
  }

  const dueAmount = projectInstallmentRowDueAmount(
    row,
    scheduleRows,
    paidThroughIndex,
    asOfIso,
    rates,
    payments,
  )

  if (D(dueAmount).gt(0)) {
    return dueAmount
  }

  return String(displayInstallmentAmount(row.installment, payment))
}

/** Sıradaki taksit ödenebilir mi (bir önceki ödenmiş olmalı). */
export function canMarkInstallmentAsPaid(
  installmentIndex: number,
  paidThroughIndex: number,
): boolean {
  return paidThroughIndex >= installmentIndex - 1
}

/** Ödenmemiş / kısmi taksit override'ları (installmentIndex → kalan plan tutarı). */
export function unpaidInstallmentOverrides(
  payments: Array<{ installmentIndex: number; scheduledAmount: number; paidDate?: string; paidAmount?: number; lateFee?: number }>,
): Map<number, number> {
  const map = new Map<number, number>()
  for (const p of payments) {
    const remaining = installmentUnpaidPlanAmount(p)
    if (remaining > 0) map.set(p.installmentIndex, remaining)
  }
  return map
}
