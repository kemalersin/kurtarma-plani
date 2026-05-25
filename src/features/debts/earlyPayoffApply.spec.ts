import { describe, expect, it } from 'vitest'
import { buildAnnuitySchedule } from '@/finance/loan'
import { buildEarlyPayoffPayments } from './earlyPayoffApply'

describe('buildEarlyPayoffPayments', () => {
  const schedule = buildAnnuitySchedule({
    principal: 100_000,
    termMonths: 3,
    interestRate: { value: 0.03, period: 'monthly' },
    firstInstallmentDate: '2026-02-01T00:00:00.000Z',
  })

  it('ilk kalan taksite tam tutar, sonrakilere sıfır yazar', () => {
    const drafts = buildEarlyPayoffPayments({
      schedule,
      paidThroughIndex: 1,
      paymentMap: new Map(),
      paidDate: '2026-05-01T00:00:00.000Z',
      paidAmount: 67_500.5,
      notes: 'Test',
    })

    expect(drafts).toHaveLength(2)
    expect(drafts[0]?.installmentIndex).toBe(2)
    expect(drafts[0]?.paidAmount).toBe(67_500.5)
    expect(drafts[0]?.notes).toBe('Test')
    expect(drafts[1]?.installmentIndex).toBe(3)
    expect(drafts[1]?.paidAmount).toBe(0)
    expect(drafts[1]?.notes).toBe('Test (kapatıldı)')
  })

  it('ödenmiş tüm taksitlerde boş dizi döner', () => {
    const drafts = buildEarlyPayoffPayments({
      schedule,
      paidThroughIndex: 3,
      paymentMap: new Map(),
      paidDate: '2026-05-01T00:00:00.000Z',
      paidAmount: 0,
    })
    expect(drafts).toEqual([])
  })
})
