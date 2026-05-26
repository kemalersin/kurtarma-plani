import type { Bank, CreditCard, CreditCardTransaction } from '@/core/types/entities'
import {
  buildCardPeriods,
  projectCardPeriodDebts,
  type CardPeriodDebtProjection,
} from '@/features/debts/cardHelpers'
import {
  createAiContextFormatters,
  dateField,
  moneyField,
  type AiContextFormatters,
} from '@/core/services/ai-context-export/format-helpers'
import type {
  CreditCardPeriodRowExport,
  CreditCardPeriodScheduleExport,
} from '@/core/services/ai-context-export/types'
import type { LocaleSettings } from '@/core/types/profile'

function periodExportStatus(
  p: CardPeriodDebtProjection,
  asOfIso: string,
): CreditCardPeriodRowExport['status'] {
  if (p.paidInFull) return 'paid'
  if (p.dueDate.slice(0, 10) < asOfIso.slice(0, 10)) return 'overdue'
  return 'upcoming'
}

function periodHasActivity(p: CardPeriodDebtProjection): boolean {
  return (
    p.carriedIn > 0 ||
    p.lateInterest > 0 ||
    p.periodAccruals > 0 ||
    p.endingBalance > 0 ||
    Number(p.paymentsInWindow ?? 0) > 0
  )
}

export function buildCreditCardPeriodSchedules(params: {
  creditCards: CreditCard[]
  creditCardTxns: CreditCardTransaction[]
  bankMap: Map<string, Bank>
  fmt: AiContextFormatters
  asOf: string
  periodsCount?: number
}): CreditCardPeriodScheduleExport[] {
  const { creditCards, creditCardTxns, bankMap, fmt, asOf } = params
  const periodsCount = params.periodsCount ?? 12
  const asOfDate = new Date(asOf)
  const out: CreditCardPeriodScheduleExport[] = []

  for (const card of creditCards) {
    if (card.archived) continue
    const bank = card.bankId ? bankMap.get(card.bankId) : undefined
    const own = creditCardTxns.filter((t) => t.cardId === card.id)
    const periods = buildCardPeriods(card, own, { periods: periodsCount, asOf: asOfDate })
    const projections = projectCardPeriodDebts(card, own, { periods })

    const periodRows: CreditCardPeriodRowExport[] = []
    for (let i = 0; i < projections.length; i++) {
      const p = projections[i]!
      const period = periods[i]
      if (!periodHasActivity(p)) continue
      const paidInPeriod = Number(p.paymentsInWindow ?? 0)
      periodRows.push({
        periodLabel: period?.label ?? '',
        cutoffDate: dateField(p.cutoffDate, fmt),
        dueDate: dateField(p.dueDate, fmt),
        carriedIn: moneyField(p.carriedIn, card.currency, fmt),
        lateInterest: moneyField(p.lateInterest, card.currency, fmt),
        periodAccruals: moneyField(p.periodAccruals, card.currency, fmt),
        endingBalance: moneyField(p.endingBalance, card.currency, fmt),
        minPayment: moneyField(p.minPayment, card.currency, fmt),
        paidInPeriod: moneyField(paidInPeriod, card.currency, fmt),
        paidInFull: p.paidInFull,
        minPaymentMet: p.paid,
        status: periodExportStatus(p, asOf),
      })
    }

    if (periodRows.length === 0) continue
    out.push({
      cardId: card.id,
      label: bank ? `${card.name} · ${bank.name}` : card.name,
      bankName: bank?.name,
      currency: card.currency,
      periods: periodRows,
    })
  }

  return out
}

/** Sohbet snapshot'ı için türetilmiş kart dönem projeksiyonları. */
export function buildCreditCardPeriodSchedulesFromRows(
  creditCards: CreditCard[],
  creditCardTxns: CreditCardTransaction[],
  banks: Bank[],
  localeSettings: LocaleSettings,
  asOf = new Date().toISOString(),
): CreditCardPeriodScheduleExport[] {
  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const fmt = createAiContextFormatters(localeSettings)
  return buildCreditCardPeriodSchedules({
    creditCards,
    creditCardTxns,
    bankMap,
    fmt,
    asOf,
  })
}
