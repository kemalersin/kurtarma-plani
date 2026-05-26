import { describe, expect, it } from 'vitest'
import { resolveProposalData } from '@/features/ai/proposals/resolve'

describe('resolveProposalData', () => {
  it('resolves bankRef to bankId', () => {
    const lookup = {
      banksByName: new Map(),
      accountsByName: new Map(),
      cashRegistersByName: new Map(),
      incomeTypesByName: new Map(),
      expenseTypesByName: new Map(),
      loansByName: new Map(),
      cardsByName: new Map(),
      cashAdvanceAccountsByName: new Map(),
      installmentAdvancesByName: new Map(),
      refToId: new Map([['b1', 'bank-123']]),
    }

    const resolved = resolveProposalData(
      'installmentCashAdvance',
      {
        name: 'Avans',
        bankRef: 'b1',
        principal: 25000,
        termMonths: 12,
        startDate: '2025-01-10',
        firstInstallmentDate: '2025-02-10',
        interestRate: 0.0425,
        interestPeriod: 'monthly',
      },
      lookup,
      { currency: 'TRY' },
    )

    expect(resolved.bankId).toBe('bank-123')
    expect(resolved.currency).toBe('TRY')
    expect(resolved.startDate).toContain('2025-01-10')
  })

  it('resolves bankName for dependent entity', () => {
    const lookup = {
      banksByName: new Map([['garanti bbva', 'bank-garanti']]),
      accountsByName: new Map(),
      cashRegistersByName: new Map(),
      incomeTypesByName: new Map(),
      expenseTypesByName: new Map(),
      loansByName: new Map(),
      cardsByName: new Map(),
      cashAdvanceAccountsByName: new Map(),
      installmentAdvancesByName: new Map(),
      refToId: new Map(),
    }

    const resolved = resolveProposalData(
      'installmentCashAdvance',
      {
        name: 'Avans',
        bankName: 'Garanti BBVA',
        principal: 1000,
        termMonths: 3,
        startDate: '2025-01-01',
        firstInstallmentDate: '2025-02-01',
        interestRate: 0.04,
        interestPeriod: 'monthly',
      },
      lookup,
      { currency: 'TRY' },
    )

    expect(resolved.bankId).toBe('bank-garanti')
  })

  it('resolves cardName for creditCardTransaction', () => {
    const lookup = {
      banksByName: new Map(),
      accountsByName: new Map(),
      cashRegistersByName: new Map(),
      incomeTypesByName: new Map(),
      expenseTypesByName: new Map(),
      loansByName: new Map(),
      cardsByName: new Map([['bonus kart', 'card-bonus']]),
      cashAdvanceAccountsByName: new Map(),
      installmentAdvancesByName: new Map(),
      refToId: new Map(),
    }

    const resolved = resolveProposalData(
      'creditCardTransaction',
      {
        cardName: 'Bonus Kart',
        date: '2025-03-15',
        type: 'purchase',
        amount: 890,
      },
      lookup,
    )

    expect(resolved.cardId).toBe('card-bonus')
    expect(resolved.type).toBe('purchase')
    expect(resolved.date).toContain('2025-03-15')
  })

  it('resolves cashAdvanceAccountName for cashAdvanceTransaction', () => {
    const lookup = {
      banksByName: new Map(),
      accountsByName: new Map(),
      cashRegistersByName: new Map(),
      incomeTypesByName: new Map(),
      expenseTypesByName: new Map(),
      loansByName: new Map(),
      cardsByName: new Map(),
      cashAdvanceAccountsByName: new Map([['nakit avans', 'ca-1']]),
      installmentAdvancesByName: new Map(),
      refToId: new Map(),
    }

    const resolved = resolveProposalData(
      'cashAdvanceTransaction',
      {
        cashAdvanceAccountName: 'Nakit avans',
        date: '2025-04-01',
        type: 'draw',
        amount: 5000,
      },
      lookup,
    )

    expect(resolved.accountId).toBe('ca-1')
  })
})
