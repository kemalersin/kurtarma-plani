import { describe, expect, it } from 'vitest'
import { paidThroughIndex } from './loanHelpers'
import type { LoanPayment } from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function payment(
  installmentIndex: number,
  paid: boolean,
  over: Partial<LoanPayment> = {},
): LoanPayment {
  return {
    id: `lp-${installmentIndex}`,
    loanId: 'l1',
    installmentIndex,
    dueDate: ISO,
    scheduledAmount: 1000,
    ...(paid ? { paidDate: ISO, paidAmount: 1000 } : {}),
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as LoanPayment
}

describe('paidThroughIndex', () => {
  it('boş listede 0 döner', () => {
    expect(paidThroughIndex([])).toBe(0)
  })

  it('ardışık ödenen 1..3 için 3 döner (sıralı geliş)', () => {
    const pays = [payment(1, true), payment(2, true), payment(3, true)]
    expect(paidThroughIndex(pays)).toBe(3)
  })

  it('regresyon: aynı set ters sırada gelse de 3 döner', () => {
    const pays = [payment(3, true), payment(2, true), payment(1, true)]
    expect(paidThroughIndex(pays)).toBe(3)
  })

  it('regresyon: rastgele sırada (2,1,3) geldiğinde 3 döner', () => {
    const pays = [payment(2, true), payment(1, true), payment(3, true)]
    expect(paidThroughIndex(pays)).toBe(3)
  })

  it('boşluk varsa ardışık en son kapanmış index döner (1,2 ödenmiş, 3 atlanmış, 4 ödenmiş → 2)', () => {
    const pays = [payment(1, true), payment(2, true), payment(4, true)]
    expect(paidThroughIndex(pays)).toBe(2)
  })

  it('paidDate yoksa o ödeme sayılmaz', () => {
    const pays = [payment(1, true), payment(2, false), payment(3, true)]
    expect(paidThroughIndex(pays)).toBe(1)
  })

  it('hiç paidDate yoksa 0 döner', () => {
    const pays = [payment(1, false), payment(2, false)]
    expect(paidThroughIndex(pays)).toBe(0)
  })
})
