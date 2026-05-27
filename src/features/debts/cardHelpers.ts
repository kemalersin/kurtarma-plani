import { addMonths, setDate, isAfter, differenceInCalendarDays } from 'date-fns'
import type {
  CreditCard,
  CreditCardTransaction,
  CreditCardTxnType,
} from '@/core/types/entities'
import {
  allocateCreditCardPayment,
  creditCardInterPeriodCharges,
  creditCardStatement,
  resolveCreditCardRates,
  resolveCreditCardRepaymentTotal,
  splitInstallmentAmount,
  type CardStatement,
  type CreditCardBalanceTier,
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

/** AI bağlam / export için açılış tarihi (kayıtta yoksa createdAt). */
export function creditCardOpeningDate(card: Pick<CreditCard, 'openingDate' | 'createdAt'>): string {
  return card.openingDate ?? card.createdAt
}

function expandedFromOpeningDate(
  card: CreditCard,
  transactions: CreditCardTransaction[],
): PeriodTxn[] {
  const sorted = expandInstallments(card, transactions).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const openingKey = creditCardOpeningDate(card).slice(0, 10)
  if (!card.openingDate) return sorted
  return sorted.filter((t) => t.date.slice(0, 10) >= openingKey)
}

function isOnOrAfterCreditCardOpening(card: CreditCard, dateIso: string): boolean {
  if (!card.openingDate) return true
  return dateIso.slice(0, 10) >= card.openingDate.slice(0, 10)
}

function balanceBeforePeriodStart(
  card: CreditCard,
  expanded: PeriodTxn[],
  periodStart: Date,
): number {
  const startKey = periodStart.toISOString().slice(0, 10)
  if (card.openingDate) {
    const openingKey = card.openingDate.slice(0, 10)
    if (startKey < openingKey) return 0
  }
  let balance = card.openingBalance ?? 0
  for (const t of expanded) {
    const d = t.date.slice(0, 10)
    if (d >= startKey) break
    balance = t.type === 'payment' ? balance - t.amount : balance + t.amount
  }
  return balance < 0 ? 0 : balance
}

const MAX_CARD_PERIODS = 120

/** İşlem tarihinin düştüğü hesap kesim günü (dönem sonu). */
function statementCutoffForDate(card: CreditCard, dateIso: string): Date {
  const d = new Date(dateIso)
  let cutoff = safeDayInMonth(d, card.statementCutoffDay)
  if (!isAfter(cutoff, d)) {
    cutoff = addMonths(cutoff, 1)
  }
  return cutoff
}

/** Hesap özeti drawer varsayılan dönemi: açık dönemde bir önceki (kapalı) ekstre. */
export function defaultCardStatementPeriodCutoff(
  periods: CardPeriod[],
  asOf: Date = new Date(),
): string | undefined {
  if (!periods.length) return undefined
  const asOfKey = asOf.toISOString().slice(0, 10)
  const openIndex = periods.findIndex((p) => p.cutoffDate.slice(0, 10) > asOfKey)
  if (openIndex >= 0) {
    if (openIndex > 0) {
      return periods[openIndex - 1]!.cutoffDate
    }
    return periods[openIndex]!.cutoffDate
  }
  return periods[periods.length - 1]!.cutoffDate
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
  options: {
    periods?: number
    asOf?: Date
    /** Gelecek taksit tahakkukları için ek dönemler üret (hesap özeti). */
    extendForFutureInstallments?: boolean
  } = {},
): CardPeriod[] {
  const { periods: minPeriods = 6, asOf = new Date(), extendForFutureInstallments = false } =
    options
  const expanded = expandedFromOpeningDate(card, transactions)

  /** asOf'a göre en son tamamlanmış / devam eden dönemin başlangıç kesimi */
  let anchorCutoff = safeDayInMonth(asOf, card.statementCutoffDay)
  if (isAfter(anchorCutoff, asOf)) {
    anchorCutoff = addMonths(anchorCutoff, -1)
  }

  let maxCutoff = anchorCutoff
  if (extendForFutureInstallments) {
    for (const t of expanded) {
      const cutoff = statementCutoffForDate(card, t.date)
      if (cutoff.getTime() > maxCutoff.getTime()) {
        maxCutoff = cutoff
      }
    }
  }

  const result: CardPeriod[] = []

  const earliestStart = addMonths(anchorCutoff, -(minPeriods - 1))

  let periodStart = earliestStart
  let periodEnd = addMonths(periodStart, 1)

  while (
    (result.length < minPeriods || periodEnd.getTime() <= maxCutoff.getTime()) &&
    result.length < MAX_CARD_PERIODS
  ) {
    const opening = balanceBeforePeriodStart(card, expanded, periodStart)
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

    periodStart = periodEnd
    periodEnd = addMonths(periodEnd, 1)
  }

  return result
}

export interface CardPeriodBounds {
  periodStartIso: string
  periodEndExclusiveIso: string
}

/** Dönem aralığı: [periodStart, periodEndExclusive) — `buildCardPeriods` ile uyumlu. */
export function cardPeriodBounds(
  period: Pick<CardPeriod, 'cutoffDate'>,
): CardPeriodBounds {
  const periodEnd = new Date(period.cutoffDate)
  const periodStart = addMonths(periodEnd, -1)
  return {
    periodStartIso: periodStart.toISOString(),
    periodEndExclusiveIso: period.cutoffDate,
  }
}

export function isCardTxnDateInPeriod(dateIso: string, bounds: CardPeriodBounds): boolean {
  const d = dateIso.slice(0, 10)
  const start = bounds.periodStartIso.slice(0, 10)
  const end = bounds.periodEndExclusiveIso.slice(0, 10)
  return d >= start && d < end
}

/** Bugün veya geçmiş dönemlerde en az bir seçilebilir tarih var mı (gelecek dönemler hariç). */
export function cardPeriodHasSelectableDates(
  bounds: CardPeriodBounds,
  asOf: Date = new Date(),
): boolean {
  const start = bounds.periodStartIso.slice(0, 10)
  const end = bounds.periodEndExclusiveIso.slice(0, 10)
  const today = asOf.toISOString().slice(0, 10)
  if (start >= end) return false
  if (today < start) return false
  return true
}

/** Yeni hareket varsayılan tarihi: bugün dönemdeyse bugün, değilse dönemin son günü. */
export function defaultCardTxnDateInPeriod(
  bounds: CardPeriodBounds,
  asOf: Date = new Date(),
): string {
  const start = bounds.periodStartIso.slice(0, 10)
  const end = bounds.periodEndExclusiveIso.slice(0, 10)
  const today = asOf.toISOString().slice(0, 10)
  if (today >= start && today < end) {
    return asOf.toISOString()
  }
  const endDate = new Date(end + 'T00:00:00.000Z')
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  endDate.setUTCHours(12, 0, 0, 0)
  return endDate.toISOString()
}

export interface CardPeriodDebtProjection {
  cutoffDate: string
  dueDate: string
  periodStartIso: string
  /** Dönem başı taşınan bakiye (vade sonrası faiz hariç). */
  carriedIn: number
  /** Önceki vadeden bu dönem başına gecikme faizi. */
  lateInterest: number
  /** Önceki vadeden bu dönem başına alışveriş (akdi) faizi. */
  purchaseInterest: number
  /** Önceki vadeden bu dönem başına nakit avans faizi. */
  cashAdvanceInterest: number
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
  /** Vade anında kalan alışveriş bakiyesi (faiz tahakkuku için). */
  owedPurchaseAtDue: number
  /** Vade anında kalan nakit avans bakiyesi (faiz tahakkuku için). */
  owedCashAdvanceAtDue: number
  paidDate?: string
  /** Ödeme penceresindeki toplam (dönem başı → son ödeme günü); rapor/grafik için. */
  paymentsInWindow?: string
  /** Kesim sonrası — son ödeme gününe kadar yapılan ödemeler. */
  paidAfterCutoff?: string
  accrualLines: PeriodTxn[]
}

export interface CardProjectionRateContext {
  balanceTiers?: readonly CreditCardBalanceTier[]
  presetCashAdvanceApr?: number
  presetCashAdvanceLateApr?: number
}

interface BalanceSplit {
  purchase: ReturnType<typeof D>
  cashAdvance: ReturnType<typeof D>
}

function totalSplit(split: BalanceSplit): ReturnType<typeof D> {
  const t = split.purchase.plus(split.cashAdvance)
  return t.lt(0) ? D(0) : t
}

/** Ödeme sonrası borç dağılımını orantılı küçültür (alışveriş öncelikli tahsis sonrası). */
function applyPaymentToSplit(split: BalanceSplit, payment: number): BalanceSplit {
  const allocated = allocateCreditCardPayment(
    payment,
    split.purchase,
    split.cashAdvance,
  )
  return {
    purchase: D(allocated.purchase),
    cashAdvance: D(allocated.cashAdvance),
  }
}

function processPeriodTransactions(
  split: BalanceSplit,
  transactions: PeriodTxn[],
): BalanceSplit {
  let purchase = split.purchase
  let cash = split.cashAdvance
  for (const t of transactions) {
    if (t.type === 'payment') {
      const next = applyPaymentToSplit({ purchase, cashAdvance: cash }, t.amount)
      purchase = next.purchase
      cash = next.cashAdvance
    } else if (t.type === 'cashAdvance') {
      cash = cash.plus(t.amount)
    } else {
      purchase = purchase.plus(t.amount)
    }
  }
  return { purchase, cashAdvance: cash }
}

/**
 * Kesim sonrası ödemeler bir sonraki dönemin `transactions` listesine düşer;
 * taşıma zincirinde bir önceki vadede zaten düşüldükleri için projeksiyonda
 * tekrar sayılmaz.
 */
function periodTxnsForProjection(
  period: CardPeriod,
  periodIndex: number,
  periods: CardPeriod[],
): PeriodTxn[] {
  if (periodIndex === 0) return period.transactions
  const prev = periods[periodIndex - 1]!
  const prevCutoffKey = prev.cutoffDate.slice(0, 10)
  const prevDueKey = prev.dueDate.slice(0, 10)
  return period.transactions.filter((t) => {
    if (t.type !== 'payment') return true
    const d = t.date.slice(0, 10)
    return !(d > prevCutoffKey && d <= prevDueKey)
  })
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = startIso.slice(0, 10)
  const end = endIso.slice(0, 10)
  if (end <= start) return 0
  return differenceInCalendarDays(new Date(`${end}T12:00:00.000Z`), new Date(`${start}T12:00:00.000Z`))
}

function sumCardPaymentsInWindow(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  periodStartIso: string,
  dueDateIso: string,
): { sum: number; lastPaidDate?: string } {
  let sum = D(0)
  let lastPaidDate: string | undefined
  const startKey = periodStartIso.slice(0, 10)
  const dueKey = dueDateIso.slice(0, 10)
  for (const t of transactions) {
    if (t.cardId !== card.id || t.type !== 'payment') continue
    const d = t.date.slice(0, 10)
    if (!isOnOrAfterCreditCardOpening(card, t.date)) continue
    if (d < startKey || d > dueKey) continue
    sum = sum.plus(t.amount)
    if (!lastPaidDate || t.date > lastPaidDate) lastPaidDate = t.date
  }
  return { sum: Number(roundMoney(sum)), lastPaidDate }
}

/** Döneme özgü ödemeler — kesim sonrası ödeme yalnızca ilgili ekstre dönemine yazılır. */
function sumPeriodPayments(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  periods: CardPeriod[],
  periodIndex: number,
): { sum: number; lastPaidDate?: string } {
  const period = periods[periodIndex]!
  const periodStartIso =
    periodIndex > 0
      ? periods[periodIndex - 1]!.cutoffDate
      : addMonths(new Date(period.cutoffDate), -1).toISOString()
  const startKey = periodStartIso.slice(0, 10)
  const cutoffKey = period.cutoffDate.slice(0, 10)
  const dueKey = period.dueDate.slice(0, 10)
  const prev = periodIndex > 0 ? periods[periodIndex - 1] : undefined
  const prevCutoffKey = prev?.cutoffDate.slice(0, 10)
  const prevDueKey = prev?.dueDate.slice(0, 10)

  let sum = D(0)
  let lastPaidDate: string | undefined
  for (const t of transactions) {
    if (t.cardId !== card.id || t.type !== 'payment') continue
    if (!isOnOrAfterCreditCardOpening(card, t.date)) continue
    const d = t.date.slice(0, 10)

    if (d >= cutoffKey && d <= dueKey) {
      sum = sum.plus(t.amount)
      if (!lastPaidDate || t.date > lastPaidDate) lastPaidDate = t.date
      continue
    }

    if (d >= startKey && d < cutoffKey) {
      if (prevCutoffKey && prevDueKey && d >= prevCutoffKey && d <= prevDueKey) {
        continue
      }
      sum = sum.plus(t.amount)
      if (!lastPaidDate || t.date > lastPaidDate) lastPaidDate = t.date
    }
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
  options: {
    periods?: CardPeriod[]
    periodsCount?: number
    asOf?: Date
  } & CardProjectionRateContext = {},
): CardPeriodDebtProjection[] {
  const asOfDate = options.asOf ?? new Date()
  const asOfKey = asOfDate.toISOString().slice(0, 10)
  const periods =
    options.periods ??
    buildCardPeriods(card, transactions, {
      periods: options.periodsCount ?? 18,
      asOf: asOfDate,
    })

  const out: CardPeriodDebtProjection[] = []
  let carry: BalanceSplit = {
    purchase: D(
      card.openingDate ? (periods[0]?.openingBalance ?? 0) : (card.openingBalance ?? 0),
    ),
    cashAdvance: D(0),
  }
  let appliedOpeningBalance =
    card.openingDate != null && (periods[0]?.openingBalance ?? 0) > 0
  let pendingInterPeriod: ReturnType<typeof creditCardInterPeriodCharges> | null = null

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!
    const periodStartIso =
      i > 0
        ? periods[i - 1]!.cutoffDate
        : addMonths(new Date(period.cutoffDate), -1).toISOString()

    let lateInterest = D(0)
    let purchaseInterest = D(0)
    let cashAdvanceInterest = D(0)

    if (pendingInterPeriod) {
      lateInterest = D(pendingInterPeriod.lateInterest)
      purchaseInterest = D(pendingInterPeriod.purchaseInterest)
      cashAdvanceInterest = D(pendingInterPeriod.cashAdvanceInterest)
      carry = {
        purchase: carry.purchase.plus(lateInterest).plus(purchaseInterest),
        cashAdvance: carry.cashAdvance.plus(cashAdvanceInterest),
      }
      pendingInterPeriod = null
    } else if (
      card.openingDate &&
      !appliedOpeningBalance &&
      period.openingBalance > 0 &&
      Number(roundMoney(totalSplit(carry))) === 0 &&
      periodStartIso.slice(0, 10) >= card.openingDate.slice(0, 10)
    ) {
      carry = {
        purchase: D(period.openingBalance),
        cashAdvance: D(0),
      }
      appliedOpeningBalance = true
    }

    const carriedIn = Number(roundMoney(totalSplit(carry)))

    const projectionTxns = periodTxnsForProjection(period, i, periods)
    const afterTx = processPeriodTransactions(carry, projectionTxns)
    const endingBalance = Number(roundMoney(totalSplit(afterTx)))

    const stmt = creditCardStatement({
      openingBalance: carriedIn,
      transactions: projectionTxns.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      limit: card.limit,
    })
    const minPayment = Number(stmt.minPayment)

    const payment = sumPeriodPayments(card, transactions, periods, i)
    const postCutoffPayment = sumCardPaymentsInWindow(
      card,
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

    const accrualLines = projectionTxns.filter((t) => t.type !== 'payment')
    const periodAccruals = accrualLines.reduce((s, t) => s + t.amount, 0)

    const dueSplit = applyPaymentToSplit(afterTx, postCutoffPayment.sum)

    if (dueIsPast && owedAtDue > 0) {
      const rates = resolveCreditCardRates({
        card,
        periodDebt: endingBalance,
        tiers: options.balanceTiers,
        presetCashAdvanceApr: options.presetCashAdvanceApr,
        presetCashAdvanceLateApr: options.presetCashAdvanceLateApr,
      })
      const interestEndIso =
        i + 1 < periods.length
          ? periods[i + 1]!.cutoffDate
          : addMonths(new Date(period.cutoffDate), 1).toISOString()
      const days = daysBetweenIso(period.dueDate, interestEndIso)
      pendingInterPeriod = creditCardInterPeriodCharges({
        owedAtDue,
        minPayment,
        paidTowardDue,
        daysFromDue: days,
        purchaseBalance: dueSplit.purchase,
        cashAdvanceBalance: dueSplit.cashAdvance,
        purchaseAprMonthly: rates.purchaseAprMonthly,
        lateAprMonthly: rates.lateAprMonthly,
        cashAdvanceAprMonthly: rates.cashAdvanceAprMonthly,
      })
      carry = dueSplit
    } else if (dueIsPast && owedAtDue <= 0) {
      carry = { purchase: D(0), cashAdvance: D(0) }
      pendingInterPeriod = null
    } else {
      carry = { purchase: D(0), cashAdvance: D(0) }
      pendingInterPeriod = null
    }

    const paidAmountStr =
      paidTowardDue > 0 ? String(roundMoney(paidTowardDue)) : undefined
    const paymentsInWindowStr =
      payment.sum > 0 ? String(roundMoney(payment.sum)) : undefined

    out.push({
      cutoffDate: period.cutoffDate,
      dueDate: period.dueDate,
      periodStartIso,
      carriedIn,
      lateInterest: Number(roundMoney(lateInterest)),
      purchaseInterest: Number(roundMoney(purchaseInterest)),
      cashAdvanceInterest: Number(roundMoney(cashAdvanceInterest)),
      periodAccruals,
      endingBalance,
      minPayment,
      paid,
      paidInFull,
      owedAtDue,
      owedPurchaseAtDue: owedAtDue > 0 ? Number(roundMoney(dueSplit.purchase)) : 0,
      owedCashAdvanceAtDue: owedAtDue > 0 ? Number(roundMoney(dueSplit.cashAdvance)) : 0,
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
  const openingKey = card.openingDate?.slice(0, 10)
  const asOfKey = asOf.toISOString().slice(0, 10)
  const expanded = expandedFromOpeningDate(card, transactions)
  if (openingKey && asOfKey < openingKey) {
    return D(0)
  }
  let balance = D(card.openingBalance ?? 0)
  for (const v of expanded) {
    if (v.date.slice(0, 10) > asOfKey) break
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
  rateContext: CardProjectionRateContext = {},
): ReturnType<typeof D> {
  const asOfKey = asOf.toISOString().slice(0, 10)
  const periods = buildCardPeriods(card, transactions, { periods: 18, asOf })
  if (!periods.length) return D(0)

  const projections = projectCardPeriodDebts(card, transactions, { periods, asOf, ...rateContext })

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
      const nextPeriod = periods[i + 1]
      if (nextPeriod && asOfKey >= nextPeriod.cutoffDate.slice(0, 10)) {
        continue
      }
      balance = D(proj.owedAtDue)
      if (balance.gt(0)) {
        const days = daysBetweenIso(period.dueDate, asOf.toISOString())
        if (days > 0) {
          const rates = resolveCreditCardRates({
            card,
            periodDebt: proj.endingBalance,
            tiers: rateContext.balanceTiers,
            presetCashAdvanceApr: rateContext.presetCashAdvanceApr,
            presetCashAdvanceLateApr: rateContext.presetCashAdvanceLateApr,
          })
          const charges = creditCardInterPeriodCharges({
            owedAtDue: proj.owedAtDue,
            minPayment: proj.minPayment,
            paidTowardDue: Math.max(0, proj.endingBalance - proj.owedAtDue),
            daysFromDue: days,
            purchaseBalance: proj.owedPurchaseAtDue,
            cashAdvanceBalance: proj.owedCashAdvanceAtDue,
            purchaseAprMonthly: rates.purchaseAprMonthly,
            lateAprMonthly: rates.lateAprMonthly,
            cashAdvanceAprMonthly: rates.cashAdvanceAprMonthly,
          })
          balance = balance.plus(charges.total)
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
  rateContext: CardProjectionRateContext = {},
): string {
  const flat = flatBalanceAsOf(card, transactions, asOf)
  const projected = projectedOutstandingBalance(card, transactions, asOf, rateContext)
  const balance = flat.gt(projected) ? flat : projected
  return roundMoney(balance).toString()
}

/** Güncel (açık) dönemin projeksiyon özeti. */
export function cardCurrentPeriodProjection(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  asOf: Date = new Date(),
  rateContext: CardProjectionRateContext = {},
): CardPeriodDebtProjection | null {
  const periods = buildCardPeriods(card, transactions, { periods: 6, asOf })
  if (!periods.length) return null
  const projections = projectCardPeriodDebts(card, transactions, { periods, asOf, ...rateContext })
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
  rateContext: CardProjectionRateContext = {},
): CardCommittedTotals {
  const expanded = expandedFromOpeningDate(card, transactions)
  const cutoffIso = asOf.toISOString()

  let futureSum = D(0)
  for (const v of expanded) {
    if (v.date > cutoffIso && v.type !== 'payment') {
      futureSum = futureSum.plus(v.amount)
    }
  }

  const ending = cardOutstandingBalance(card, transactions, asOf, rateContext)
  const future = futureSum.lt(0) ? D(0) : futureSum
  const committed = D(ending).plus(future)
  return {
    ending,
    future: roundMoney(future).toString(),
    committed: roundMoney(committed).toString(),
  }
}
