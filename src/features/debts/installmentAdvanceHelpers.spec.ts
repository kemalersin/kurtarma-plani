import { describe, expect, it } from 'vitest'
import {
  advancePaidThroughIndex,
  isFirstInstallmentDateOnOrAfterStart,
} from './installmentAdvanceHelpers'
import type { InstallmentCashAdvancePayment } from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function payment(
  installmentIndex: number,
  paid: boolean,
): InstallmentCashAdvancePayment {
  return {
    id: `ip-${installmentIndex}`,
    installmentAdvanceId: 'ica1',
    installmentIndex,
    dueDate: ISO,
    scheduledAmount: 500,
    ...(paid ? { paidDate: ISO, paidAmount: 500 } : {}),
    createdAt: ISO,
    updatedAt: ISO,
  } as InstallmentCashAdvancePayment
}

describe('isFirstInstallmentDateOnOrAfterStart', () => {
  it('ilk taksit başlangıçtan önceyse false', () => {
    expect(
      isFirstInstallmentDateOnOrAfterStart(
        '2026-03-01T00:00:00.000Z',
        '2026-02-28T00:00:00.000Z',
      ),
    ).toBe(false)
  })

  it('aynı gün veya sonraysa true', () => {
    expect(
      isFirstInstallmentDateOnOrAfterStart(
        '2026-03-01T00:00:00.000Z',
        '2026-03-01T12:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      isFirstInstallmentDateOnOrAfterStart(
        '2026-03-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
      ),
    ).toBe(true)
  })
})

describe('advancePaidThroughIndex', () => {
  it('sıra-bağımsız: ters sıra 3,2,1 ödenmiş → 3 döner', () => {
    const pays = [payment(3, true), payment(2, true), payment(1, true)]
    expect(advancePaidThroughIndex(pays)).toBe(3)
  })

  it('boşluk varsa ardışık en son kapanmışta durur (1,2 ödenmiş, 3 yok, 4 ödenmiş → 2)', () => {
    const pays = [payment(4, true), payment(1, true), payment(2, true)]
    expect(advancePaidThroughIndex(pays)).toBe(2)
  })

  it('hiç paidDate yoksa 0', () => {
    expect(advancePaidThroughIndex([payment(1, false), payment(2, false)])).toBe(0)
  })
})
