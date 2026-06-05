import { describe, expect, it } from 'vitest'
import {
  buildAnnuitySchedule,
  computeLateFee,
  firstPeriodInterestFactorFromDates,
  lateDays,
  payoffAmount,
  remainingInstallmentsTotal,
  remainingPrincipalBalance,
  outstandingLateFeesTotal,
  remainingDebtTotal,
} from '@/finance/loan'
import { D, moneyEquals } from '@/finance/decimal'

const FIRST = '2026-02-15T00:00:00.000Z'

describe('buildAnnuitySchedule', () => {
  it('aylık %3.75 ve 12 ay için bilinen taksit tutarını üretir', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.0375, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    // A = 100000 * (0.0375 * 1.0375^12) / (1.0375^12 - 1) ≈ 10501.23
    expect(D(schedule.installment).toNumber()).toBeCloseTo(10_501.23, 1)
    expect(schedule.rows).toHaveLength(12)
    expect(schedule.rows[0]!.beginningBalance).toBe('100000')
    // Son taksit bakiyeyi sıfırlamalı
    expect(schedule.rows[11]!.endingBalance).toBe('0')
  })

  it('faiz sıfırken eşit anapara taksitleri verir', () => {
    const schedule = buildAnnuitySchedule({
      principal: 12_000,
      termMonths: 12,
      interestRate: { value: 0, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    expect(D(schedule.installment).toNumber()).toBeCloseTo(1000, 2)
    expect(D(schedule.totalInterest).toNumber()).toBeCloseTo(0, 2)
    expect(D(schedule.totalPayment).toNumber()).toBeCloseTo(12_000, 2)
  })

  it('yıllık faizi aylığa çevirir', () => {
    const monthly = buildAnnuitySchedule({
      principal: 50_000,
      termMonths: 6,
      interestRate: { value: 0.04, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const annual = buildAnnuitySchedule({
      principal: 50_000,
      termMonths: 6,
      interestRate: { value: 0.48, period: 'annual' }, // 0.04 * 12
      firstInstallmentDate: FIRST,
    })
    expect(monthly.installment).toBe(annual.installment)
  })

  it('vergi (KKDF+BSMV) eklenince taksit artar', () => {
    const base = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.04, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const taxed = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.04, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: FIRST,
    })
    expect(D(taxed.installment).gt(base.installment)).toBe(true)
    expect(D(taxed.totalTax).gt(0)).toBe(true)
  })

  it('vergi faiz üzerinden ayrı hesaplanır (sözleşme faizi ≠ faiz+vergi)', () => {
    const schedule = buildAnnuitySchedule({
      principal: 25_320,
      termMonths: 3,
      interestRate: { value: 0.0425, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: '2026-04-23T00:00:00.000Z',
      startDate: '2026-03-26T00:00:00.000Z',
    })
    expect(D(schedule.installment).toNumber()).toBeCloseTo(9340.17, 0)
    expect(D(schedule.rows[0]!.interest).toNumber()).toBeCloseTo(968.49, 0)
    expect(D(schedule.rows[0]!.tax).toNumber()).toBeCloseTo(290.54, 0)
    expect(D(schedule.rows[1]!.interest).toNumber()).toBeCloseTo(732.65, 0)
    expect(D(schedule.rows[2]!.interest).toNumber()).toBeCloseTo(376.17, 0)
  })

  it('ilk dönem kıst: 30+ gün aralıkta tam ay faizi uygulanır', () => {
    expect(
      firstPeriodInterestFactorFromDates('2026-02-20', '2026-03-22'),
    ).toBe(1)
  })

  it('toplam ödeme = anapara + faiz + vergi', () => {
    const schedule = buildAnnuitySchedule({
      principal: 75_000,
      termMonths: 24,
      interestRate: { value: 0.035, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const total = D(schedule.totalPayment)
    const expected = D(75_000).plus(schedule.totalInterest).plus(schedule.totalTax)
    expect(moneyEquals(total, expected, '0.05')).toBe(true)
  })
})

describe('lateDays / computeLateFee', () => {
  it('vade öncesi ödemede gecikme yok', () => {
    expect(lateDays('2026-02-15T00:00:00Z', '2026-02-10T00:00:00Z')).toBe(0)
  })

  it('10 gün gecikme için doğru gün sayısı', () => {
    expect(lateDays('2026-02-15T00:00:00Z', '2026-02-25T00:00:00Z')).toBe(10)
  })

  it('gecikme faizi: sözleşme oranının 1.3 katı (default)', () => {
    const fee = computeLateFee(
      10_000,
      30,
      { value: 0.04, period: 'monthly' },
    )
    // monthlyLate = 0.052, daily = 0.052/30, 30 gün → 10000 * 0.052 = 520
    expect(D(fee).toNumber()).toBeCloseTo(520, 1)
  })

  it('gecikme faizi: özel oran verildiğinde onu kullanır', () => {
    const fee = computeLateFee(
      10_000,
      15,
      { value: 0.04, period: 'monthly' },
      { value: 0.06, period: 'monthly' },
    )
    // daily = 0.06/30 = 0.002, 15 gün → 10000 * 0.002 * 15 = 300
    expect(D(fee).toNumber()).toBeCloseTo(300, 1)
  })
})

describe('payoffAmount', () => {
  const contractRate = { value: 0.04, period: 'monthly' as const }

  it('hiç ödeme yok, tüm vadeler ilerideyse ≈ anapara (gelecek faiz tasarrufu)', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: contractRate,
      firstInstallmentDate: '2026-03-15T00:00:00.000Z',
    })
    const params = {
      schedule,
      paidThroughIndex: 0,
      asOfDate: '2026-02-10T00:00:00.000Z',
      contractRate,
    }
    expect(D(payoffAmount(params)).toNumber()).toBeCloseTo(100_000, 1)
    expect(D(payoffAmount(params)).lt(D(remainingDebtTotal(params)))).toBe(true)
  })

  it('gecikmiş ilk taksitte gelecek faiz düşülür; gecikme faizi kalır', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: contractRate,
      firstInstallmentDate: '2026-02-15T00:00:00.000Z',
    })
    const asOfDate = '2026-03-15T00:00:00.000Z'
    const params = { schedule, paidThroughIndex: 0, asOfDate, contractRate }
    const remaining = D(remainingDebtTotal(params))
    const payoff = D(payoffAmount(params))
    expect(payoff.lt(remaining)).toBe(true)
    expect(payoff.gt(100_000)).toBe(true)
  })

  it('tüm taksitler ödenmişse 0', () => {
    const schedule = buildAnnuitySchedule({
      principal: 60_000,
      termMonths: 6,
      interestRate: { value: 0.03, period: 'monthly' },
      firstInstallmentDate: '2026-02-15T00:00:00.000Z',
    })
    const amount = payoffAmount({
      schedule,
      paidThroughIndex: 6,
      asOfDate: '2026-09-01T00:00:00.000Z',
      contractRate: { value: 0.03, period: 'monthly' },
    })
    expect(amount).toBe('0')
  })

  it('son taksit öncesi erken kapama kalan borçtan düşüktür', () => {
    const schedule = buildAnnuitySchedule({
      principal: 25_320,
      termMonths: 3,
      interestRate: { value: 0.0425, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: '2026-04-23T00:00:00.000Z',
      startDate: '2026-03-26T00:00:00.000Z',
    })
    const params = {
      schedule,
      paidThroughIndex: 2,
      asOfDate: '2026-06-04T00:00:00.000Z',
      contractRate: { value: 0.0425, period: 'monthly' as const },
      startDate: '2026-03-26T00:00:00.000Z',
    }
    const payoff = D(payoffAmount(params))
    const remaining = D(remainingDebtTotal(params))
    expect(payoff.lt(remaining)).toBe(true)
    expect(payoff.toNumber()).toBeCloseTo(8851.15, 0)
  })

  it('gecikmiş ve ileride vadeler varken banka senaryosuna yakın kalır', () => {
    const schedule = buildAnnuitySchedule({
      principal: 400_000,
      termMonths: 12,
      interestRate: { value: 0.0479, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: '2025-11-21T00:00:00.000Z',
      startDate: '2025-10-21T00:00:00.000Z',
    })
    expect(D(schedule.installment).toNumber()).toBeCloseTo(48_306.35, 2)

    const asOf = '2026-06-05T00:00:00.000Z'
    const contractRate = { value: 0.0479, period: 'monthly' as const }
    const params = {
      schedule,
      paidThroughIndex: 5,
      asOfDate: asOf,
      contractRate,
      startDate: '2025-10-21T00:00:00.000Z',
    }
    const payoff = D(payoffAmount(params))
    const remaining = D(remainingDebtTotal(params))

    expect(payoff.toNumber()).toBeCloseTo(304_862.24, 0)
    expect(payoff.lt(remaining)).toBe(true)
    expect(remaining.toNumber()).toBeCloseTo(344_160.51, 0)
  })

  it('ileride vadesi olan taksitler varken erken kapama kalan borçtan düşüktür', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 24,
      interestRate: { value: 0.035, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: '2024-06-21T00:00:00.000Z',
      startDate: '2024-05-21T00:00:00.000Z',
    })
    const contractRate = { value: 0.035, period: 'monthly' as const }
    const params = {
      schedule,
      paidThroughIndex: 18,
      asOfDate: '2026-03-15T00:00:00.000Z',
      contractRate,
      startDate: '2024-05-21T00:00:00.000Z',
    }
    const payoff = D(payoffAmount(params))
    const remaining = D(remainingDebtTotal(params))
    expect(payoff.lte(remaining)).toBe(true)
    expect(payoff.lt(remaining)).toBe(true)
  })

  it('tüm kalan taksitler gecikmişse erken kapama kalan borca eşit olabilir', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 24,
      interestRate: { value: 0.035, period: 'monthly' },
      taxRateMonthly: 0.3,
      firstInstallmentDate: '2024-06-21T00:00:00.000Z',
      startDate: '2024-05-21T00:00:00.000Z',
    })
    const params = {
      schedule,
      paidThroughIndex: 18,
      asOfDate: '2026-06-05T00:00:00.000Z',
      contractRate: { value: 0.035, period: 'monthly' as const },
      startDate: '2024-05-21T00:00:00.000Z',
    }
    expect(payoffAmount(params)).toBe(remainingDebtTotal(params))
  })
})

