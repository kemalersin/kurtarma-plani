import { differenceInCalendarDays, parseISO } from 'date-fns'
import { D, Decimal, roundMoney, ZERO, type DecimalInput } from '@/finance/decimal'
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

export interface RevolvingInput {
  openingBalance: DecimalInput
  openingDate: string
  transactions: RevolvingTxn[]
  apr: RateInput
  /** Hesaplama anı (ISO); varsayılan bugün */
  asOf?: string
}

export interface RevolvingState {
  /** Bugün itibarıyla anapara borcu */
  principal: string
  /** Henüz ödenmemiş tahakkuk eden faiz */
  accruedInterest: string
  /** principal + accruedInterest */
  total: string
}

/**
 * Kronolojik hareket listesinden bugüne kadar tahakkuk eden faiz + kalan
 * anaparayı hesaplar. Faiz basit, günlük (aylık APR / 30) modelde işler;
 * her hareket arası süre kadar mevcut anapara üzerinden faiz tahakkuk eder.
 *
 * Ödeme önce tahakkuk eden faizi kapatır; arta kalan anaparadan düşer.
 * Aşırı ödeme (negatif anapara) sıfırla sınırlanır.
 */
export function runRevolvingLedger(input: RevolvingInput): RevolvingState {
  const monthly = toMonthly(input.apr)
  const daily = toDailyFromMonthly(monthly)

  const sorted = [...input.transactions].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  let principal = D(input.openingBalance)
  let accrued = ZERO
  let lastDate = parseISO(input.openingDate)

  function accrueTo(dateIso: string): void {
    const date = parseISO(dateIso)
    const days = differenceInCalendarDays(date, lastDate)
    if (days > 0 && principal.gt(0)) {
      accrued = accrued.plus(principal.times(daily).times(days))
    }
    lastDate = date
  }

  for (const tx of sorted) {
    accrueTo(tx.date)
    const amt = D(tx.amount)
    if (tx.type === 'draw') {
      principal = principal.plus(amt)
    } else {
      // Önce tahakkuk eden faizi öde, sonra anaparayı düş
      let remaining = amt
      if (accrued.gt(0)) {
        const paidInterest = Decimal.min(accrued, remaining)
        accrued = accrued.minus(paidInterest)
        remaining = remaining.minus(paidInterest)
      }
      if (remaining.gt(0)) {
        principal = principal.minus(remaining)
        if (principal.lt(0)) principal = ZERO
      }
    }
  }

  const asOfIso = input.asOf ?? new Date().toISOString()
  accrueTo(asOfIso)

  return {
    principal: roundMoney(principal).toString(),
    accruedInterest: roundMoney(accrued).toString(),
    total: roundMoney(principal.plus(accrued)).toString(),
  }
}
