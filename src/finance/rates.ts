import { D, type DecimalInput } from '@/finance/decimal'

/**
 * Faiz oranı birimi.
 * - `monthly`: aylık nominal faiz (örn. 0.0375 → %3.75 aylık)
 * - `annual`: yıllık nominal faiz (12 ile çevrilir)
 */
export type RatePeriod = 'monthly' | 'annual'

export interface RateInput {
  value: DecimalInput
  period: RatePeriod
}

/** Verilen oranı aylık nominal orana çevir. */
export function toMonthly(rate: RateInput): import('decimal.js').default {
  const v = D(rate.value)
  return rate.period === 'monthly' ? v : v.div(12)
}

/** Verilen oranı günlük nominal orana çevir (basit faiz için: aylık/30). */
export function toDailyFromMonthly(monthlyRate: DecimalInput, daysInMonth = 30): import('decimal.js').default {
  return D(monthlyRate).div(daysInMonth)
}

/** Yıllık nominal oranı yıllık efektife çevirir (aylık bileşik). */
export function annualEffectiveFromMonthly(monthlyRate: DecimalInput): import('decimal.js').default {
  return D(1).plus(monthlyRate).pow(12).minus(1)
}
