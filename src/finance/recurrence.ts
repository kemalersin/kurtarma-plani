import { addDays, addMonths, addWeeks, addYears, parseISO } from 'date-fns'
import type { RecurrenceInterval } from '@/core/types/recurrence'
import { D, roundMoney, type DecimalInput } from '@/finance/decimal'

const MAX_OCCURRENCES = 10_000

function inDateRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

export interface RecurringCashflowItem {
  plannedDate: string
  actualDate?: string
  amount: DecimalInput
  archived?: boolean
  recurrence?: RecurrenceInterval
}

export function isRecurringCashflow(item: RecurringCashflowItem): boolean {
  return Boolean(item.recurrence)
}

function addRecurrenceStep(date: Date, interval: RecurrenceInterval): Date {
  switch (interval) {
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addWeeks(date, 1)
    case 'monthly':
      return addMonths(date, 1)
    case 'yearly':
      return addYears(date, 1)
  }
}

function toUtcNoon(iso: string): Date {
  return parseISO(`${iso.slice(0, 10)}T12:00:00.000Z`)
}

/** Plan tarihinden itibaren yinelenen gerçekleşmeleri üretir. */
export function expandRecurrenceOccurrences(
  item: RecurringCashflowItem,
  range: { from?: string; to?: string } = {},
): Array<{ date: string; amount: string }> {
  if (!item.recurrence || item.archived) return []

  const fromKey = range.from?.slice(0, 10)
  const toKey = range.to?.slice(0, 10)
  const amount = roundMoney(item.amount).toString()

  const out: Array<{ date: string; amount: string }> = []
  let current = toUtcNoon(item.plannedDate)
  let guard = 0

  while (fromKey && current.toISOString().slice(0, 10) < fromKey && guard < MAX_OCCURRENCES) {
    current = addRecurrenceStep(current, item.recurrence)
    guard += 1
  }

  guard = 0
  while (guard < MAX_OCCURRENCES) {
    const dateIso = current.toISOString()
    const dateKey = dateIso.slice(0, 10)
    if (toKey && dateKey > toKey) break
    if (!fromKey || dateKey >= fromKey) {
      out.push({ date: dateIso, amount })
    }
    current = addRecurrenceStep(current, item.recurrence)
    guard += 1
  }

  return out
}

export type CashflowOccurrenceBasis = 'plan' | 'actual' | 'effective'

/** Tek kayıt veya yinelenen serinin tarih/tutar tekrarlarını döner. */
export function iterateCashflowOccurrences(
  item: RecurringCashflowItem,
  options: {
    from?: string
    to?: string
    basis?: CashflowOccurrenceBasis
  } = {},
): Array<{ date: string; amount: string }> {
  if (item.archived) return []

  const basis = options.basis ?? 'effective'

  if (item.recurrence) {
    if (basis === 'actual') {
      return expandRecurrenceOccurrences(item, options)
    }
    return expandRecurrenceOccurrences(item, options)
  }

  let date: string | undefined
  if (basis === 'plan') date = item.plannedDate
  else if (basis === 'actual') date = item.actualDate
  else date = item.actualDate ?? item.plannedDate
  if (!date) return []
  if (!inDateRange(date, options.from, options.to)) return []
  return [{ date, amount: roundMoney(item.amount).toString() }]
}

/** Yinelenen kayıtların aralıktaki toplam tutarı. */
export function sumCashflowOccurrences(
  items: RecurringCashflowItem[],
  options: {
    from?: string
    to?: string
    basis?: CashflowOccurrenceBasis
  } = {},
): string {
  let total = D(0)
  for (const item of items) {
    for (const occ of iterateCashflowOccurrences(item, options)) {
      total = total.plus(occ.amount)
    }
  }
  return roundMoney(total).toString()
}
