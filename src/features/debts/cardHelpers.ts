import { addMonths, setDate, isAfter, differenceInCalendarDays } from 'date-fns'
import type {
  CreditCard,
  CreditCardTransaction,
  CreditCardTxnType,
} from '@/core/types/entities'
import {
  creditCardLateInterest,
  creditCardStatement,
  resolveCreditCardRepaymentTotal,
  splitInstallmentAmount,
  type CardStatement,
} from '@/finance/credit-card'
import { D, roundMoney } from '@/finance/decimal'

/**
 * Bir dönem içerisinde gösterilen / tahakkuk eden hareket. Taksitli alışverişler
 * `expandInstallments` ile **sanal** kayıtlara genişletilir; orijinal kart kaydı
 * (`originalTxnId`) düzenlemede / silmede referans alınır.
 */
export interface PeriodTxn {
  /** UI key'i — sanal taksit için `origId#i`, tek seferlik için `origId`. */
  key: string
  /** Orijinal `creditCardTransaction.id` (düzenleme için). */
  originalTxnId: string
  date: string
  amount: number
  type: CreditCardTxnType
  description?: string
  /** Taksitli alışverişlerde 1-tabanlı taksit sırası. */
  installmentIndex?: number
  /** Toplam taksit sayısı. Taksitsiz kayıtlar için undefined. */
  installmentCount?: number
}

