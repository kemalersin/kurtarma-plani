import { describe, expect, it } from 'vitest'
import {
  installmentPaymentLateDaysCount,
  priorInstallmentIndexRequired,
  priorInstallmentPaymentBlockedMessage,
} from './installmentPaymentFormHints'

describe('priorInstallmentIndexRequired', () => {
  it('sıra uygunsa undefined', () => {
    expect(priorInstallmentIndexRequired(2, 1, false)).toBeUndefined()
    expect(priorInstallmentIndexRequired(1, 0, false)).toBeUndefined()
  })

  it('önceki taksit ödenmemişse kapatılması gereken numarayı döner', () => {
    expect(priorInstallmentIndexRequired(4, 1, false)).toBe(2)
    expect(priorInstallmentIndexRequired(3, 0, false)).toBe(1)
  })

  it('mevcut ödeme kaydı varsa undefined', () => {
    expect(priorInstallmentIndexRequired(4, 1, true)).toBeUndefined()
  })
})

describe('installmentPaymentLateDaysCount', () => {
  it('ödeme tarihi yoksa vade geçmişse bugüne göre gün sayar', () => {
    expect(
      installmentPaymentLateDaysCount(
        '2026-03-01T00:00:00.000Z',
        undefined,
        '2026-03-15T00:00:00.000Z',
      ),
    ).toBeGreaterThan(0)
  })

  it('ödeme tarihi yoksa vade gelmemişse 0', () => {
    expect(
      installmentPaymentLateDaysCount(
        '2026-06-01T00:00:00.000Z',
        undefined,
        '2026-03-15T00:00:00.000Z',
      ),
    ).toBe(0)
  })

  it('ödeme tarihi verilmişse ona göre hesaplar', () => {
    expect(
      installmentPaymentLateDaysCount(
        '2026-03-01T00:00:00.000Z',
        '2026-03-10T00:00:00.000Z',
        '2026-03-15T00:00:00.000Z',
      ),
    ).toBe(9)
  })
})

describe('priorInstallmentPaymentBlockedMessage', () => {
  it('taksit numarasını içerir', () => {
    expect(priorInstallmentPaymentBlockedMessage(2)).toContain('2. taksiti')
  })
})
