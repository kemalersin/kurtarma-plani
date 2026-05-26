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

/** Dönem borcuna göre kademeli azami faiz dilimi (TCMB referans). */
export interface CreditCardBalanceTier {
  maxBalance: number | null
  purchaseAprMonthly: number
  lateAprMonthly: number
}

export type CreditCardRateMode = 'fixed' | 'balanceTier'

/** Dönem borcuna göre uygun faiz kademesini seçer. */
export function pickCreditCardBalanceTier<T extends CreditCardBalanceTier>(
  tiers: readonly T[],
  balance: DecimalInput,
): T {
  const bal = D(balance)
  for (const t of tiers) {
    if (t.maxBalance == null || bal.lte(t.maxBalance)) return t
  }
  return tiers[tiers.length - 1]!
}

export interface CreditCardRateSource {
  purchaseAprMonthly: number
  lateAprMonthly?: number
  cashAdvanceAprMonthly?: number
  cashAdvanceLateAprMonthly?: number
  taxRateMonthly?: number
  rateMode?: CreditCardRateMode
}

export interface ResolvedCreditCardRates {
  /** Vergi dahil efektif aylık alışveriş faizi */
  purchaseAprMonthly: number
  /** Vergi dahil efektif aylık gecikme faizi */
  lateAprMonthly: number
  /** Vergi dahil efektif aylık nakit avans faizi */
  cashAdvanceAprMonthly: number
  /** Vergi dahil efektif aylık nakit avans gecikme faizi */
  cashAdvanceLateAprMonthly: number
}

/** Brüt aylık orana KKDF+BSMV gibi vergi yükünü ekler. */
export function creditCardEffectiveMonthlyRate(
  grossAprMonthly: number,
  taxRateMonthly?: number,
): number {
  const tax = taxRateMonthly ?? 0
  if (tax <= 0) return grossAprMonthly
  return D(grossAprMonthly).times(D(1).plus(tax)).toNumber()
}

/** Gecikme oranı yoksa alışveriş × 1.087 (≈ +0,30 puan). */
export function resolveCreditCardLateApr(
  purchaseAprMonthly: number,
  lateAprMonthly?: number,
): number {
  if (lateAprMonthly != null) return lateAprMonthly
  return D(purchaseAprMonthly).times('1.087').toNumber()
}

/**
 * Kartın efektif faiz oranlarını çözer.
 * `rateMode: balanceTier` ise brüt oranlar dönem borcuna göre preset kademesinden alınır;
 * kart alanları yalnızca `fixed` modda doğrudan kullanılır.
 */