export interface CardPeriod {
  /** Dönem etiketi (örn. "Şubat 2026") */
  label: string
  /** Hesap kesim tarihi (ISO) — dönem sonu */
  cutoffDate: string
  /** Son ödeme tarihi (ISO) */
  dueDate: string
  /** Bu döneme düşen tahakkuklar (taksitler genişletilmiş hâlde). */
  transactions: PeriodTxn[]
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
 * Taksitli kart hareketlerini sanal tahakkuk kayıtlarına genişletir. İlk taksit
 * orijinal işlem tarihinde, sonrakiler aylık aralıklarla yansır; toplam tutar
 * yuvarlamayla **son taksite** bırakılır. `payment` türü taksitli olamaz —
 * taksit talimatı yalnızca `purchase` ve `cashAdvance` için anlamlıdır
 * (form tarafında zorlanır).
 */
export function expandInstallments(
  card: CreditCard,
  transactions: CreditCardTransaction[],
): PeriodTxn[] {
  const out: PeriodTxn[] = []
  for (const t of transactions) {
    if (t.cardId !== card.id) continue
    const count =
      t.type === 'payment' ? 1 : t.installmentCount && t.installmentCount > 1 ? t.installmentCount : 1
    const debtTotal = resolveCreditCardRepaymentTotal(t, card)
    if (count === 1) {
      out.push({
        key: t.id,
        originalTxnId: t.id,
        date: t.date,
        amount: debtTotal,
        type: t.type,
        description: t.description,
      })
      continue
    }
    const parts = splitInstallmentAmount(debtTotal, count)
    const base = new Date(t.date)
    for (let i = 0; i < count; i++) {
      const d = new Date(base)
      d.setUTCMonth(d.getUTCMonth() + i)
      out.push({
        key: `${t.id}#${i + 1}`,
        originalTxnId: t.id,
        date: d.toISOString(),
        amount: Number(parts[i]),
        type: t.type,
        description: t.description,
        installmentIndex: i + 1,
        installmentCount: count,
      })
    }
  }
  return out
}

/**
 * Kart için son N dönem üretir (en eski → en yeni).
 * Dönem = [dönem başı kesim, sonraki kesim) — son dönem **açık** hesap dönemidir
 * (en son kesim ≤ asOf ile bir sonraki kesim arası); bugün eklenen hareketler burada görünür.
 *
 * Taksitli işlemler `expandInstallments` ile sanal hareketlere bölünür; her
 * dönem yalnızca o döneme **düşen** taksiti içerir.
 */
export function buildCardPeriods(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  options: { periods?: number; asOf?: Date } = {},
): CardPeriod[] {
  const { periods = 6, asOf = new Date() } = options
  const expanded = expandInstallments(card, transactions).sort((a, b) =>
    a.date.localeCompare(b.date),
  )

  /** asOf'a göre en son tamamlanmış / devam eden dönemin başlangıç kesimi */
  let latestCutoff = safeDayInMonth(asOf, card.statementCutoffDay)
  if (isAfter(latestCutoff, asOf)) {
    latestCutoff = addMonths(latestCutoff, -1)
  }

  const result: CardPeriod[] = []
  let opening = card.openingBalance ?? 0

  const earliestStart = addMonths(latestCutoff, -(periods - 1))

  const beforeEarliest = expanded.filter((t) => t.date < earliestStart.toISOString())
  for (const t of beforeEarliest) {
    opening = t.type === 'payment' ? opening - t.amount : opening + t.amount
  }
  if (opening < 0) opening = 0

  let periodStart = earliestStart
  let periodEnd = addMonths(periodStart, 1)

  for (let i = 0; i < periods; i++) {
    const periodTxns = expanded.filter(
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

export interface CardPeriodDebtProjection {
  cutoffDate: string
  dueDate: string
  periodStartIso: string
  /** Dönem başı taşınan bakiye (gecikme faizi hariç). */
  carriedIn: number
  /** Önceki vadeden bu dönem başına gecikme faizi. */
  lateInterest: number
  /** Bu dönemde tahakkuk eden alışveriş/avans/taksit (ödeme hariç). */
  periodAccruals: number
  endingBalance: number
  minPayment: number
  /** Asgari ödeme penceresinde karşılandı mı. */
  paid: boolean
  /** Dönem sonu bakiyesinin tamamı ödendi mi. */
  paidInFull: boolean
  /** Son ödeme günü itibarıyla kalan borç (kesim sonrası ödemeler düşülmüş). */
  owedAtDue: number
  paidDate?: string
  /** Ödeme penceresindeki toplam (dönem başı → son ödeme günü); rapor/grafik için. */
  paymentsInWindow?: string
  /** Kesim sonrası — son ödeme gününe kadar yapılan ödemeler. */
  paidAfterCutoff?: string
  accrualLines: PeriodTxn[]
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = startIso.slice(0, 10)
  const end = endIso.slice(0, 10)
  if (end <= start) return 0
  return differenceInCalendarDays(new Date(`${end}T12:00:00.000Z`), new Date(`${start}T12:00:00.000Z`))
}

function sumCardPaymentsInWindow(
  cardId: string,
  transactions: CreditCardTransaction[],
  periodStartIso: string,
  dueDateIso: string,
): { sum: number; lastPaidDate?: string } {
  let sum = D(0)
  let lastPaidDate: string | undefined
  const startKey = periodStartIso.slice(0, 10)
  const dueKey = dueDateIso.slice(0, 10)
  for (const t of transactions) {
    if (t.cardId !== cardId || t.type !== 'payment') continue
    const d = t.date.slice(0, 10)
    if (d < startKey || d > dueKey) continue
    sum = sum.plus(t.amount)
    if (!lastPaidDate || t.date > lastPaidDate) lastPaidDate = t.date
  }
  return { sum: Number(roundMoney(sum)), lastPaidDate }
}

/**
 * Kart dönemlerinde taşınan borç + gecikme faizi ile asgari / ekstre projeksiyonu.
 *
 * Yalnızca **vadesi geçmiş** (`dueDate < asOf`) dönemlerin ödenmemiş bakiyesi
 * sonraki vadeye faizle yansır. Vadesi henüz gelmemiş dönemler bağımsız
 * hesaplanır; tahmini taşıma yapılmaz.
 */
export function projectCardPeriodDebts(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  options: { periods?: CardPeriod[]; periodsCount?: number; asOf?: Date } = {},
): CardPeriodDebtProjection[] {
  const asOfDate = options.asOf ?? new Date()
  const asOfKey = asOfDate.toISOString().slice(0, 10)
  const periods =
    options.periods ??
    buildCardPeriods(card, transactions, {
      periods: options.periodsCount ?? 18,
      asOf: asOfDate,
    })

  const apr = { value: card.purchaseAprMonthly, period: 'monthly' as const }
  const lateApr =
    card.lateAprMonthly != null
      ? { value: card.lateAprMonthly, period: 'monthly' as const }
      : undefined

  const out: CardPeriodDebtProjection[] = []
  let carried = D(0)
  let lastDueIso: string | undefined

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!
    const periodStartIso =
      i > 0
        ? periods[i - 1]!.cutoffDate
        : addMonths(new Date(period.cutoffDate), -1).toISOString()

    let opening = i === 0 ? D(period.openingBalance) : carried
    const carriedIn = Number(roundMoney(opening))

    let lateInterest = D(0)
    if (lastDueIso && opening.gt(0)) {
      const days = daysBetweenIso(lastDueIso, period.cutoffDate)
      if (days > 0) {
        lateInterest = D(
          creditCardLateInterest({
            unpaidBalance: opening,
            daysLate: days,
            apr,
            lateApr,
          }),
        )
        opening = opening.plus(lateInterest)
      }
    }

    const accrualLines = period.transactions.filter((t) => t.type !== 'payment')
    const periodAccruals = accrualLines.reduce((s, t) => s + t.amount, 0)

    const stmt = creditCardStatement({
      openingBalance: opening,
      transactions: period.transactions.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      limit: card.limit,
    })
    const endingBalance = Number(stmt.endingBalance)
    const minPayment = Number(stmt.minPayment)

    const payment = sumCardPaymentsInWindow(
      card.id,
      transactions,
      periodStartIso,
      period.dueDate,
    )
    /** Kesim sonrası — son ödeme gününe kadar yapılan ödemeler (ekstrede henüz yok). */
    const postCutoffPayment = sumCardPaymentsInWindow(
      card.id,
      transactions,
      period.cutoffDate,
      period.dueDate,
    )
    const owedAtDue = Math.max(
      0,
      Number(roundMoney(D(endingBalance).minus(postCutoffPayment.sum))),
    )
    const paidTowardDue = Number(roundMoney(D(endingBalance).minus(owedAtDue)))

    const paid = minPayment > 0 && payment.sum >= minPayment
    const paidInFull = endingBalance <= 0 || owedAtDue <= 0
    const dueIsPast = period.dueDate.slice(0, 10) < asOfKey

    if (dueIsPast) {
      carried = D(owedAtDue)
      lastDueIso = period.dueDate
    } else {
      carried = D(0)
      lastDueIso = undefined
    }

    const paidAmountStr =
      paidTowardDue > 0
        ? String(roundMoney(paidTowardDue))
        : undefined
    const paymentsInWindowStr =
      payment.sum > 0 ? String(roundMoney(payment.sum)) : undefined

    out.push({
      cutoffDate: period.cutoffDate,
      dueDate: period.dueDate,
      periodStartIso,
      carriedIn,
      lateInterest: Number(roundMoney(lateInterest)),
      periodAccruals,
      endingBalance,
      minPayment,
      paid,
      paidInFull,
      owedAtDue,
      paidDate: payment.sum > 0 ? payment.lastPaidDate : undefined,
      paymentsInWindow: paymentsInWindowStr,
      paidAfterCutoff: paidAmountStr,
      accrualLines,
    })
  }

  return out
}

/**
 * `asOf` itibarıyla tahakkuk etmiş taksit sayısı (1..installmentCount).
 * Taksitsiz / 1 taksitli işlemde 1 döner.
 *
 * `expandInstallments` ile aynı tarih kuralını paylaşır: i. taksit tarihi =
 * `addMonths(txnDate, i - 1)`; bu tarih asOf'tan sonra ise henüz tahakkuk
 * etmemiştir.
 */
export function accruedInstallmentCount(
  txnDate: string,
  installmentCount: number | undefined,
  asOf: Date = new Date(),
): number {
  const total = installmentCount && installmentCount > 1 ? installmentCount : 1
  if (total === 1) return 1
  const base = new Date(txnDate)
  let accrued = 0
  for (let i = 0; i < total; i++) {
    const d = new Date(base)
    d.setUTCMonth(d.getUTCMonth() + i)
    if (d.getTime() <= asOf.getTime()) accrued++
    else break
  }
  return accrued
}

/** Kartın bugünkü (en güncel kesim) dönem özetini döner. */
export function latestCardStatement(
  card: CreditCard,
  transactions: CreditCardTransaction[],
): CardPeriod | null {
  const periods = buildCardPeriods(card, transactions, { periods: 1 })
  return periods[periods.length - 1] ?? null
}

function flatBalanceAsOf(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date,
): ReturnType<typeof D> {
  const expanded = expandInstallments(card, transactions)
  const cutoffIso = asOf.toISOString()
  const sorted = expanded
    .filter((v) => v.date <= cutoffIso)
    .sort((a, b) => a.date.localeCompare(b.date))
  let balance = D(card.openingBalance ?? 0)
  for (const v of sorted) {
    if (v.type === 'payment') balance = balance.minus(v.amount)
    else balance = balance.plus(v.amount)
  }
  if (balance.lt(0)) balance = D(0)
  return balance
}

function projectedOutstandingBalance(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date,
): ReturnType<typeof D> {
  const asOfKey = asOf.toISOString().slice(0, 10)
  const periods = buildCardPeriods(card, transactions, { periods: 18, asOf })
  if (!periods.length) return D(0)

  const projections = projectCardPeriodDebts(card, transactions, { periods, asOf })
  const apr = { value: card.purchaseAprMonthly, period: 'monthly' as const }
  const lateApr =
    card.lateAprMonthly != null
      ? { value: card.lateAprMonthly, period: 'monthly' as const }
      : undefined

  let balance = D(0)

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!
    const proj = projections[i]!
    const periodStartKey = (
      i > 0
        ? periods[i - 1]!.cutoffDate
        : addMonths(new Date(period.cutoffDate), -1).toISOString()
    ).slice(0, 10)
    const cutoffKey = period.cutoffDate.slice(0, 10)
    const dueKey = period.dueDate.slice(0, 10)

    if (asOfKey < periodStartKey) break

    if (asOfKey >= periodStartKey && asOfKey < cutoffKey) {
      balance = D(proj.carriedIn)
      if (balance.gt(0) && i > 0) {
        const days = daysBetweenIso(periods[i - 1]!.dueDate, asOf.toISOString())
        if (days > 0) {
          balance = balance.plus(
            creditCardLateInterest({
              unpaidBalance: balance,
              daysLate: days,
              apr,
              lateApr,
            }),
          )
        }
      }
      for (const t of period.transactions) {
        const d = t.date.slice(0, 10)
        if (d > asOfKey) continue
        if (t.type === 'payment') balance = balance.minus(t.amount)
        else balance = balance.plus(t.amount)
      }
      break
    }

    if (asOfKey >= cutoffKey && asOfKey < dueKey) {
      balance = D(proj.endingBalance)
      for (const t of period.transactions) {
        const d = t.date.slice(0, 10)
        if (d <= cutoffKey || d > asOfKey) continue
        if (t.type === 'payment') balance = balance.minus(t.amount)
        else balance = balance.plus(t.amount)
      }
      break
    }

    if (asOfKey >= dueKey) {
      balance = D(proj.owedAtDue)
      const hasNext = i + 1 < periods.length
      if (hasNext && asOfKey >= cutoffKey) {
        continue
      }
      if (balance.gt(0)) {
        const days = daysBetweenIso(period.dueDate, asOf.toISOString())
        if (days > 0) {
          balance = balance.plus(
            creditCardLateInterest({
              unpaidBalance: balance,
              daysLate: days,
              apr,
              lateApr,
            }),
          )
        }
      }
      break
    }
  }

  if (balance.lt(0)) balance = D(0)
  return balance
}

/**
 * `asOf` anındaki güncel kart borcu (taşınan bakiye + gecikme faizi dahil).
 * `projectCardPeriodDebts` ile uyumlu; düz işlem toplamından farklı olarak geç
 * ödemede kalan borcu ve faizi yansıtır.
 */
export function cardOutstandingBalance(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date = new Date(),
): string {
  const flat = flatBalanceAsOf(card, transactions, asOf)
  const projected = projectedOutstandingBalance(card, transactions, asOf)
  const balance = flat.gt(projected) ? flat : projected
  return roundMoney(balance).toString()
}

/** Güncel (açık) dönemin projeksiyon özeti. */
export function cardCurrentPeriodProjection(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date = new Date(),
): CardPeriodDebtProjection | null {
  const periods = buildCardPeriods(card, transactions, { periods: 6, asOf })
  if (!periods.length) return null
  const projections = projectCardPeriodDebts(card, transactions, { periods, asOf })
  return projections[projections.length - 1] ?? null
}

export interface CardCommittedTotals {
  /** Bugüne kadar tahakkuk etmiş bakiye (ekstre borcu, ödeme sonrası, ≥0). */
  ending: string
  /** Henüz tahakkuk etmemiş gelecek taksit toplamı (≥0). */
  future: string
  /** Toplam yükümlülük = ending + future (kullanılabilir limit hesabında bu kullanılır). */
  committed: string
}

/**
 * Kartın **toplam yükümlülüğünü** verir: bugüne kadar tahakkuk etmiş
 * (ödemeler düşülmüş) bakiye + gelecek taksit toplamı. Türkiye'de bankalar
 * kullanılabilir limiti `limit − toplam yükümlülük` olarak hesapladığı için
 * UI bu değeri gösterir.
 */
export function cardCommittedTotal(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date = new Date(),
): CardCommittedTotals {
  const expanded = expandInstallments(card, transactions)
  const cutoffIso = asOf.toISOString()

  let futureSum = D(0)
  for (const v of expanded) {
    if (v.date > cutoffIso && v.type !== 'payment') {
      futureSum = futureSum.plus(v.amount)
    }
  }

  const ending = cardOutstandingBalance(card, transactions, asOf)
  const future = futureSum.lt(0) ? D(0) : futureSum
  const committed = D(ending).plus(future)
  return {
    ending,
    future: roundMoney(future).toString(),
    committed: roundMoney(committed).toString(),
  }
}
