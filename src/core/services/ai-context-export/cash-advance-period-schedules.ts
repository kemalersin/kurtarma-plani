import type {
  Bank,
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'
import {
  createAiContextFormatters,
  dateField,
  moneyField,
  type AiContextFormatters,
} from '@/core/services/ai-context-export/format-helpers'
import type {
  CashAdvancePeriodRowExport,
  CashAdvancePeriodScheduleExport,
} from '@/core/services/ai-context-export/types'
import type { LocaleSettings } from '@/core/types/profile'
import { trimCashAdvancePeriodSchedulesForAi, trimPeriodRowsForAi } from '@/core/services/ai-context-export/schedule-prune'
import { revolvingRatesFromAccount } from '@/features/debts/cashAdvanceHelpers'
import {
  simulateRevolvingLedger,
  type CashAdvancePeriodProjection,
} from '@/finance/cash-advance'

function periodExportStatus(
  p: CashAdvancePeriodProjection,
  asOfIso: string,
): CashAdvancePeriodRowExport['status'] {
  if (p.paidInFull) return 'paid'
  if (p.dueDate.slice(0, 10) < asOfIso.slice(0, 10)) return 'overdue'
  return 'upcoming'
}

function periodHasActivity(p: CashAdvancePeriodProjection): boolean {
  return p.endingBalance > 0
}

/** AI bağlamı: yalnızca güncel ay vadesi (kümülatif borç hesap özetinde). */
function selectCashAdvancePeriodsForAi(
  periods: CashAdvancePeriodProjection[],
  asOf: string,
): CashAdvancePeriodProjection[] {
  const asOfKey = asOf.slice(0, 7)
  const current = periods.find((p) => p.monthKey === asOfKey)
  if (!current || current.endingBalance <= 0) return []
  return [current]
}

export function buildCashAdvancePeriodSchedules(params: {
  accounts: CashAdvanceAccount[]
  txns: CashAdvanceTransaction[]
  bankMap: Map<string, Bank>
  fmt: AiContextFormatters
  asOf: string
  taxRateMonthly?: number
}): CashAdvancePeriodScheduleExport[] {
  const { accounts, txns, bankMap, fmt, asOf } = params
  const out: CashAdvancePeriodScheduleExport[] = []

  for (const acc of accounts) {
    if (acc.archived) continue
    const bank = acc.bankId ? bankMap.get(acc.bankId) : undefined
    const own = txns.filter((t) => t.accountId === acc.id)
    const { periods, state } = simulateRevolvingLedger({
      openingBalance: acc.openingBalance ?? 0,
      openingDate: acc.openingDate,
      transactions: own.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      rates: revolvingRatesFromAccount(acc, params.taxRateMonthly),
      asOf,
    })

    const cumulativeLate = Number(state.lateInterest)

    const periodRows: CashAdvancePeriodRowExport[] = []
    for (const p of selectCashAdvancePeriodsForAi(periods, asOf)) {
      if (!periodHasActivity(p)) continue
      periodRows.push({
        periodLabel: p.monthKey,
        dueDate: dateField(p.dueDate, fmt),
        endingBalance: moneyField(p.endingBalance, acc.currency, fmt),
        minPayment: moneyField(p.minPayment, acc.currency, fmt),
        contractualInterest: moneyField(p.contractualInterest, acc.currency, fmt),
        lateInterest: moneyField(
          cumulativeLate > 0 ? cumulativeLate : p.lateInterest,
          acc.currency,
          fmt,
        ),
        paidInPeriod: moneyField(p.paymentsInMonth, acc.currency, fmt),
        paidInFull: p.paidInFull,
        minPaymentMet: p.paid,
        status: periodExportStatus(p, asOf),
      })
    }

    const unpaidRows = trimPeriodRowsForAi(periodRows)
    if (unpaidRows.length === 0) continue
    out.push({
      accountId: acc.id,
      label: bank ? `${acc.name} · ${bank.name}` : acc.name,
      bankName: bank?.name,
      currency: acc.currency,
      periods: unpaidRows,
    })
  }

  return trimCashAdvancePeriodSchedulesForAi(out)
}

/** Sohbet snapshot'ı için türetilmiş nakit avans ay sonu vadeleri. */
export function buildCashAdvancePeriodSchedulesFromRows(
  accounts: CashAdvanceAccount[],
  txns: CashAdvanceTransaction[],
  banks: Bank[],
  localeSettings: LocaleSettings,
  asOf = new Date().toISOString(),
  taxRateMonthly?: number,
): CashAdvancePeriodScheduleExport[] {
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const fmt = createAiContextFormatters(localeSettings)
  return buildCashAdvancePeriodSchedules({
    accounts,
    txns,
    bankMap,
    fmt,
    asOf,
    taxRateMonthly,
  })
}
