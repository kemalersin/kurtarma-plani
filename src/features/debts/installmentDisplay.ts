import { differenceInCalendarDays, parseISO } from 'date-fns'
import { D, roundMoney } from '@/finance/decimal'
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
  if (payment?.paidDate && payment.paidAmount != null) {
    return roundMoney(payment.paidAmount).toString()
  }
  const plan = payment?.scheduledAmount ?? planInstallment
  return installmentDueWithLateFee(plan, dueDate, asOfIso, rates, payment)
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
  if (payment?.paidDate) {
    return displayInstallmentDueAmount(row.installment, row.dueDate, asOfIso, rates, payment)
  }

  const asOfKey = asOfIso.slice(0, 10)
  const isPaid = (index: number) =>
    index <= paidThroughIndex || Boolean(payments.get(index)?.paidDate)

  const rollup = findInstallmentRollupIndex(scheduleRows, paidThroughIndex, isPaid, asOfKey)
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
    const rowPlan = planInstallmentForRow(schedRow, rowPayment)
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
