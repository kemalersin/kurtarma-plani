import { describe, expect, it } from 'vitest'
import { buildScheduleForLoan, listInstallmentAmountForLoan, paidThroughIndex } from './loanHelpers'
import type { Loan, LoanPayment } from '@/core/types/entities'

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

  it('kısmi ödeme tam ödenmiş sayılmaz', () => {
    const pays = [
      payment(1, true),
      payment(2, false, {
        paidDate: ISO,
        paidAmount: 600,
        scheduledAmount: 1000,
      }),
    ]
    expect(paidThroughIndex(pays)).toBe(1)
  })
})

const sampleLoan = {
  id: 'l1',
  name: 'Test',
  bankId: 'b1',
  principal: 100000,
  termMonths: 12,
  interestRate: 2.5,
  interestPeriod: 'monthly',
  firstInstallmentDate: '2026-01-15T00:00:00.000Z',
  startDate: '2026-01-01T00:00:00.000Z',
  currency: 'TRY',
  createdAt: ISO,
  updatedAt: ISO,
} as Loan

describe('listInstallmentAmountForLoan', () => {
  it('sıradaki taksit satırının plan tutarını döner (gecikme faizi yok)', () => {
    const schedule = buildScheduleForLoan(sampleLoan)
    const paidIdx = 11
    const nextRow = schedule.rows.find((r) => r.index === paidIdx + 1)!
    expect(listInstallmentAmountForLoan(schedule, [], paidIdx)).toBe(nextRow.installment)
    if (schedule.installment !== nextRow.installment) {
      expect(listInstallmentAmountForLoan(schedule, [], paidIdx)).not.toBe(schedule.installment)
    }
  })

  it('ödenmemiş scheduledAmount override kullanır', () => {
    const schedule = buildScheduleForLoan(sampleLoan)
    const pays = [payment(1, false, { scheduledAmount: 1234.56 })]
    expect(listInstallmentAmountForLoan(schedule, pays, 0)).toBe('1234.56')
  })
})
