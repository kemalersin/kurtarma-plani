import { unpaidInstallmentOverrides } from '@/features/debts/installmentDisplay'
import {
  lateDays,
  outstandingLateFeesTotal,
  remainingDebtTotal,
  remainingInstallmentsTotal,
  type LoanSchedule,
} from '@/finance/loan'
import type { RateInput } from '@/finance/rates'

export interface ScheduleDebtBreakdown {
  unpaidInstallments: string
  accruedLateFees: string
}

export interface ScheduleDelinquencyMetrics {
  remainingDebt: string
  breakdown: ScheduleDebtBreakdown
  /** Vadesi geçmiş ve henüz ödenmemiş taksit sayısı */
  overdueInstallmentCount: number
  /** Geç ödenmiş (vade < ödeme tarihi) taksit sayısı */
  historicalLatePaymentCount: number
}

function countOverdueInstallments(
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate: string,
): number {
  const asOf = new Date(asOfDate).getTime()
  let count = 0
  for (const row of schedule.rows) {
    if (row.index <= paidThroughIndex) continue
    if (new Date(row.dueDate).getTime() < asOf) count++
  }
  return count
}

function countHistoricalLatePayments(
  schedule: LoanSchedule,
  payments: Array<{ installmentIndex: number; paidDate?: string }>,
): number {
  const dueByIndex = new Map(schedule.rows.map((r) => [r.index, r.dueDate]))
  let count = 0
  for (const p of payments) {
    if (!p.paidDate) continue
    const due = dueByIndex.get(p.installmentIndex)
    if (due && lateDays(due, p.paidDate) > 0) count++
  }
  return count
}

export function computeScheduleDelinquencyMetrics(
  schedule: LoanSchedule,
  paidThroughIndex: number,
  asOfDate: string,
  contractRate: RateInput,
  lateRate: RateInput | undefined,
  payments: Array<{ installmentIndex: number; paidDate?: string; scheduledAmount?: number }>,
): ScheduleDelinquencyMetrics {
  const installmentOverrides = unpaidInstallmentOverrides(
    payments.map((p) => ({
      installmentIndex: p.installmentIndex,
      paidDate: p.paidDate,
      scheduledAmount: p.scheduledAmount ?? 0,
    })),
  )
  const params = {
    schedule,
    paidThroughIndex,
    asOfDate,
    contractRate,
    lateRate,
    installmentOverrides,
  }
  return {
    remainingDebt: remainingDebtTotal(params),
    breakdown: {
      unpaidInstallments: remainingInstallmentsTotal(
        schedule,
        paidThroughIndex,
        installmentOverrides,
      ),
      accruedLateFees: outstandingLateFeesTotal(params),
    },
    overdueInstallmentCount: countOverdueInstallments(schedule, paidThroughIndex, asOfDate),
    historicalLatePaymentCount: countHistoricalLatePayments(schedule, payments),
  }
}
