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

/**
 * Bir toplam tutarı eşit taksitlere böler. Yuvarlama farkı **son taksite**
 * yansır; toplam korunur (Σ tᵢ = total). `count <= 1` ise tek elemanlı
 * dizi (tutar değişmez).
 */
export function splitInstallmentAmount(
  total: DecimalInput,
  count: number,
): string[] {
  if (!Number.isFinite(count) || count < 1) {
    throw new Error('splitInstallmentAmount: count en az 1 olmalı.')
  }
  if (count === 1) return [roundMoney(total).toString()]
  const totalD = D(total)
  const per = roundMoney(totalD.div(count))
  const out: string[] = []
  let acc = D(0)
  for (let i = 0; i < count - 1; i++) {
    out.push(per.toString())
    acc = acc.plus(per)
  }
  const last = roundMoney(totalD.minus(acc))
  out.push(last.toString())
  return out
}

/**
 * Taksitli kart işleminin toplam geri ödeme tutarı (faiz dahil, anüite).
 * Aylık oran 0 ise anapara döner.
 */
export function creditCardInstallmentRepaymentTotal(params: {
  principal: DecimalInput
  installmentCount: number
  aprMonthly: number
}): string {
  const { principal, installmentCount, aprMonthly } = params
  if (installmentCount <= 1) return roundMoney(principal).toString()
  const r = D(aprMonthly)
  if (r.lte(0)) return roundMoney(principal).toString()
  const n = installmentCount
  const onePlusI = D(1).plus(r)
  const pow = onePlusI.pow(n)
  const installment = D(principal).times(r).times(pow).div(pow.minus(1))
  return roundMoney(installment.times(n)).toString()
}

export interface CreditCardRepaymentTxn {
  amount: number
  type: CreditCardTxn['type']
  installmentCount?: number
  repaymentTotal?: number
}

/**
 * Kart borcuna yansıyan efektif toplam.
 *
 * Açıkça `repaymentTotal` verilmişse o kullanılır; aksi halde `amount` döner.
 * Taksit sayısından bağımsız çalışır (peşin işlemde de farklı bir geri ödenecek
 * tutar belirtilebilir, örn. gecikme/ek ücret içeren ödeme planı).
 *
 * `card` parametresi geriye uyum için tutuluyor; artık kullanılmıyor.
 */
export function resolveCreditCardRepaymentTotal(
  txn: CreditCardRepaymentTxn,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _card: { purchaseAprMonthly: number },
): number {
  if (txn.type === 'payment') return txn.amount
  if (txn.repaymentTotal != null && txn.repaymentTotal > 0) return txn.repaymentTotal
  return txn.amount
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
