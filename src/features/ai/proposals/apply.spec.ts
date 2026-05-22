import { describe, expect, it } from 'vitest'
import type { Bank } from '@/core/types/entities'
import { applyProposalBundle } from '@/features/ai/proposals/apply'
import type { AiProposalBundle } from '@/features/ai/proposals/types'

describe('applyProposalBundle', () => {
  it('creates items in dependency order using refs', async () => {
    const saved: Array<{ type: string; data: Record<string, unknown> }> = []
    const banks: Bank[] = []

    const bundle: AiProposalBundle = {
      version: 1,
      items: [
        {
          ref: 'b1',
          type: 'bank',
          data: { name: 'Garanti BBVA' },
        },
        {
          ref: 'ica1',
          type: 'installmentCashAdvance',
          data: {
            name: 'Taksitli avans',
            bankRef: 'b1',
            principal: 25000,
            termMonths: 12,
            startDate: '2025-01-10',
            firstInstallmentDate: '2025-02-10',
            interestRate: 0.0425,
            interestPeriod: 'monthly',
          },
        },
      ],
    }

    const result = await applyProposalBundle(bundle, {
      currency: 'TRY',
      load: async () => [],
      save: async (type, draft) => {
        const data = draft as Record<string, unknown>
        const row = {
          id: `id-${saved.length + 1}`,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          ...data,
        }
        saved.push({ type, data })
        if (type === 'bank') {
          banks.push({
            id: row.id,
            name: String(data.name),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          })
        }
        return row as never
      },
      getLists: () => ({
        banks,
        accounts: [],
        cashRegisters: [],
        incomeTypes: [],
        expenseTypes: [],
        loans: [],
        cards: [],
        cashAdvanceAccounts: [],
        installmentAdvances: [],
      }),
    })

    expect(result.errors).toEqual([])
    expect(result.created).toHaveLength(2)
    expect(saved[1]?.data.bankId).toBe('id-1')
  })
})
