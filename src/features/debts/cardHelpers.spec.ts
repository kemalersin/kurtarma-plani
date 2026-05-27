import { describe, expect, it } from 'vitest'
import type { CreditCard, CreditCardTransaction } from '@/core/types/entities'
import {
  accruedInstallmentCount,
  buildCardPeriods,
  cardCommittedTotal,
  cardOutstandingBalance,
  cardPeriodBounds,
  cardPeriodHasSelectableDates,
  defaultCardStatementPeriodCutoff,
  defaultCardTxnDateInPeriod,
  expandInstallments,
  earliestCreditCardTransactionDate,
  isCreditCardOpeningDateOnOrBeforeFirstTxn,
  isCreditCardTxnDateOnOrAfterOpening,
  periodOpeningBalance,
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

  it('açılış tarihi dönem ortasındaysa devreden bakiye o dönem başına yazılır', () => {
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 10_000,
      openingDate: '2026-05-20T00:00:00.000Z',
    }
    const expanded = expandInstallments(card, [
      txn({
        id: 'buy',
        date: '2026-05-25T10:00:00.000Z',
        amount: 2_000,
        type: 'purchase',
      }),
    ])
    const asOf = new Date('2026-06-10T12:00:00.000Z')
    const periods = buildCardPeriods(card, [txn({
      id: 'buy',
      date: '2026-05-25T10:00:00.000Z',
      amount: 2_000,
      type: 'purchase',
    })], { periods: 4, asOf })
    const junePeriod = periods.find((p) => p.cutoffDate.startsWith('2026-06'))!
    expect(junePeriod.openingBalance).toBe(10_000)
    expect(Number(junePeriod.statement.endingBalance)).toBe(12_000)

    const periodEnd = new Date(junePeriod.cutoffDate)
    const periodStart = new Date(periodEnd)
    periodStart.setUTCMonth(periodStart.getUTCMonth() - 1)
    expect(periodOpeningBalance(card, expanded, periodStart, periodEnd)).toBe(10_000)
  })

  it('açılış tarihinden önceki hareketler dönem hesabına dahil edilmez', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 1_000,
      openingDate: '2026-05-15T00:00:00.000Z',
    }
    const transactions = [
      txn({
        id: 'before',
        date: '2026-05-10T10:00:00.000Z',
        amount: 500,
        type: 'purchase',
      }),
      txn({
        id: 'after',
        date: '2026-05-20T10:00:00.000Z',
        amount: 200,
        type: 'purchase',
      }),
    ]

    const periods = buildCardPeriods(card, transactions, { periods: 3, asOf })
    const last = periods[periods.length - 1]!
    const allTxnIds = periods.flatMap((p) => p.transactions.map((t) => t.originalTxnId))

    expect(allTxnIds).toEqual(['after'])
    expect(last.openingBalance).toBe(1_000)
    expect(Number(last.statement.endingBalance)).toBe(1_200)
  })

  it('açılış tarihinden önce dönemlerde devreden bakiye projeksiyona yansımaz', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 6_200,
      openingDate: '2026-05-15T00:00:00.000Z',
    }
    const periods = buildCardPeriods(card, [], { periods: 4, asOf })
    const projections = projectCardPeriodDebts(card, [], { periods, asOf })
    const beforeOpening = projections.filter(
      (_, i) => periods[i]!.openingBalance === 0,
    )
    const afterOpening = projections.find((_, i) => periods[i]!.openingBalance > 0)

    expect(beforeOpening.every((p) => p.carriedIn === 0)).toBe(true)
    expect(afterOpening?.carriedIn).toBe(6_200)
  })

  it('extendForFutureInstallments: gelecek taksit dönemleri üretilir', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
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
    const base = buildCardPeriods(baseCard, transactions, { periods: 6, asOf })
    const extended = buildCardPeriods(baseCard, transactions, {
      periods: 6,
      asOf,
      extendForFutureInstallments: true,
    })
    expect(extended.length).toBeGreaterThan(base.length)
    const futureInstallments = extended.filter((p) =>
      p.transactions.some((t) => (t.installmentIndex ?? 0) > 1),
    )
    expect(futureInstallments.length).toBeGreaterThan(0)
    expect(defaultCardStatementPeriodCutoff(extended, asOf)).toBe(
      base[base.length - 2]!.cutoffDate,
    )
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

describe('earliestCreditCardTransactionDate', () => {
  it('kartın en erken hareket tarihini döner', () => {
    const earliest = earliestCreditCardTransactionDate('card-1', [
      txn({ id: 'b', date: '2026-06-01T00:00:00.000Z', amount: 1, type: 'purchase' }),
      txn({ id: 'a', date: '2026-05-10T00:00:00.000Z', amount: 1, type: 'purchase' }),
    ])
    expect(earliest).toBe('2026-05-10T00:00:00.000Z')
  })
})

describe('isCreditCardOpeningDateOnOrBeforeFirstTxn', () => {
  it('ilk hareket yoksa veya açılış önce/eşitse geçerli', () => {
    expect(isCreditCardOpeningDateOnOrBeforeFirstTxn('2026-05-15T00:00:00.000Z', undefined)).toBe(
      true,
    )
    expect(
      isCreditCardOpeningDateOnOrBeforeFirstTxn(
        '2026-05-15T00:00:00.000Z',
        '2026-05-20T00:00:00.000Z',
      ),
    ).toBe(true)
    expect(
      isCreditCardOpeningDateOnOrBeforeFirstTxn(
        '2026-05-21T00:00:00.000Z',
        '2026-05-20T00:00:00.000Z',
      ),
    ).toBe(false)
  })
})

describe('isCreditCardTxnDateOnOrAfterOpening', () => {
  it('openingDate yoksa tüm tarihler geçerli', () => {
    expect(isCreditCardTxnDateOnOrAfterOpening(baseCard, '2020-01-01T00:00:00.000Z')).toBe(true)
  })

  it('açılış günü ve sonrası geçerli', () => {
    const card: CreditCard = { ...baseCard, openingDate: '2026-05-15T00:00:00.000Z' }
    expect(isCreditCardTxnDateOnOrAfterOpening(card, '2026-05-14T23:59:59.000Z')).toBe(false)
    expect(isCreditCardTxnDateOnOrAfterOpening(card, '2026-05-15T00:00:00.000Z')).toBe(true)
    expect(isCreditCardTxnDateOnOrAfterOpening(card, '2026-06-01T00:00:00.000Z')).toBe(true)
  })
})

describe('cardPeriodHasSelectableDates', () => {
  it('açılış tarihinden önceki dönemde seçilebilir gün yok', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const card: CreditCard = {
      ...baseCard,
      openingDate: '2026-05-15T00:00:00.000Z',
    }
    const periods = buildCardPeriods(card, [], { periods: 4, asOf })
    const beforeOpening = periods.find(
      (p) => cardPeriodBounds(p).periodEndExclusiveIso.slice(0, 10) <= card.openingDate!.slice(0, 10),
    )!
    const bounds = cardPeriodBounds(beforeOpening)

    expect(cardPeriodHasSelectableDates(bounds, asOf)).toBe(true)
    expect(cardPeriodHasSelectableDates(bounds, asOf, card.openingDate)).toBe(false)
  })

  it('açılış tarihi dönem içindeyse kısmi aralık seçilebilir', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const card: CreditCard = {
      ...baseCard,
      openingDate: '2026-05-15T00:00:00.000Z',
    }
    const periods = buildCardPeriods(card, [], { periods: 4, asOf })
    const openingKey = card.openingDate!.slice(0, 10)
    const openingPeriod = periods.find((p) => {
      const bounds = cardPeriodBounds(p)
      return (
        openingKey >= bounds.periodStartIso.slice(0, 10) &&
        openingKey < bounds.periodEndExclusiveIso.slice(0, 10)
      )
    })!
    const bounds = cardPeriodBounds(openingPeriod)

    expect(cardPeriodHasSelectableDates(bounds, asOf, card.openingDate)).toBe(true)
  })
})

