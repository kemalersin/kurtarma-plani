import { describe, expect, it } from 'vitest'
import type { CreditCard, CreditCardTransaction } from '@/core/types/entities'
import {
  accruedInstallmentCount,
  buildCardPeriods,
  cardCommittedTotal,
  cardOutstandingBalance,
  expandInstallments,
  projectCardPeriodDebts,
} from './cardHelpers'

const baseCard: CreditCard = {
  id: 'card-1',
  bankId: 'bank-1',
  name: 'Test',
  currency: 'TRY',
  limit: 50_000,
  openingBalance: 0,
  statementCutoffDay: 15,
  paymentDueDay: 25,
  purchaseAprMonthly: 0.03,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function txn(
  partial: Pick<CreditCardTransaction, 'date' | 'amount' | 'type'> &
    Partial<CreditCardTransaction>,
): CreditCardTransaction {
  return {
    id: partial.id ?? `txn-${partial.date}`,
    cardId: 'card-1',
    description: partial.description,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('buildCardPeriods', () => {
  it('kesim tarihinden sonraki hareket güncel (açık) dönemde görünür', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const transactions = [
      txn({
        date: '2026-05-20T10:00:00.000Z',
        amount: 500,
        type: 'purchase',
      }),
    ]

    const periods = buildCardPeriods(baseCard, transactions, { periods: 6, asOf })
    const last = periods[periods.length - 1]!

    expect(last.transactions).toHaveLength(1)
    expect(last.transactions[0]!.amount).toBe(500)
  })

  it('kesim günü öncesi hareket önceki kapalı dönemde kalır', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const transactions = [
      txn({
        id: 'old',
        date: '2026-05-10T10:00:00.000Z',
        amount: 100,
        type: 'purchase',
      }),
      txn({
        id: 'new',
        date: '2026-05-20T10:00:00.000Z',
        amount: 200,
        type: 'purchase',
      }),
    ]

    const periods = buildCardPeriods(baseCard, transactions, { periods: 6, asOf })
    const last = periods[periods.length - 1]!
    const prev = periods[periods.length - 2]!

    expect(last.transactions.map((t) => t.originalTxnId)).toEqual(['new'])
    expect(prev.transactions.map((t) => t.originalTxnId)).toEqual(['old'])
  })

  it('taksitli alışveriş aylık aylık tahakkuk eder', () => {
    const asOf = new Date('2026-08-22T12:00:00.000Z')
    const transactions = [
      txn({
        id: 'taksit',
        date: '2026-05-20T10:00:00.000Z',
        amount: 12_000,
        type: 'purchase',
        installmentCount: 12,
        repaymentTotal: 12_000,
      }),
    ]

    // 6 dönem: Mart, Nis, May, Haz, Tem, Ağu (kesim günü 15)
    const periods = buildCardPeriods(baseCard, transactions, { periods: 6, asOf })
    const taksitLi = periods
      .map((p) => p.transactions.length)
      .reduce((a, b) => a + b, 0)

    // Taksit 1: 20 May → May-Haz dönemi (kesim 15 Haz)
    // Taksit 2: 20 Haz → Haz-Tem
    // Taksit 3: 20 Tem → Tem-Ağu
    // Taksit 4: 20 Ağu → Ağu-Eyl (açık dönem) ama asOf=22 Ağu, yani açık dönem başı 15 Ağu
    // Toplam görünen: 4 taksit
    expect(taksitLi).toBe(4)

    const indices = periods
      .flatMap((p) => p.transactions)
      .map((t) => t.installmentIndex)
    expect(indices).toEqual([1, 2, 3, 4])

    const allCounts = periods
      .flatMap((p) => p.transactions)
      .map((t) => t.installmentCount)
    expect(allCounts.every((c) => c === 12)).toBe(true)
  })
})

describe('expandInstallments', () => {
  it('peşin işlem tek satır; repaymentTotal yoksa amount kullanılır', () => {
    const res = expandInstallments(baseCard, [
      txn({ date: '2026-05-20T00:00:00.000Z', amount: 1000, type: 'purchase' }),
    ])
    expect(res).toHaveLength(1)
    expect(res[0]!.installmentCount).toBeUndefined()
    expect(res[0]!.amount).toBe(1000)
  })

  it('peşin işlemde repaymentTotal verilmişse kart borcuna o yansır', () => {
    const res = expandInstallments(baseCard, [
      txn({
        date: '2026-05-20T00:00:00.000Z',
        amount: 1000,
        type: 'purchase',
        repaymentTotal: 1080,
      }),
    ])
    expect(res).toHaveLength(1)
    expect(res[0]!.installmentCount).toBeUndefined()
    expect(res[0]!.amount).toBe(1080)
  })

  it('12 taksit alışveriş 12 sanal kayıt üretir', () => {
    const res = expandInstallments(baseCard, [
      txn({
        id: 'taksit',
        date: '2026-05-20T10:00:00.000Z',
        amount: 12_000,
        type: 'purchase',
        installmentCount: 12,
        repaymentTotal: 12_000,
      }),
    ])
    expect(res).toHaveLength(12)
    expect(res.map((r) => r.installmentIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
    expect(res.every((r) => r.amount === 1000)).toBe(true)
    expect(res.every((r) => r.originalTxnId === 'taksit')).toBe(true)
  })

  it('repaymentTotal yoksa taksit toplamı amount ile aynı (otomatik faiz yok)', () => {
    const res = expandInstallments(baseCard, [
      txn({
        id: 'taksit',
        date: '2026-05-20T10:00:00.000Z',
        amount: 12_000,
        type: 'purchase',
        installmentCount: 12,
      }),
    ])
    const sum = res.reduce((acc, r) => acc + r.amount, 0)
    expect(sum).toBeCloseTo(12_000, 2)
  })

  it('payment türünde repaymentTotal yok sayılır; amount kullanılır', () => {
    const res = expandInstallments(baseCard, [
      txn({
        date: '2026-05-20T00:00:00.000Z',
        amount: 1000,
        type: 'payment',
        installmentCount: 6,
        repaymentTotal: 1500,
      }),
    ])
    expect(res).toHaveLength(1)
    expect(res[0]!.installmentCount).toBeUndefined()
    expect(res[0]!.amount).toBe(1000)
  })
})

describe('cardCommittedTotal', () => {
  it('taksitsiz: ekstre = committed, future = 0', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const totals = cardCommittedTotal(
      baseCard,
      [
        txn({ date: '2026-05-10T10:00:00.000Z', amount: 1000, type: 'purchase' }),
      ],
      asOf,
    )
    expect(Number(totals.ending)).toBe(1000)
    expect(Number(totals.future)).toBe(0)
    expect(Number(totals.committed)).toBe(1000)
  })

  it('12 taksit: ekstre = bugüne kadar tahakkuk; committed = geri ödeme toplamı', () => {
    const asOf = new Date('2026-06-22T12:00:00.000Z')
    const totals = cardCommittedTotal(
      baseCard,
      [
        txn({
          id: 't',
          date: '2026-05-20T10:00:00.000Z',
          amount: 12_000,
          type: 'purchase',
          installmentCount: 12,
          repaymentTotal: 12_000,
        }),
      ],
      asOf,
    )
    // 22 Haz itibarıyla 2 taksit tahakkuk etti (20 May + 20 Haz)
    expect(Number(totals.ending)).toBe(2000)
    expect(Number(totals.future)).toBe(10_000)
    expect(Number(totals.committed)).toBe(12_000)
  })

  it('ödeme ekstreyi azaltır; gelecek taksitleri etkilemez', () => {
    const asOf = new Date('2026-06-22T12:00:00.000Z')
    const totals = cardCommittedTotal(
      baseCard,
      [
        txn({
          id: 't',
          date: '2026-05-20T10:00:00.000Z',
          amount: 12_000,
          type: 'purchase',
          installmentCount: 12,
          repaymentTotal: 12_000,
        }),
        txn({
          id: 'pay',
          date: '2026-06-21T10:00:00.000Z',
          amount: 500,
          type: 'payment',
        }),
      ],
      asOf,
    )
    expect(Number(totals.ending)).toBe(1500)
    expect(Number(totals.future)).toBe(10_000)
    expect(Number(totals.committed)).toBe(11_500)
  })

  it('geç ödemede kalan borç + faiz ekstre borcuna yansır', () => {
    const card: CreditCard = {
      ...baseCard,
      limit: 200_000,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0455,
    }
    const txns = [
      txn({
        id: 'buy',
        date: '2026-01-14T12:00:00.000Z',
        amount: 10_000,
        type: 'purchase',
        repaymentTotal: 12_000,
      }),
      txn({
        id: 'pay',
        date: '2026-02-27T12:00:00.000Z',
        amount: 12_382.2,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-05-26T12:00:00.000Z')
    const ending = Number(cardOutstandingBalance(card, txns, asOf))
    const totals = cardCommittedTotal(card, txns, asOf)
    expect(ending).toBeGreaterThan(338.03)
    expect(Number(totals.ending)).toBe(ending)
    expect(Number(totals.committed)).toBe(ending)
  })
})

describe('projectCardPeriodDebts', () => {
  it('vadesi geçmiş ödenmemiş bakiye sonraki döneme taşınır; asgari tutar artar', () => {
    const card = { ...baseCard, purchaseAprMonthly: 0 }
    const txns = [
      txn({
        id: 'taksit',
        date: '2026-05-20T10:00:00.000Z',
        amount: 15_000,
        type: 'purchase',
        installmentCount: 3,
        repaymentTotal: 16_292.68,
      }),
    ]
    const asOf = new Date('2026-08-31T00:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 12, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })
    const withAccrual = projections.filter((p) => p.accrualLines.length > 0)
    expect(withAccrual.length).toBeGreaterThanOrEqual(3)
    expect(withAccrual[1]!.carriedIn).toBeGreaterThan(0)
    expect(withAccrual[1]!.minPayment).toBeGreaterThan(withAccrual[0]!.minPayment)
    expect(withAccrual[2]!.minPayment).toBeGreaterThan(withAccrual[1]!.minPayment)
  })

  it('vadesi gelmemiş gelecek dönemler bağımsız; sonraki vadeye taşıma yok', () => {
    const card = { ...baseCard, purchaseAprMonthly: 0 }
    const txns = [
      txn({
        id: 'taksit',
        date: '2026-05-20T10:00:00.000Z',
        amount: 15_000,
        type: 'purchase',
        installmentCount: 3,
        repaymentTotal: 16_292.68,
      }),
    ]
    const today = new Date('2026-05-26T00:00:00.000Z')
    const horizon = new Date('2026-08-31T00:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 12, asOf: horizon })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf: today })
    const withAccrual = projections.filter((p) => p.accrualLines.length > 0)
    expect(withAccrual.length).toBeGreaterThanOrEqual(3)
    for (const p of withAccrual) {
      expect(p.carriedIn).toBe(0)
      expect(p.lateInterest).toBe(0)
    }
    const endings = withAccrual.map((p) => p.endingBalance)
    expect(Math.max(...endings) - Math.min(...endings)).toBeLessThan(1)
  })

  it('gecikme faizi yalnızca geçmiş vadelerde taşınan bakiyeye eklenir', () => {
    const card = { ...baseCard, purchaseAprMonthly: 0.03, lateAprMonthly: 0.035 }
    const txns = [
      txn({
        date: '2026-05-20T10:00:00.000Z',
        amount: 5000,
        type: 'purchase',
      }),
    ]
    const asOf = new Date('2026-08-31T00:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 8, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })
    const second = projections.find((p, i) => i > 0 && p.carriedIn > 0)
    expect(second).toBeDefined()
    expect(second!.lateInterest).toBeGreaterThan(0)
    expect(second!.endingBalance).toBeGreaterThan(second!.carriedIn + second!.periodAccruals)
  })

  it('geç ödeme önceki dönem borcunu kapatır; kalan gecikme faizi sonraki vadeye taşınır', () => {
    const card: CreditCard = {
      ...baseCard,
      limit: 200_000,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0455,
    }
    const txns = [
      txn({
        id: 'buy',
        date: '2026-01-14T12:00:00.000Z',
        amount: 10_000,
        type: 'purchase',
        repaymentTotal: 12_000,
      }),
      txn({
        id: 'pay',
        date: '2026-02-27T12:00:00.000Z',
        amount: 12_382.2,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-05-26T12:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 8, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })

    const feb = projections.find((p) => p.cutoffDate.startsWith('2026-02'))
    const mar = projections.find((p) => p.cutoffDate.startsWith('2026-03'))
    const apr = projections.find((p) => p.cutoffDate.startsWith('2026-04'))

    expect(feb!.endingBalance).toBeCloseTo(12_382.2, 0)
    expect(feb!.paidInFull).toBe(false)
    expect(mar!.carriedIn).toBeCloseTo(12_382.2, 0)
    expect(mar!.lateInterest).toBeCloseTo(338.03, 0)
    expect(mar!.endingBalance).toBeCloseTo(338.03, 0)
    expect(mar!.paidInFull).toBe(false)
    expect(mar!.paid).toBe(true)
    expect(mar!.paymentsInWindow).toBeCloseTo(12_382.2, 0)
    expect(apr!.carriedIn).toBeCloseTo(338.03, 0)
    expect(apr!.lateInterest).toBeGreaterThan(0)
    expect(apr!.endingBalance).toBeGreaterThan(338.03)
  })

  it('kesim sonrası ödeme vade borcunu düşürür', () => {
    const card = { ...baseCard, purchaseAprMonthly: 0 }
    const txns = [
      txn({
        date: '2026-05-20T10:00:00.000Z',
        amount: 1000,
        type: 'purchase',
      }),
      txn({
        date: '2026-06-20T10:00:00.000Z',
        amount: 400,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-08-31T00:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 6, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })
    const withPurchase = projections.find((p) => p.periodAccruals > 0)
    expect(withPurchase).toBeDefined()
    expect(withPurchase!.endingBalance).toBe(1000)
    expect(withPurchase!.paidInFull).toBe(false)
    expect(withPurchase!.paidAfterCutoff).toBe('400')
    expect(withPurchase!.paymentsInWindow).toBe('400')
    const next = projections[projections.indexOf(withPurchase!) + 1]
    expect(next!.carriedIn).toBe(600)
  })
})

describe('accruedInstallmentCount', () => {
  it('taksitsiz: 1', () => {
    expect(accruedInstallmentCount('2026-05-20T00:00:00.000Z', undefined)).toBe(1)
    expect(accruedInstallmentCount('2026-05-20T00:00:00.000Z', 1)).toBe(1)
  })
  it('alışveriş günü: 1. taksit tahakkuk etti', () => {
    expect(
      accruedInstallmentCount(
        '2026-05-20T00:00:00.000Z',
        12,
        new Date('2026-05-21T00:00:00.000Z'),
      ),
    ).toBe(1)
  })
  it('+2 ay sonra: 3 taksit tahakkuk etti', () => {
    expect(
      accruedInstallmentCount(
        '2026-05-20T00:00:00.000Z',
        12,
        new Date('2026-07-21T00:00:00.000Z'),
      ),
    ).toBe(3)
  })
  it('+12 ay sonra: tüm taksitler tahakkuk', () => {
    expect(
      accruedInstallmentCount(
        '2026-05-20T00:00:00.000Z',
        12,
        new Date('2027-05-21T00:00:00.000Z'),
      ),
    ).toBe(12)
  })
})
