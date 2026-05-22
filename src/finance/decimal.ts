import Decimal from 'decimal.js'

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -9,
  toExpPos: 21,
})

export type DecimalInput = Decimal.Value

export const D = (value: DecimalInput): Decimal => new Decimal(value)

export const ZERO = D(0)
export const ONE = D(1)

/** İki para tutarı eşit kabul edilebilir mi? (kuruş hassasiyeti) */
export function moneyEquals(a: DecimalInput, b: DecimalInput, epsilon: DecimalInput = '0.005'): boolean {
  return D(a).minus(b).abs().lte(epsilon)
}

/** Kuruş hassasiyetine yuvarla (varsayılan 2 ondalık). */
export function roundMoney(value: DecimalInput, dp = 2): Decimal {
  return D(value).toDecimalPlaces(dp, Decimal.ROUND_HALF_EVEN)
}

export { Decimal }
