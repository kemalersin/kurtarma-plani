import { describe, expect, it } from 'vitest'
import { displayInstallmentAmount, isInstallmentUpcoming, unpaidInstallmentOverrides, canMarkInstallmentAsPaid } from './installmentDisplay'

describe('isInstallmentUpcoming', () => {
  it('vade bugünden sonraysa true', () => {
    expect(
      isInstallmentUpcoming('2026-06-01T00:00:00.000Z', new Date('2026-05-01T00:00:00.000Z')),
    ).toBe(true)
  })

  it('vade bugün veya geçmişteyse false', () => {
    expect(
      isInstallmentUpcoming('2026-05-01T00:00:00.000Z', new Date('2026-05-01T12:00:00.000Z')),
    ).toBe(false)
  })
})

describe('displayInstallmentAmount', () => {
  it('override kaydı plan tutarını gösterir', () => {
    expect(displayInstallmentAmount(1000, { scheduledAmount: 1200 })).toBe(1200)
  })

  it('ödenmiş kayıtta paidAmount önceliklidir', () => {
    expect(
      displayInstallmentAmount(1000, {
        scheduledAmount: 1000,
        paidDate: '2026-05-01T00:00:00.000Z',
        paidAmount: 1050,
      }),
    ).toBe(1050)
  })
})

describe('canMarkInstallmentAsPaid', () => {
  it('ilk taksit her zaman işaretlenebilir', () => {
    expect(canMarkInstallmentAsPaid(1, 0)).toBe(true)
  })

  it('önceki ödenmeden sonraki taksit işaretlenemez', () => {
    expect(canMarkInstallmentAsPaid(3, 1)).toBe(false)
    expect(canMarkInstallmentAsPaid(3, 2)).toBe(true)
  })
})

describe('unpaidInstallmentOverrides', () => {
  it('yalnızca paidDate olmayan kayıtları alır', () => {
    const map = unpaidInstallmentOverrides([
      { installmentIndex: 2, scheduledAmount: 1200 },
      { installmentIndex: 3, scheduledAmount: 800, paidDate: '2026-05-01T00:00:00.000Z' },
    ])
    expect(map.get(2)).toBe(1200)
    expect(map.has(3)).toBe(false)
  })
})
