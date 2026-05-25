import { describe, expect, it } from 'vitest'
import {
  creditCardMinPaymentRate,
  creditCardStatement,
  creditCardLateInterest,
  DEFAULT_MIN_PAYMENT_TIERS,
} from '@/finance/credit-card'
import { D } from '@/finance/decimal'

describe('creditCardMinPaymentRate', () => {
  it('limit < 25k → %20', () => {
    expect(creditCardMinPaymentRate(20_000)).toBe(0.2)
  })
  it('limit ≥ 25k → %40', () => {
    expect(creditCardMinPaymentRate(25_000)).toBe(0.4)
    expect(creditCardMinPaymentRate(180_000)).toBe(0.4)
  })
  it('özel tier desteği', () => {
    expect(
      creditCardMinPaymentRate(50_000, { threshold: 100_000, rateUnder: 0.1, rateOver: 0.5 }),
    ).toBe(0.1)
  })
})

describe('creditCardStatement', () => {
  it('açılış 0, sadece harcamalar', () => {
    const s = creditCardStatement({
      openingBalance: 0,
      transactions: [
        { date: '2026-02-05', amount: 1000, type: 'purchase' },
        { date: '2026-02-10', amount: 500, type: 'purchase' },
        { date: '2026-02-15', amount: 200, type: 'cashAdvance' },
      ],
      limit: 20_000,
    })
    // 1000 + 500 + 200 = 1700
    expect(D(s.endingBalance).toNumber()).toBeCloseTo(1700, 2)
    // limit < 25k → %20 → 340
    expect(s.minPaymentRate).toBe(0.2)
    expect(D(s.minPayment).toNumber()).toBeCloseTo(340, 2)
  })

  it('açılış bakiyesi + ödeme', () => {
    const s = creditCardStatement({
      openingBalance: 5000,
      transactions: [
        { date: '2026-02-05', amount: 2000, type: 'payment' },
        { date: '2026-02-10', amount: 1000, type: 'purchase' },
      ],
      limit: 50_000, // ≥25k → %40
    })
    // 5000 - 2000 + 1000 = 4000
    expect(D(s.endingBalance).toNumber()).toBeCloseTo(4000, 2)
    expect(s.minPaymentRate).toBe(0.4)
    expect(D(s.minPayment).toNumber()).toBeCloseTo(1600, 2)
  })

  it('aşırı ödeme ile bakiye negatife düşmez', () => {
    const s = creditCardStatement({
      openingBalance: 1000,
      transactions: [{ date: '2026-02-05', amount: 5000, type: 'payment' }],
      limit: 30_000,
    })
    expect(s.endingBalance).toBe('0')
    expect(s.minPayment).toBe('0')
  })
})

describe('creditCardLateInterest', () => {
  it('gecikme yok → 0', () => {
    const fee = creditCardLateInterest({
      unpaidBalance: 1000,
      daysLate: 0,
      apr: { value: 0.0375, period: 'monthly' },
    })
    expect(fee).toBe('0')
  })
  it('30 gün gecikme; özel lateApr', () => {
    const fee = creditCardLateInterest({
      unpaidBalance: 10_000,
      daysLate: 30,
      apr: { value: 0.0375, period: 'monthly' },
      lateApr: { value: 0.0405, period: 'monthly' },
    })
    // 10000 * (0.0405/30) * 30 = 405
    expect(D(fee).toNumber()).toBeCloseTo(405, 1)
  })
  it('lateApr verilmezse APR × 1.087 ≈ +0.30 puan', () => {
    const fee = creditCardLateInterest({
      unpaidBalance: 10_000,
      daysLate: 30,
      apr: { value: 0.0375, period: 'monthly' },
    })
    // monthlyLate = 0.0375 * 1.087 ≈ 0.04076
    // 10000 * 0.04076 ≈ 407.6
    expect(D(fee).toNumber()).toBeCloseTo(407.6, 0)
  })
})

describe('DEFAULT_MIN_PAYMENT_TIERS', () => {
  it('preset varsayılanları', () => {
    expect(DEFAULT_MIN_PAYMENT_TIERS.threshold).toBe(25_000)
    expect(DEFAULT_MIN_PAYMENT_TIERS.rateUnder).toBe(0.2)
    expect(DEFAULT_MIN_PAYMENT_TIERS.rateOver).toBe(0.4)
  })
})
