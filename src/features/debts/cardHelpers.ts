import { addMonths, setDate, isAfter } from 'date-fns'
import type {
  CreditCard,
  CreditCardTransaction,
} from '@/core/types/entities'
import { creditCardStatement, type CardStatement } from '@/finance/credit-card'

export interface CardPeriod {
  /** Dönem etiketi (örn. "Şubat 2026") */
  label: string
  /** Hesap kesim tarihi (ISO) — dönem sonu */
  cutoffDate: string
  /** Son ödeme tarihi (ISO) */
  dueDate: string
  /** Bu dönemin (önceki kesim + 1 ile bu kesim arası) hareketleri */
  transactions: CreditCardTransaction[]
  /** Bu dönem başı bakiye (önceki dönem sonu) */
  openingBalance: number
  /** Bu dönemin sonundaki bakiye + asgari ödeme */
  statement: CardStatement
}

function safeDayInMonth(date: Date, day: number): Date {
  // Şubat 30 gibi geçersiz günleri ay sonuna sabitle: setDate clamp etmez,
  // o yüzden ay başlangıcına sıfırla + min(gün, lastDayOfMonth)
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return setDate(new Date(Date.UTC(y, m, 1)), Math.min(day, lastDay))
}

/**
 * Kart için son N dönem üretir (en eski → en yeni).
 * Dönem = [dönem başı kesim, sonraki kesim) — son dönem **açık** hesap dönemidir
 * (en son kesim ≤ asOf ile bir sonraki kesim arası); bugün eklenen hareketler burada görünür.
 */
export function buildCardPeriods(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  options: { periods?: number; asOf?: Date } = {},
): CardPeriod[] {
  const { periods = 6, asOf = new Date() } = options
  const own = transactions
    .filter((t) => t.cardId === card.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  /** asOf'a göre en son tamamlanmış / devam eden dönemin başlangıç kesimi */
  let latestCutoff = safeDayInMonth(asOf, card.statementCutoffDay)
  if (isAfter(latestCutoff, asOf)) {
    latestCutoff = addMonths(latestCutoff, -1)
  }

  const result: CardPeriod[] = []
  let opening = card.openingBalance ?? 0

  const earliestStart = addMonths(latestCutoff, -(periods - 1))

  const beforeEarliest = own.filter((t) => t.date < earliestStart.toISOString())
  for (const t of beforeEarliest) {
    opening =
      t.type === 'payment' ? opening - t.amount : opening + t.amount
  }
  if (opening < 0) opening = 0

  let periodStart = earliestStart
  let periodEnd = addMonths(periodStart, 1)

  for (let i = 0; i < periods; i++) {
    const periodTxns = own.filter(
      (t) =>
        t.date >= periodStart.toISOString() && t.date < periodEnd.toISOString(),
    )
    const stmt = creditCardStatement({
      openingBalance: opening,
      transactions: periodTxns.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      limit: card.limit,
    })
    const dueDate = (() => {
      let d = safeDayInMonth(periodEnd, card.paymentDueDay)
      if (!isAfter(d, periodEnd)) d = addMonths(d, 1)
      return d.toISOString()
    })()

    result.push({
      label: new Intl.DateTimeFormat('tr-TR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(periodEnd),
      cutoffDate: periodEnd.toISOString(),
      dueDate,
      transactions: periodTxns,
      openingBalance: opening,
      statement: stmt,
    })

    opening = Number(stmt.endingBalance)
    periodStart = periodEnd
    periodEnd = addMonths(periodEnd, 1)
  }

  return result
}

/** Kartın bugünkü (en güncel kesim) dönem özetini döner. */
export function latestCardStatement(
  card: CreditCard,
  transactions: CreditCardTransaction[],
): CardPeriod | null {
  const periods = buildCardPeriods(card, transactions, { periods: 1 })
  return periods[periods.length - 1] ?? null
}
