import { D, roundMoney, ZERO, type DecimalInput } from '@/finance/decimal'
import { toDailyFromMonthly, toMonthly, type RateInput } from '@/finance/rates'

/**
 * Türkiye'de asgari ödeme oranı kullanıcının **kart limiti** ile
 * eşik tutarın karşılaştırılmasına göre belirlenir:
 *   - limit < threshold → %20
 *   - limit ≥ threshold → %40
 *
 * Eşik 2026 için 25.000 TRY (preset üzerinden override edilebilir).
 */
export interface MinPaymentTiers {
  /** Limit eşiği (örn. 25_000). Üstü oran daha yüksektir. */
  threshold: number
  /** Eşik altı oranı (örn. 0.2). */
  rateUnder: number
  /** Eşik üstü oranı (örn. 0.4). */
  rateOver: number
}

export const DEFAULT_MIN_PAYMENT_TIERS: MinPaymentTiers = {
  threshold: 25_000,
  rateUnder: 0.2,
  rateOver: 0.4,
}

/** Limit + dönem borcuna göre asgari ödeme oranını döner. */
export function creditCardMinPaymentRate(
  limit: DecimalInput,
  tiers: MinPaymentTiers = DEFAULT_MIN_PAYMENT_TIERS,
): number {
  return D(limit).lt(tiers.threshold) ? tiers.rateUnder : tiers.rateOver
}

export interface CreditCardTxn {
  /** ISO */
  date: string
  /** Pozitif tutar (>=0); type ile yön belirlenir */
  amount: DecimalInput
  type: 'purchase' | 'payment' | 'cashAdvance'
}

export interface CardStatementInput {
  /** Önceki dönem sonundaki ödenmemiş bakiye (varsa). */
  openingBalance: DecimalInput
  /** Bu dönemin (kesim tarihi dahil) hareketleri (kronolojik). */
  transactions: CreditCardTxn[]
  /** Kart limiti — asgari ödeme tier'ı için. */
  limit: DecimalInput
  tiers?: MinPaymentTiers
}

export interface CardStatement {
  /** Dönem başı bakiye + (alımlar + nakit avanslar) − ödemeler. */
  endingBalance: string
  /** Asgari ödeme tutarı (yuvarlanmış). */
  minPayment: string
  /** Uygulanan asgari ödeme oranı (0.2 / 0.4 vb.). */
  minPaymentRate: number
}

/**
 * Bir dönemin kesim tarihindeki bakiyesini ve asgari ödemeyi hesaplar.
 * Faiz hesabı **bu fonksiyonun dışındadır** — kullanıcı ödeme yaptıkça
 * gecikme/kalan bakiye faizi `creditCardLateInterest` ile hesaplanır.
 */
export function creditCardStatement(input: CardStatementInput): CardStatement {
  let balance = D(input.openingBalance)
  for (const tx of input.transactions) {
    const amt = D(tx.amount)
    if (tx.type === 'payment') balance = balance.minus(amt)
    else balance = balance.plus(amt)
  }
  const ending = balance.lt(0) ? ZERO : balance
  const rate = creditCardMinPaymentRate(input.limit, input.tiers)
  const minPayment = roundMoney(ending.times(rate))
  return {
    endingBalance: roundMoney(ending).toString(),
    minPayment: minPayment.toString(),
    minPaymentRate: rate,
  }
}

/**
 * Asgari ödenmemiş bakiyenin belirli bir gün sonrası için gecikme faizi
 * (basit, günlük). `lateApr` verilmezse `aprMonthly × 1.087` (≈ +0.30 puan)
 * varsayılır.
 */
export function creditCardLateInterest(params: {
  unpaidBalance: DecimalInput
  daysLate: number
  apr: RateInput
  lateApr?: RateInput
}): string {
  const { unpaidBalance, daysLate, apr, lateApr } = params
  if (daysLate <= 0) return '0'
  const monthly = lateApr ? toMonthly(lateApr) : toMonthly(apr).times('1.087')
  const daily = toDailyFromMonthly(monthly)
  return roundMoney(D(unpaidBalance).times(daily).times(daysLate)).toString()
}
