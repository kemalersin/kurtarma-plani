import { describe, expect, it } from 'vitest'
import {
  PROPOSABLE_ENTITY_SCHEMAS,
  validateProposableDraft,
} from '@/features/ai/proposals/entity-schemas'
import { PROPOSABLE_ENTITY_TYPES } from '@/features/ai/proposals/types'

describe('validateProposableDraft', () => {
  it('bank için zorunlu alanı reddeder', () => {
    expect(() => validateProposableDraft('bank', {})).toThrow(/name/)
  })

  it('creditCard için yeni opsiyonel alanları kabul eder', () => {
    const parsed = validateProposableDraft('creditCard', {
      name: 'Bonus',
      bankId: 'b1',
      currency: 'TRY',
      limit: 50000,
      statementCutoffDay: 15,
      paymentDueDay: 25,
      purchaseAprMonthly: 0.0375,
      rateMode: 'fixed',
      cashAdvanceAprMonthly: 0.04,
      cashAdvanceLateAprMonthly: 0.043,
      taxRateMonthly: 0.25,
    })

    expect(parsed.rateMode).toBe('fixed')
    expect(parsed.cashAdvanceAprMonthly).toBe(0.04)
  })

  it('income için hesap veya kasa refine kuralını uygular', () => {
    expect(() =>
      validateProposableDraft('income', {
        currency: 'TRY',
        amount: 100,
        plannedDate: '2025-01-01T00:00:00.000Z',
      }),
    ).toThrow()

    const parsed = validateProposableDraft('income', {
      currency: 'TRY',
      amount: 100,
      plannedDate: '2025-01-01T00:00:00.000Z',
      accountId: 'acc-1',
    })
    expect(parsed.accountId).toBe('acc-1')
  })

  it('account için openingBalance varsayılanını uygular', () => {
    const parsed = validateProposableDraft('account', {
      bankId: 'b1',
      name: 'Vadesiz',
      type: 'checking',
      currency: 'TRY',
      openingDate: '2025-01-01T00:00:00.000Z',
    })
    expect(parsed.openingBalance).toBe(0)
  })
})

describe('PROPOSABLE_ENTITY_SCHEMAS', () => {
  it('tüm proposal tipleri için şema tanımlı', () => {
    for (const type of PROPOSABLE_ENTITY_TYPES) {
      expect(PROPOSABLE_ENTITY_SCHEMAS[type]).toBeDefined()
    }
  })
})