describe('remainingPrincipalBalance / remainingInstallmentsTotal', () => {
  it('hiç ödeme yokken anapara = başlangıç, kalan borç = toplam taksit', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.04, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    expect(remainingPrincipalBalance(schedule, 0)).toBe('100000')
    expect(remainingInstallmentsTotal(schedule, 0)).toBe(schedule.totalPayment)
  })

  it('3 taksit ödendikten sonra kalan borç = kalan taksit tutarları toplamı', () => {
    const schedule = buildAnnuitySchedule({
      principal: 60_000,
      termMonths: 6,
      interestRate: { value: 0.03, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const expected = schedule.rows
      .filter((r) => r.index > 3)
      .reduce((acc, r) => acc + Number(r.installment), 0)
    expect(D(remainingInstallmentsTotal(schedule, 3)).toNumber()).toBeCloseTo(expected, 2)
    expect(D(remainingPrincipalBalance(schedule, 3)).toNumber()).toBeCloseTo(
      Number(schedule.rows[2]!.endingBalance),
      2,
    )
  })

  it('tüm taksitler ödendiyse 0', () => {
    const schedule = buildAnnuitySchedule({
      principal: 12_000,
      termMonths: 12,
      interestRate: { value: 0, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    expect(remainingInstallmentsTotal(schedule, 12)).toBe('0')
    expect(remainingPrincipalBalance(schedule, 12)).toBe('0')
  })

  it('override tutarları kalan taksit toplamına yansır', () => {
    const schedule = buildAnnuitySchedule({
      principal: 60_000,
      termMonths: 6,
      interestRate: { value: 0.03, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const overrides = new Map<number, number>([[4, 9999]])
    const base = D(remainingInstallmentsTotal(schedule, 3))
    const withOverride = D(remainingInstallmentsTotal(schedule, 3, overrides))
    const row4Plan = D(schedule.rows[3]!.installment)
    expect(withOverride.minus(base).toNumber()).toBeCloseTo(9999 - row4Plan.toNumber(), 2)
  })
})

describe('outstandingLateFeesTotal / remainingDebtTotal', () => {
  const contractRate = { value: 0.04, period: 'monthly' as const }

  it('vadesi gelmemiş taksitlerde gecikme faizi yok', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: contractRate,
      firstInstallmentDate: '2026-02-15T00:00:00.000Z',
    })
    const fees = outstandingLateFeesTotal({
      schedule,
      paidThroughIndex: 0,
      asOfDate: '2026-02-10T00:00:00.000Z',
      contractRate,
    })
    expect(fees).toBe('0')
    expect(
      remainingDebtTotal({
        schedule,
        paidThroughIndex: 0,
        asOfDate: '2026-02-10T00:00:00.000Z',
        contractRate,
      }),
    ).toBe(remainingInstallmentsTotal(schedule, 0))
  })

  it('gecikmiş ödenmemiş taksitler için gecikme faizi eklenir', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: contractRate,
      firstInstallmentDate: '2026-02-15T00:00:00.000Z',
    })
    const asOfDate = '2026-03-15T00:00:00.000Z'
    const days = lateDays(schedule.rows[0]!.dueDate, asOfDate)
    const expectedFee = computeLateFee(schedule.rows[0]!.installment, days, contractRate)
    const fees = outstandingLateFeesTotal({
      schedule,
      paidThroughIndex: 0,
      asOfDate,
      contractRate,
    })
    expect(D(fees).toNumber()).toBeCloseTo(Number(expectedFee), 2)
    const debt = remainingDebtTotal({
      schedule,
      paidThroughIndex: 0,
      asOfDate,
      contractRate,
    })
    expect(D(debt).toNumber()).toBeCloseTo(
      D(remainingInstallmentsTotal(schedule, 0)).plus(fees).toNumber(),
      2,
    )
  })
})
