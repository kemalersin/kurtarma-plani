import { describe, expect, it } from 'vitest'
import {
  buildAnnuitySchedule,
  computeLateFee,
  lateDays,
  payoffAmount,
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
  })

  it('toplam ödeme = anapara + toplam faiz', () => {
    const schedule = buildAnnuitySchedule({
      principal: 75_000,
      termMonths: 24,
      interestRate: { value: 0.035, period: 'monthly' },
      firstInstallmentDate: FIRST,
    })
    const total = D(schedule.totalPayment)
    const expected = D(75_000).plus(schedule.totalInterest)
    // Yuvarlama farkı kuruş seviyesinde olabilir
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
  it('hiç ödeme yok, ilk taksitten 30+ gün önce → anaparaya eşit', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.04, period: 'monthly' },
      firstInstallmentDate: '2026-03-15T00:00:00.000Z',
    })
    const amount = payoffAmount({
      schedule,
      paidThroughIndex: 0,
      // İlk taksitten 30+ gün önce → ek faiz tahakkuku yok
      asOfDate: '2026-02-10T00:00:00.000Z',
    })
    expect(D(amount).toNumber()).toBeCloseTo(100_000, 1)
  })

  it('hiç ödeme yok, vade yaklaşırken kısmi ay faizi tahakkuk eder', () => {
    const schedule = buildAnnuitySchedule({
      principal: 100_000,
      termMonths: 12,
      interestRate: { value: 0.04, period: 'monthly' },
      firstInstallmentDate: '2026-02-15T00:00:00.000Z',
    })
    const amount = payoffAmount({
      schedule,
      paidThroughIndex: 0,
      // İlk taksitten 4 gün öncesi → 26 gün tahakkuk
      asOfDate: '2026-02-11T00:00:00.000Z',
    })
    // 100000 + 100000 * (0.04/30) * 26 ≈ 103466.67
    expect(D(amount).toNumber()).toBeCloseTo(103_466.67, 1)
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
    })
    expect(amount).toBe('0')
  })
})