describe('defaultCardTxnDateInPeriod', () => {
  it('açılış tarihinden önceki varsayılanı açılış gününe çeker', () => {
    const bounds = {
      periodStartIso: '2026-05-15T00:00:00.000Z',
      periodEndExclusiveIso: '2026-06-15T00:00:00.000Z',
    }
    const asOf = new Date('2026-05-18T12:00:00.000Z')
    const openingDate = '2026-05-20T00:00:00.000Z'

    expect(defaultCardTxnDateInPeriod(bounds, asOf, openingDate).slice(0, 10)).toBe(
      '2026-05-20',
    )
  })
})

describe('defaultCardStatementPeriodCutoff', () => {
  it('açık dönemde bir önceki kapalı dönemi seçer', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const periods = buildCardPeriods(baseCard, [], { periods: 6, asOf })
    expect(defaultCardStatementPeriodCutoff(periods, asOf)).toBe(
      periods[periods.length - 2]!.cutoffDate,
    )
  })

  it('listedeki tüm kesimler geçtiyse son dönemi seçer', () => {
    const periods = buildCardPeriods(baseCard, [], {
      periods: 2,
      asOf: new Date('2026-03-01T12:00:00.000Z'),
    }).slice(0, 2)
    const asOf = new Date('2026-04-20T12:00:00.000Z')
    expect(defaultCardStatementPeriodCutoff(periods, asOf)).toBe(
      periods[periods.length - 1]!.cutoffDate,
    )
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

  it('açılış bakiyesi yalnızca açılış tarihinden itibaren borca dahil edilir', () => {
    const asOf = new Date('2026-05-22T12:00:00.000Z')
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 6_200,
      openingDate: '2026-05-15T00:00:00.000Z',
    }
    const totals = cardCommittedTotal(card, [], asOf)
    expect(Number(totals.ending)).toBe(6_200)
    expect(Number(totals.committed)).toBe(6_200)

    const beforeOpening = cardCommittedTotal(
      card,
      [],
      new Date('2026-05-10T12:00:00.000Z'),
    )
    expect(Number(beforeOpening.ending)).toBe(0)
    expect(Number(beforeOpening.committed)).toBe(0)
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
    const interestTotal = second!.lateInterest + second!.purchaseInterest + second!.cashAdvanceInterest
    expect(interestTotal).toBeGreaterThan(0)
    expect(second!.carriedIn).toBeGreaterThan(5000)
  })

  it('asgari ödenince gecikme yok; kalan bakiyeye akdi faiz yansır', () => {
    const card: CreditCard = {
      ...baseCard,
      limit: 200_000,
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0455,
    }
    const txns = [
      txn({
        id: 'buy',
        date: '2026-02-05T12:00:00.000Z',
        amount: 10_000,
        type: 'purchase',
        repaymentTotal: 12_000,
      }),
      txn({
        id: 'pay',
        date: '2026-02-20T12:00:00.000Z',
        amount: 5_000,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-05-26T12:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 8, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })

    const feb = projections.find((p) => p.cutoffDate.startsWith('2026-02'))
    const mar = projections.find((p) => p.cutoffDate.startsWith('2026-03'))

    expect(feb!.endingBalance).toBeCloseTo(12_000, 0)
    expect(feb!.paid).toBe(true)
    expect(mar!.lateInterest).toBe(0)
    expect(mar!.purchaseInterest).toBeGreaterThan(0)
    expect(mar!.carriedIn).toBeGreaterThan(7000)
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

  it('kesim sonrası ödeme yalnızca ilgili dönemin ödeme toplamına yazılır', () => {
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 25_000,
      openingDate: '2026-01-15T00:00:00.000Z',
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0355,
    }
    const txns = [
      txn({
        id: 'pay',
        date: '2026-04-24T19:25:41.055Z',
        amount: 10_000,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-05-26T12:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 8, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })
    const aprilDue = projections.find((p) => p.dueDate.startsWith('2026-04'))
    const mayDue = projections.find((p) => p.dueDate.startsWith('2026-05'))

    expect(Number(aprilDue?.paymentsInWindow)).toBe(10_000)
    expect(mayDue?.paymentsInWindow).toBeUndefined()
  })

  it('kesim sonrası ödeme sonraki dönem taşınan borçtan tekrar düşülmez', () => {
    const card: CreditCard = {
      ...baseCard,
      openingBalance: 25_000,
      openingDate: '2026-01-15T00:00:00.000Z',
      purchaseAprMonthly: 0.0375,
      lateAprMonthly: 0.0355,
      taxRateMonthly: 0.25,
      rateMode: 'balanceTier',
    }
    const txns = [
      txn({
        id: 'pay',
        date: '2026-04-24T19:25:41.055Z',
        amount: 10_000,
        type: 'payment',
      }),
    ]
    const asOf = new Date('2026-05-26T12:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 12, asOf })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf })
    const april = projections.find((p) => p.dueDate.startsWith('2026-04'))
    const may = projections.find((p) => p.dueDate.startsWith('2026-05'))

    expect(april).toBeDefined()
    expect(may).toBeDefined()
    expect(Number(april!.paymentsInWindow)).toBe(10_000)
    expect(may!.carriedIn).toBeGreaterThan(15_000)
    expect(may!.endingBalance).toBeGreaterThan(15_000)
    expect(may!.endingBalance).toBeGreaterThan(may!.carriedIn * 0.9)
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