export function resolveCreditCardRates(params: {
  card: CreditCardRateSource
  periodDebt: DecimalInput
  tiers?: readonly CreditCardBalanceTier[]
  presetCashAdvanceApr?: number
  presetCashAdvanceLateApr?: number
}): ResolvedCreditCardRates {
  const { card, periodDebt, tiers, presetCashAdvanceApr, presetCashAdvanceLateApr } = params
  const mode = card.rateMode ?? 'fixed'
  const tax = card.taxRateMonthly

  let purchaseGross = card.purchaseAprMonthly
  let lateGross = card.lateAprMonthly
  let cashGross =
    card.cashAdvanceAprMonthly ?? presetCashAdvanceApr ?? card.purchaseAprMonthly
  let cashLateGross =
    card.cashAdvanceLateAprMonthly ??
    presetCashAdvanceLateApr ??
    resolveCreditCardLateApr(cashGross, undefined)

  if (mode === 'balanceTier' && tiers?.length) {
    const tier = pickCreditCardBalanceTier(tiers, periodDebt)
    purchaseGross = tier.purchaseAprMonthly
    lateGross = tier.lateAprMonthly
    cashGross = presetCashAdvanceApr ?? tier.purchaseAprMonthly
    cashLateGross =
      presetCashAdvanceLateApr ??
      presetCashAdvanceApr ??
      tier.lateAprMonthly
  } else {
    lateGross = resolveCreditCardLateApr(purchaseGross, lateGross)
    cashLateGross = resolveCreditCardLateApr(
      cashGross,
      card.cashAdvanceLateAprMonthly ?? presetCashAdvanceLateApr,
    )
  }

  return {
    purchaseAprMonthly: creditCardEffectiveMonthlyRate(purchaseGross, tax),
    lateAprMonthly: creditCardEffectiveMonthlyRate(lateGross ?? purchaseGross, tax),
    cashAdvanceAprMonthly: creditCardEffectiveMonthlyRate(cashGross, tax),
    cashAdvanceLateAprMonthly: creditCardEffectiveMonthlyRate(cashLateGross, tax),
  }
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
 */
export function resolveCreditCardRepaymentTotal(
  txn: CreditCardRepaymentTxn,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _card: { purchaseAprMonthly: number; cashAdvanceAprMonthly?: number },
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
 * Faiz hesabı **bu fonksiyonun dışındadır** — vade sonrası akdi/gecikme faizi
 * `creditCardInterPeriodCharges` ile hesaplanır.
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
 * Belirli gün sayısı için basit günlük faiz (aylık nominal / 30).
 * `aprMonthly` vergi dahil efektif oran olabilir.
 */
export function creditCardSimpleInterest(params: {
  balance: DecimalInput
  days: number
  aprMonthly: number
}): string {
  const { balance, days, aprMonthly } = params
  if (days <= 0 || D(balance).lte(0) || aprMonthly <= 0) return '0'
  const daily = toDailyFromMonthly(aprMonthly)
  return roundMoney(D(balance).times(daily).times(days)).toString()
}

export interface CreditCardInterPeriodChargesInput {
  /** Son ödeme günü itibarıyla kalan toplam borç */
  owedAtDue: DecimalInput
  /** Ekstre asgari tutarı */
  minPayment: DecimalInput
  /** Son ödeme gününe kadar ekstre borcuna yapılan toplam ödeme */
  paidTowardDue: DecimalInput
  /** Son ödeme tarihinden kesime kadar geçen gün */
  daysFromDue: number
  /** Alışveriş bakiyesi (nakit avans hariç) */
  purchaseBalance: DecimalInput
  /** Nakit avans bakiyesi */
  cashAdvanceBalance: DecimalInput
  purchaseAprMonthly: number
  lateAprMonthly: number
  cashAdvanceAprMonthly: number
}

export interface CreditCardInterPeriodCharges {
  lateInterest: string
  purchaseInterest: string
  cashAdvanceInterest: string
  total: string
}

/**
 * Vade ile bir sonraki kesim arasında tahakkuk eden faizler.
 *
 * - Asgari ödendiyse gecikme faizi yok; kalan bakiyeye akdi faiz (alışveriş /
 *   nakit avans ayrı oranlarla).
 * - Asgari altı ödemede ödenmeyen asgari kısma gecikme faizi; tüm kalan bakiyeye
 *   akdi faiz devam eder.
 */
export function creditCardInterPeriodCharges(
  input: CreditCardInterPeriodChargesInput,
): CreditCardInterPeriodCharges {
  const {
    owedAtDue,
    minPayment,
    paidTowardDue,
    daysFromDue,
    purchaseBalance,
    cashAdvanceBalance,
    purchaseAprMonthly,
    lateAprMonthly,
    cashAdvanceAprMonthly,
  } = input

  if (daysFromDue <= 0 || D(owedAtDue).lte(0)) {
    return {
      lateInterest: '0',
      purchaseInterest: '0',
      cashAdvanceInterest: '0',
      total: '0',
    }
  }

  const owed = D(owedAtDue)
  const paid = D(paidTowardDue)
  const min = D(minPayment)

  let lateInterest = ZERO
  if (paid.lt(min)) {
    const unpaidMin = min.minus(paid)
    const lateBase = owed.lt(unpaidMin) ? owed : unpaidMin
    lateInterest = D(
      creditCardSimpleInterest({
        balance: lateBase,
        days: daysFromDue,
        aprMonthly: lateAprMonthly,
      }),
    )
  }

  const purchaseInterest = D(
    creditCardSimpleInterest({
      balance: purchaseBalance,
      days: daysFromDue,
      aprMonthly: purchaseAprMonthly,
    }),
  )
  const cashAdvanceInterest = D(
    creditCardSimpleInterest({
      balance: cashAdvanceBalance,
      days: daysFromDue,
      aprMonthly: cashAdvanceAprMonthly,
    }),
  )

  const total = roundMoney(lateInterest.plus(purchaseInterest).plus(cashAdvanceInterest))
  return {
    lateInterest: roundMoney(lateInterest).toString(),
    purchaseInterest: roundMoney(purchaseInterest).toString(),
    cashAdvanceInterest: roundMoney(cashAdvanceInterest).toString(),
    total: total.toString(),
  }
}

/**
 * Ödeme tutarını önce alışveriş, sonra nakit avans bakiyesinden düşer.
 */
export function allocateCreditCardPayment(
  payment: DecimalInput,
  purchaseBalance: DecimalInput,
  cashAdvanceBalance: DecimalInput,
): { purchase: string; cashAdvance: string } {
  let remaining = D(payment)
  let purchase = D(purchaseBalance)
  let cash = D(cashAdvanceBalance)

  if (remaining.lte(0)) {
    return {
      purchase: roundMoney(purchase).toString(),
      cashAdvance: roundMoney(cash).toString(),
    }
  }

  if (purchase.gt(0)) {
    const fromPurchase = remaining.lt(purchase) ? remaining : purchase
    purchase = purchase.minus(fromPurchase)
    remaining = remaining.minus(fromPurchase)
  }
  if (remaining.gt(0) && cash.gt(0)) {
    const fromCash = remaining.lt(cash) ? remaining : cash
    cash = cash.minus(fromCash)
  }

  if (purchase.lt(0)) purchase = ZERO
  if (cash.lt(0)) cash = ZERO

  return {
    purchase: roundMoney(purchase).toString(),
    cashAdvance: roundMoney(cash).toString(),
  }
}

/**
 * @deprecated `creditCardInterPeriodCharges` veya `creditCardSimpleInterest` kullanın.
 * Geriye uyum: tüm bakiyeye gecikme faizi (asgari kuralı yok).
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
  return creditCardSimpleInterest({
    balance: unpaidBalance,
    days: daysLate,
    aprMonthly: monthly.toNumber(),
  })
}
