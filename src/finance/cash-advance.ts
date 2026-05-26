import { differenceInCalendarDays, parseISO } from 'date-fns'
import { D, Decimal, roundMoney, ZERO, type DecimalInput } from '@/finance/decimal'
import {
  creditCardEffectiveMonthlyRate,
  creditCardMinPaymentRate,
  creditCardSimpleInterest,
  DEFAULT_MIN_PAYMENT_TIERS,
  resolveCreditCardLateApr,
  type MinPaymentTiers,
} from '@/finance/credit-card'
import { toDailyFromMonthly, toMonthly, type RateInput } from '@/finance/rates'

/**
 * Revolving (nakit avans) hareket türü.
 *
 * `draw`     → anaparayı arttırır
 * `payment`  → önce işleyen faizi öder, kalan anaparadan düşer
 */
export interface RevolvingTxn {
  /** ISO */
  date: string
  amount: DecimalInput
  type: 'draw' | 'payment'
}

export interface RevolvingRateConfig {
  /** Brüt akdi faiz */
  apr: RateInput
  /** Brüt gecikme faizi; yoksa akdi × 1.087 */
  lateApr?: RateInput
  /** KKDF+BSMV toplamı (örn. 0.25) */
  taxRateMonthly?: number
  /** Asgari ödeme tier'ı için limit */
  limit: DecimalInput
  tiers?: MinPaymentTiers
}

export interface RevolvingInput {
  openingBalance: DecimalInput
  openingDate: string
  transactions: RevolvingTxn[]
  rates: RevolvingRateConfig
  /** Hesaplama anı (ISO); varsayılan bugün */
  asOf?: string
}

export interface RevolvingState {
  /** Bugün itibarıyla anapara borcu */
  principal: string
  /** Tahakkuk eden toplam faiz (akdi + gecikme) */
  accruedInterest: string
  /** Tahakkuk eden akdi faiz */
  contractualInterest: string
  /** Tahakkuk eden gecikme faizi */
  lateInterest: string
  /** principal + accruedInterest */
  total: string
  /** Güncel dönemin asgari ödeme tutarı */
  minPayment: string
  /** Uygulanan asgari ödeme oranı */
  minPaymentRate: number
}

export interface RevolvingEffectiveRates {
  contractualMonthly: number
  lateMonthly: number
}

export interface CashAdvancePeriodProjection {
  monthKey: string
  dueDate: string
  endingBalance: number
  minPayment: number
  minPaymentRate: number
  contractualInterest: number
  lateInterest: number
  paymentsInMonth: number
  paid: boolean
  /** Ay sonu bakiyesi sıfırlandı mı */
  paidInFull: boolean
}

