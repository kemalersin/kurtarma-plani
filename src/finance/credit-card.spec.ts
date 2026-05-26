import { describe, expect, it } from 'vitest'
import {
  allocateCreditCardPayment,
  creditCardEffectiveMonthlyRate,
  creditCardInterPeriodCharges,
  creditCardMinPaymentRate,
  creditCardSimpleInterest,
  creditCardStatement,
  creditCardLateInterest,
  creditCardInstallmentRepaymentTotal,
  resolveCreditCardLateApr,
  resolveCreditCardRates,
  resolveCreditCardRepaymentTotal,
  splitInstallmentAmount,
  pickCreditCardBalanceTier,
  DEFAULT_MIN_PAYMENT_TIERS,
} from '@/finance/credit-card'
import { D } from '@/finance/decimal'

const REFERENCE_TIERS = [
  { maxBalance: 30_000, purchaseAprMonthly: 0.0325, lateAprMonthly: 0.0355 },
  { maxBalance: 180_000, purchaseAprMonthly: 0.0375, lateAprMonthly: 0.0405 },
  { maxBalance: null, purchaseAprMonthly: 0.0425, lateAprMonthly: 0.0455 },
] as const

describe('pickCreditCardBalanceTier', () => {
  it('≤30k → ilk kademe', () => {
    const t = pickCreditCardBalanceTier(REFERENCE_TIERS, 20_000)
    expect(t.purchaseAprMonthly).toBe(0.0325)
  })
  it('180k üstü → son kademe', () => {
    const t = pickCreditCardBalanceTier(REFERENCE_TIERS, 200_000)
    expect(t.purchaseAprMonthly).toBe(0.0425)
  })
})

describe('creditCardEffectiveMonthlyRate', () => {
  it('vergi yok → aynı oran', () => {
    expect(creditCardEffectiveMonthlyRate(0.0375)).toBe(0.0375)
  })
  it('KKDF+BSMV %25 → ×1.25', () => {
    expect(creditCardEffectiveMonthlyRate(0.04, 0.25)).toBeCloseTo(0.05, 6)
  })
})

describe('resolveCreditCardRates', () => {
  it('fixed mod: kart oranları + vergi', () => {
    const rates = resolveCreditCardRates({
      card: {
        purchaseAprMonthly: 0.04,
        lateAprMonthly: 0.045,
        taxRateMonthly: 0.25,
        rateMode: 'fixed',
      },
      periodDebt: 50_000,
    })
    expect(rates.purchaseAprMonthly).toBeCloseTo(0.05, 6)
    expect(rates.lateAprMonthly).toBeCloseTo(0.05625, 6)
  })

  it('balanceTier mod: dönem borcuna göre kademe', () => {
    const rates = resolveCreditCardRates({
      card: {
        purchaseAprMonthly: 0.99,
        rateMode: 'balanceTier',
      },
      periodDebt: 25_000,
      tiers: REFERENCE_TIERS,
      presetCashAdvanceApr: 0.0425,
      presetCashAdvanceLateApr: 0.0455,
    })
    expect(rates.purchaseAprMonthly).toBe(0.0325)
    expect(rates.lateAprMonthly).toBe(0.0355)
    expect(rates.cashAdvanceAprMonthly).toBe(0.0425)
  })
})

describe('resolveCreditCardLateApr', () => {
  it('late verilmişse aynen döner', () => {
    expect(resolveCreditCardLateApr(0.0375, 0.0405)).toBe(0.0405)
  })
  it('late yoksa ×1.087', () => {
    expect(resolveCreditCardLateApr(0.0375)).toBeCloseTo(0.0407625, 6)
  })
})

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
    expect(D(s.endingBalance).toNumber()).toBeCloseTo(1700, 2)
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
      limit: 50_000,
    })
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

describe('creditCardSimpleInterest', () => {
  it('30 gün, %3.75 aylık → basit faiz', () => {
    const fee = creditCardSimpleInterest({
      balance: 10_000,
      days: 30,
      aprMonthly: 0.0375,
    })
    expect(D(fee).toNumber()).toBeCloseTo(375, 1)
  })
})

