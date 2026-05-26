import type {
  Bank,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import {
  createAiContextFormatters,
  dateField,
  moneyField,
  type AiContextFormatters,
} from '@/core/services/ai-context-export/format-helpers'
import { computeScheduleDelinquencyMetrics } from '@/core/services/ai-context-export/schedule-metrics'
import {
  trimInstallmentAdvanceSchedulesForAi,
  trimLoanSchedulesForAi,
} from '@/core/services/ai-context-export/schedule-prune'
import type {
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
  ScheduleInstallmentRow,
} from '@/core/services/ai-context-export/types'
import type { LocaleSettings } from '@/core/types/profile'
import {
  projectInstallmentRowDueAmount,
  type InstallmentLateFeeRates,
} from '@/features/debts/installmentDisplay'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  payoffForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import {
  buildScheduleForLoan,
  paidThroughIndex,
  payoffForLoan,
} from '@/features/debts/loanHelpers'
import type { LoanSchedule, ScheduleRow } from '@/finance/loan'

function loanRateInput(loan: Loan) {
  return {
    contractRate: { value: loan.interestRate, period: loan.interestPeriod },
    lateRate:
      loan.lateInterestRate !== undefined && loan.lateInterestPeriod
        ? { value: loan.lateInterestRate, period: loan.lateInterestPeriod }
        : undefined,
  }
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

function installmentStatus(
  row: ScheduleRow,
  paidIdx: number,
  asOf: string,
): ScheduleInstallmentRow['status'] {
  if (row.index <= paidIdx) return 'paid'
  if (new Date(row.dueDate).getTime() < new Date(asOf).getTime()) return 'overdue'
  return 'unpaid'
}

function buildScheduleRows(
  scheduleRows: ScheduleRow[],
  paidIdx: number,
  paymentMap: Map<number, { paidDate?: string; paidAmount?: number; scheduledAmount?: number; lateFee?: number }>,
  currency: string,
  fmt: AiContextFormatters,
  asOf: string,
  rates: InstallmentLateFeeRates,
): ScheduleInstallmentRow[] {
  return scheduleRows.map((row) => {
    const payment = paymentMap.get(row.index)
    const amount = projectInstallmentRowDueAmount(
      row,
      scheduleRows,
      paidIdx,
      asOf,
      rates,
      paymentMap,
    )
    const status = installmentStatus(row, paidIdx, asOf)
    const base: ScheduleInstallmentRow = {
      index: row.index,
      dueDate: dateField(row.dueDate, fmt),
      installment: moneyField(amount, currency, fmt),
      principal: moneyField(row.principal, currency, fmt),
      interest: moneyField(row.interest, currency, fmt),
      beginningBalance: moneyField(row.beginningBalance, currency, fmt),
      endingBalance: moneyField(row.endingBalance, currency, fmt),
      status,
    }
    if (payment?.paidDate) {
      base.paidDate = dateField(payment.paidDate, fmt)
      if (payment.paidAmount != null) {
        base.paidAmount = moneyField(payment.paidAmount, currency, fmt)
      }
    }
    return base
  })
}

function buildScheduleExportFields(
  schedule: LoanSchedule,
  paidIdx: number,
  ownPayments: Array<{
    installmentIndex: number
    paidDate?: string
    paidAmount?: number
    scheduledAmount?: number
  }>,
  currency: string,
  fmt: AiContextFormatters,
  asOf: string,
  rates: ReturnType<typeof loanRateInput>,
) {
  const payMap = new Map(ownPayments.map((p) => [p.installmentIndex, p]))
  const metrics = computeScheduleDelinquencyMetrics(
    schedule,
    paidIdx,
    asOf,
    rates.contractRate,
    rates.lateRate,
    ownPayments,
  )
  return {
    paidThroughIndex: paidIdx,
    remainingDebt: moneyField(metrics.remainingDebt, currency, fmt),
    remainingDebtBreakdown: {
      unpaidInstallments: moneyField(
        metrics.breakdown.unpaidInstallments,
        currency,
        fmt,
      ),
      accruedLateFees: moneyField(metrics.breakdown.accruedLateFees, currency, fmt),
    },
    overdueInstallmentCount: metrics.overdueInstallmentCount,
    historicalLatePaymentCount: metrics.historicalLatePaymentCount,
    installments: buildScheduleRows(
      schedule.rows,
      paidIdx,
      payMap,
      currency,
      fmt,
      asOf,
      rates,
    ),
  }
}

export function buildLoanSchedules(params: {
  loans: Loan[]
  loanPayments: LoanPayment[]
  bankMap: Map<string, Bank>
  fmt: AiContextFormatters
  asOf: string
}): LoanScheduleExport[] {
  const { loans, loanPayments, bankMap, fmt, asOf } = params
  return loans.map((loan) => {
    const schedule = buildScheduleForLoan(loan)
    const ownPayments = loanPayments.filter((p) => p.loanId === loan.id)
    const paidIdx = paidThroughIndex(ownPayments)
    const bank = loan.bankId ? bankMap.get(loan.bankId) : undefined
    const payoff = payoffForLoan(loan, schedule, paidIdx, asOf, ownPayments)
    const rates = loanRateInput(loan)
    return {
      loanId: loan.id,
      label: loan.name,
      bankName: bank?.name,
      currency: loan.currency,
      earlyPayoff: moneyField(payoff, loan.currency, fmt),
      ...buildScheduleExportFields(
        schedule,
        paidIdx,
        ownPayments,
        loan.currency,
        fmt,
        asOf,
        rates,
      ),
    }
  })
}

export function buildInstallmentAdvanceSchedules(params: {
  installmentAdvances: InstallmentCashAdvance[]
  installmentPayments: InstallmentCashAdvancePayment[]
  bankMap: Map<string, Bank>
  fmt: AiContextFormatters
  asOf: string
}): InstallmentAdvanceScheduleExport[] {
  const { installmentAdvances, installmentPayments, bankMap, fmt, asOf } = params
  return installmentAdvances.map((adv) => {
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const ownPayments = installmentPayments.filter((p) => p.installmentAdvanceId === adv.id)
    const paidIdx = advancePaidThroughIndex(ownPayments)
    const bank = adv.bankId ? bankMap.get(adv.bankId) : undefined
    const payoff = payoffForInstallmentAdvance(adv, schedule, paidIdx, asOf, ownPayments)
    const rates = advanceRateInput(adv)
    return {
      advanceId: adv.id,
      label: adv.name,
      bankName: bank?.name,
      currency: adv.currency,
      earlyPayoff: moneyField(payoff, adv.currency, fmt),
      ...buildScheduleExportFields(
        schedule,
        paidIdx,
        ownPayments,
        adv.currency,
        fmt,
        asOf,
        rates,
      ),
    }
  })
}

/** Sohbet snapshot / export kırpması — güncel ay ve sonrası ödenmemiş taksit satırları. */
export function buildLoanSchedulesFromRows(
  loans: Loan[],
  loanPayments: LoanPayment[],
  banks: Bank[],
  localeSettings: LocaleSettings,
  asOf = new Date().toISOString(),
): LoanScheduleExport[] {
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const fmt = createAiContextFormatters(localeSettings)
  return trimLoanSchedulesForAi(
    buildLoanSchedules({ loans, loanPayments, bankMap, fmt, asOf }),
    asOf,
  )
}

export function buildInstallmentAdvanceSchedulesFromRows(
  installmentAdvances: InstallmentCashAdvance[],
  installmentPayments: InstallmentCashAdvancePayment[],
  banks: Bank[],
  localeSettings: LocaleSettings,
  asOf = new Date().toISOString(),
): InstallmentAdvanceScheduleExport[] {
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const fmt = createAiContextFormatters(localeSettings)
  return trimInstallmentAdvanceSchedulesForAi(
    buildInstallmentAdvanceSchedules({
      installmentAdvances,
      installmentPayments,
      bankMap,
      fmt,
      asOf,
    }),
    asOf,
  )
}
