import { describe, it } from 'vitest'
import { buildCardPeriods, projectCardPeriodDebts } from './src/features/debts/cardHelpers'
import type { CreditCard, CreditCardTransaction } from '@/core/types/entities'

const baseCard: CreditCard = {
  id: 'card-1', bankId: 'b1', name: 'Test', currency: 'TRY', limit: 50_000,
  openingBalance: 0, statementCutoffDay: 15, paymentDueDay: 25,
  purchaseAprMonthly: 0.03, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('log', () => {
  it('installment', () => {
    const card = { ...baseCard, purchaseAprMonthly: 0 }
    const txns: CreditCardTransaction[] = [{
      id: 't', cardId: 'card-1', date: '2026-05-20T10:00:00.000Z', amount: 15_000, type: 'purchase',
      installmentCount: 3, repaymentTotal: 16_292.68, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]
    const today = new Date('2026-05-26T00:00:00.000Z')
    const periods = buildCardPeriods(card, txns, { periods: 12, asOf: new Date('2026-08-31') })
    const projections = projectCardPeriodDebts(card, txns, { periods, asOf: today })
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i]!
      const proj = projections[i]!
      if (proj.accrualLines.length) {
        const inPeriod = p.transactions.filter(t => t.type !== 'payment').reduce((s,t)=>s+t.amount,0)
        console.log('inst', p.label, { opening: p.openingBalance, inPeriod, carriedIn: proj.carriedIn, ending: proj.endingBalance })
      }
    }
  })
  it('revolving', () => {
    const card: CreditCard = { ...baseCard, openingBalance: 25000, openingDate: '2026-01-15T00:00:00.000Z' }
    const asOf = new Date('2026-04-20T12:00:00.000Z')
    const periods = buildCardPeriods(card, [], { periods: 6, asOf })
    const projections = projectCardPeriodDebts(card, [], { periods, asOf })
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i]!
      const proj = projections[i]!
      const inPeriod = p.transactions.filter(t => t.type !== 'payment').reduce((s,t)=>s+t.amount,0)
      if (p.openingBalance > 0 || proj.carriedIn > 0 || inPeriod > 0)
        console.log('rev', p.label, { opening: p.openingBalance, inPeriod, carriedIn: proj.carriedIn, ending: proj.endingBalance, duePast: p.dueDate.slice(0,10) < asOf.toISOString().slice(0,10) })
    }
  })
})
