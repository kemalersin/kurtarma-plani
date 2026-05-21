import { describe, expect, it } from 'vitest'
import type { CreditCard, CreditCardTransaction } from '@/core/types/entities'
import { buildCardPeriods } from './cardHelpers'

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

    expect(last.transactions.map((t) => t.id)).toEqual(['new'])
    expect(prev.transactions.map((t) => t.id)).toEqual(['old'])
  })
})