describe('creditCardInterPeriodCharges', () => {
  it('asgari ödendiyse gecikme faizi yok; akdi faiz var', () => {
    const charges = creditCardInterPeriodCharges({
      owedAtDue: 6000,
      minPayment: 2400,
      paidTowardDue: 2400,
      daysFromDue: 30,
      purchaseBalance: 6000,
      cashAdvanceBalance: 0,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0405,
      cashAdvanceAprMonthly: 0.0425,
    })
    expect(charges.lateInterest).toBe('0')
    expect(Number(charges.purchaseInterest)).toBeCloseTo(225, 0)
    expect(Number(charges.total)).toBeCloseTo(225, 0)
  })

  it('asgari altı ödemede gecikme + akdi faiz', () => {
    const charges = creditCardInterPeriodCharges({
      owedAtDue: 10_000,
      minPayment: 4000,
      paidTowardDue: 1000,
      daysFromDue: 30,
      purchaseBalance: 10_000,
      cashAdvanceBalance: 0,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0405,
      cashAdvanceAprMonthly: 0.0425,
    })
    // gecikme: (4000-1000) × 0.0405/30 × 30 = 121.5
    expect(Number(charges.lateInterest)).toBeCloseTo(121.5, 0)
    // akdi: 10000 × 0.0375 = 375
    expect(Number(charges.purchaseInterest)).toBeCloseTo(375, 0)
  })

  it('nakit avans bakiyesi ayrı oranla faizlenir', () => {
    const charges = creditCardInterPeriodCharges({
      owedAtDue: 5000,
      minPayment: 2000,
      paidTowardDue: 2000,
      daysFromDue: 30,
      purchaseBalance: 3000,
      cashAdvanceBalance: 2000,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0405,
      cashAdvanceAprMonthly: 0.0425,
    })
    expect(charges.lateInterest).toBe('0')
    expect(Number(charges.purchaseInterest)).toBeCloseTo(112.5, 0)
    expect(Number(charges.cashAdvanceInterest)).toBeCloseTo(85, 0)
  })
})

describe('allocateCreditCardPayment', () => {
  it('önce alışveriş, sonra nakit avans düşer', () => {
    const out = allocateCreditCardPayment(1500, 1000, 800)
    expect(out.purchase).toBe('0')
    expect(out.cashAdvance).toBe('300')
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
    expect(D(fee).toNumber()).toBeCloseTo(405, 1)
  })
  it('lateApr verilmezse APR × 1.087 ≈ +0.30 puan', () => {
    const fee = creditCardLateInterest({
      unpaidBalance: 10_000,
      daysLate: 30,
      apr: { value: 0.0375, period: 'monthly' },
    })
    expect(D(fee).toNumber()).toBeCloseTo(407.6, 0)
  })
})

describe('creditCardInstallmentRepaymentTotal', () => {
  it('faiz 0 → anapara', () => {
    expect(creditCardInstallmentRepaymentTotal({
      principal: 12_000,
      installmentCount: 12,
      aprMonthly: 0,
    })).toBe('12000')
  })
  it('faizli taksit → anaparadan büyük toplam', () => {
    const total = creditCardInstallmentRepaymentTotal({
      principal: 10_000,
      installmentCount: 12,
      aprMonthly: 0.03,
    })
    expect(Number(total)).toBeGreaterThan(10_000)
  })
})

describe('resolveCreditCardRepaymentTotal', () => {
  const card = { purchaseAprMonthly: 0.03, cashAdvanceAprMonthly: 0.0425 }

  it('repaymentTotal yoksa amount döner (taksit sayısından bağımsız)', () => {
    expect(resolveCreditCardRepaymentTotal({ amount: 500, type: 'purchase' }, card)).toBe(500)
    expect(
      resolveCreditCardRepaymentTotal(
        { amount: 10_000, type: 'purchase', installmentCount: 6 },
        card,
      ),
    ).toBe(10_000)
    expect(
      resolveCreditCardRepaymentTotal(
        { amount: 10_000, type: 'cashAdvance', installmentCount: 6 },
        card,
      ),
    ).toBe(10_000)
  })

  it('repaymentTotal manuel girildiyse o kullanılır (peşin işlemde de)', () => {
    expect(
      resolveCreditCardRepaymentTotal(
        { amount: 10_000, type: 'purchase', installmentCount: 6, repaymentTotal: 10_500 },
        card,
      ),
    ).toBe(10_500)
  })

  it('payment türü için repaymentTotal yok sayılır; amount döner', () => {
    expect(
      resolveCreditCardRepaymentTotal(
        { amount: 1000, type: 'payment', repaymentTotal: 1500 },
        card,
      ),
    ).toBe(1000)
  })
})

describe('splitInstallmentAmount', () => {
  it('count = 1 → tek elemanlı dizi (yuvarlanmış)', () => {
    expect(splitInstallmentAmount(1234.567, 1)).toEqual(['1234.57'])
  })
  it('eşit bölünebilen tutar → eşit taksitler', () => {
    expect(splitInstallmentAmount(12_000, 12)).toEqual(Array(12).fill('1000'))
  })
  it('yuvarlama farkı son taksite kalır; toplam korunur', () => {
    const parts = splitInstallmentAmount(1000, 3)
    expect(parts).toEqual(['333.33', '333.33', '333.34'])
    const sum = parts.reduce((acc, p) => acc + Number(p), 0)
    expect(sum).toBeCloseTo(1000, 2)
  })
  it('count < 1 → hata', () => {
    expect(() => splitInstallmentAmount(100, 0)).toThrow()
  })
})

describe('DEFAULT_MIN_PAYMENT_TIERS', () => {
  it('preset varsayılanları', () => {
    expect(DEFAULT_MIN_PAYMENT_TIERS.threshold).toBe(25_000)
    expect(DEFAULT_MIN_PAYMENT_TIERS.rateUnder).toBe(0.2)
    expect(DEFAULT_MIN_PAYMENT_TIERS.rateOver).toBe(0.4)
  })
})