/** Brüt oranlardan vergi dahil efektif aylık oranları çözer. */
export function resolveRevolvingEffectiveRates(
  config: RevolvingRateConfig,
): RevolvingEffectiveRates {
  const grossContractual = toMonthly(config.apr).toNumber()
  const grossLate = config.lateApr
    ? toMonthly(config.lateApr).toNumber()
    : resolveCreditCardLateApr(grossContractual, undefined)
  const tax = config.taxRateMonthly
  return {
    contractualMonthly: creditCardEffectiveMonthlyRate(grossContractual, tax),
    lateMonthly: creditCardEffectiveMonthlyRate(grossLate, tax),
  }
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** `YYYY-MM` ayının son anı (UTC). */
export function monthEndIsoFromKey(monthKeyValue: string): string {
  const [yStr, mStr] = monthKeyValue.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString()
}

function monthKeysBetween(fromIso: string, toIso: string): string[] {
  const start = monthKey(fromIso)
  const end = monthKey(toIso)
  const out: string[] = []
  let [y, mo] = start.split('-').map(Number)
  const [ey, emo] = end.split('-').map(Number)
  while (y < ey || (y === ey && mo <= emo)) {
    out.push(`${y}-${String(mo).padStart(2, '0')}`)
    mo += 1
    if (mo > 12) {
      mo = 1
      y += 1
    }
  }
  return out
}

function sumPaymentsInMonth(
  transactions: readonly RevolvingTxn[],
  monthKeyValue: string,
): Decimal {
  let sum = ZERO
  for (const tx of transactions) {
    if (tx.type !== 'payment') continue
    if (monthKey(tx.date) !== monthKeyValue) continue
    sum = sum.plus(tx.amount)
  }
  return sum
}

function nextMonthKey(monthKeyValue: string): string {
  const [y, mo] = monthKeyValue.split('-').map(Number)
  const nextMo = mo === 12 ? 1 : mo + 1
  const nextY = mo === 12 ? y + 1 : y
  return `${nextY}-${String(nextMo).padStart(2, '0')}`
}

interface LedgerEvent {
  date: string
  order: number
  kind: 'opening' | 'txn' | 'monthEnd' | 'asOf'
  txn?: RevolvingTxn
  monthKey?: string
}

function buildEvents(
  openingDate: string,
  transactions: readonly RevolvingTxn[],
  asOfIso: string,
): LedgerEvent[] {
  const events: LedgerEvent[] = [{ date: openingDate, order: 0, kind: 'opening' }]
  let order = 1
  for (const tx of transactions) {
    events.push({ date: tx.date, order: order++, kind: 'txn', txn: tx })
  }
  for (const mk of monthKeysBetween(openingDate, asOfIso)) {
    const endIso = monthEndIsoFromKey(mk)
    if (endIso > asOfIso) continue
    events.push({
      date: endIso,
      order: order++,
      kind: 'monthEnd',
      monthKey: mk,
    })
  }
  events.push({ date: asOfIso, order: order++, kind: 'asOf' })
  return events.sort((a, b) => {
    const cmp = a.date.localeCompare(b.date)
    if (cmp !== 0) return cmp
    return a.order - b.order
  })
}

function accrueContractual(
  principal: Decimal,
  accrued: Decimal,
  contractualDaily: Decimal,
  fromIso: string,
  toIso: string,
): { principal: Decimal; accrued: Decimal; contractualAdded: Decimal } {
  const from = parseISO(fromIso)
  const to = parseISO(toIso)
  const days = differenceInCalendarDays(to, from)
  if (days <= 0 || principal.lte(0)) {
    return { principal, accrued, contractualAdded: ZERO }
  }
  const added = principal.times(contractualDaily).times(days)
  return { principal, accrued: accrued.plus(added), contractualAdded: added }
}

function applyPayment(
  principal: Decimal,
  accrued: Decimal,
  amount: Decimal,
): { principal: Decimal; accrued: Decimal } {
  let remaining = amount
  if (accrued.gt(0)) {
    const paidInterest = Decimal.min(accrued, remaining)
    accrued = accrued.minus(paidInterest)
    remaining = remaining.minus(paidInterest)
  }
  if (remaining.gt(0)) {
    principal = principal.minus(remaining)
    if (principal.lt(0)) principal = ZERO
  }
  return { principal, accrued }
}

/**
 * Kronolojik hareket listesinden bugüne kadar tahakkuk eden faiz + kalan
 * anaparayı hesaplar.
 *
 * - Akdi faiz: anapara üzerinden günlük basit (aylık / 30), vergi dahil efektif oran.
 * - Takvim ayı sonunda asgari ödeme değerlendirilir; asgari altı ödemede ödenmeyen
 *   asgari kısma gecikme faizi (vade sonrası pencerede) eklenir.
 * - Ödeme önce tahakkuk eden faizi kapatır; arta kalan anaparadan düşer.
 */
export function runRevolvingLedger(input: RevolvingInput): RevolvingState {
  const { periods, state } = simulateRevolvingLedger(input)
  void periods
  return state
}

function addMonthAmount(map: Map<string, Decimal>, monthKeyValue: string, amount: Decimal): void {
  if (amount.lte(0)) return
  map.set(monthKeyValue, (map.get(monthKeyValue) ?? ZERO).plus(amount))
}

/** Ay bazlı projeksiyon + güncel durum. */
export function simulateRevolvingLedger(input: RevolvingInput): {
  state: RevolvingState
  periods: CashAdvancePeriodProjection[]
} {
  const asOfIso = input.asOf ?? new Date().toISOString()
  const effective = resolveRevolvingEffectiveRates(input.rates)
  const contractualDaily = toDailyFromMonthly(effective.contractualMonthly)
  const tiers = input.rates.tiers ?? DEFAULT_MIN_PAYMENT_TIERS

  const sorted = [...input.transactions].sort((a, b) => a.date.localeCompare(b.date))
  const events = buildEvents(input.openingDate, sorted, asOfIso)

  let principal = D(input.openingBalance)
  let accrued = ZERO
  let contractualTotal = ZERO
  let lateTotal = ZERO
  let lastDate = input.openingDate
  let currentMinPayment = ZERO
  let currentMinPaymentRate = creditCardMinPaymentRate(input.rates.limit, tiers)

  const periods: CashAdvancePeriodProjection[] = []
  const asOfKey = monthKey(asOfIso)
  const periodContractualByMonth = new Map<string, Decimal>()
  const periodLateByMonth = new Map<string, Decimal>()

  for (const ev of events) {
    const accrual = accrueContractual(principal, accrued, contractualDaily, lastDate, ev.date)
    principal = accrual.principal
    accrued = accrual.accrued
    contractualTotal = contractualTotal.plus(accrual.contractualAdded)
    addMonthAmount(periodContractualByMonth, monthKey(ev.date), accrual.contractualAdded)

    if (ev.kind === 'txn' && ev.txn) {
      const tx = ev.txn
      const amt = D(tx.amount)
      if (tx.type === 'draw') {
        principal = principal.plus(amt)
      } else {
        const after = applyPayment(principal, accrued, amt)
        principal = after.principal
        accrued = after.accrued
      }
    }

    if (ev.kind === 'monthEnd' && ev.monthKey) {
      const balance = principal.plus(accrued)
      const minRate = creditCardMinPaymentRate(input.rates.limit, tiers)
      const minPayment = roundMoney(balance.times(minRate))
      const paymentsInMonth = sumPaymentsInMonth(sorted, ev.monthKey)
      const duePassed = ev.date <= asOfIso

      if (ev.monthKey === asOfKey) {
        currentMinPayment = minPayment
        currentMinPaymentRate = minRate
      }

      let periodLate = ZERO
      if (duePassed && balance.gt(0) && paymentsInMonth.lt(minPayment)) {
        const unpaidMin = Decimal.min(minPayment.minus(paymentsInMonth), balance)
        const nextEnd = monthEndIsoFromKey(nextMonthKey(ev.monthKey))
        const interestEnd = nextEnd <= asOfIso ? nextEnd : asOfIso
        const days = differenceInCalendarDays(parseISO(interestEnd), parseISO(ev.date))
        if (days > 0 && unpaidMin.gt(0)) {
          periodLate = D(
            creditCardSimpleInterest({
              balance: unpaidMin,
              days,
              aprMonthly: effective.lateMonthly,
            }),
          )
          accrued = accrued.plus(periodLate)
          lateTotal = lateTotal.plus(periodLate)
          addMonthAmount(periodLateByMonth, ev.monthKey, periodLate)
        }
      }

      const endingBalance = roundMoney(principal.plus(accrued))
      periods.push({
        monthKey: ev.monthKey,
        dueDate: ev.date,
        endingBalance: Number(endingBalance),
        minPayment: Number(minPayment),
        minPaymentRate: minRate,
        contractualInterest: Number(
          roundMoney(periodContractualByMonth.get(ev.monthKey) ?? ZERO),
        ),
        lateInterest: Number(roundMoney(periodLateByMonth.get(ev.monthKey) ?? ZERO)),
        paymentsInMonth: Number(roundMoney(paymentsInMonth)),
        paid: minPayment.lte(0) || paymentsInMonth.gte(minPayment),
        paidInFull: endingBalance.lte(0),
      })
    }

    lastDate = ev.date
  }

  if (currentMinPayment.eq(0)) {
    const balance = principal.plus(accrued)
    currentMinPaymentRate = creditCardMinPaymentRate(input.rates.limit, tiers)
    currentMinPayment = roundMoney(balance.times(currentMinPaymentRate))
  }

  const finalBalance = roundMoney(principal.plus(accrued))
  const hasCurrentPeriod = periods.some((p) => p.monthKey === asOfKey)
  const paymentsInCurrentMonth = sumPaymentsInMonth(sorted, asOfKey)
  if (
    !hasCurrentPeriod &&
    (finalBalance.gt(0) || paymentsInCurrentMonth.gt(0))
  ) {
    const minRate = creditCardMinPaymentRate(input.rates.limit, tiers)
    const minPayment =
      currentMinPayment.gt(0) ? currentMinPayment : roundMoney(finalBalance.times(minRate))
    periods.push({
      monthKey: asOfKey,
      dueDate: monthEndIsoFromKey(asOfKey),
      endingBalance: Number(finalBalance),
      minPayment: Number(minPayment),
      minPaymentRate: minRate,
      contractualInterest: Number(
        roundMoney(periodContractualByMonth.get(asOfKey) ?? ZERO),
      ),
      lateInterest: Number(roundMoney(lateTotal)),
      paymentsInMonth: Number(roundMoney(paymentsInCurrentMonth)),
      paid: minPayment.lte(0) || paymentsInCurrentMonth.gte(minPayment),
      paidInFull: finalBalance.lte(0),
    })
  }

  periods.sort((a, b) => a.monthKey.localeCompare(b.monthKey))

  // Gecikme tahakkuku önceki ay sonlarında birikir; güncel ay satırına da yansıt.
  if (lateTotal.gt(0)) {
    const currentPeriodIdx = periods.findIndex((p) => p.monthKey === asOfKey)
    if (currentPeriodIdx >= 0) {
      periods[currentPeriodIdx] = {
        ...periods[currentPeriodIdx]!,
        lateInterest: Number(roundMoney(lateTotal)),
      }
    }
  }

  const state: RevolvingState = {
    principal: roundMoney(principal).toString(),
    accruedInterest: roundMoney(accrued).toString(),
    contractualInterest: roundMoney(contractualTotal).toString(),
    lateInterest: roundMoney(lateTotal).toString(),
    total: roundMoney(principal.plus(accrued)).toString(),
    minPayment: currentMinPayment.toString(),
    minPaymentRate: currentMinPaymentRate,
  }

  return { state, periods }
}
