import { describe, expect, it } from 'vitest'
import { buildAiFinanceSnapshot } from '@/features/ai/snapshot'
import { buildAiContextDocument } from '@/core/services/ai-context-export/build-document'
import { computeSettledDebtIndex } from '@/core/services/ai-context-export/settled-debts'
import type { ProfileMeta } from '@/core/types/profile'

const profile: ProfileMeta = {
  id: 'p1',
  name: 'Test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  localeSettings: {
    locale: 'tr-TR',
    currency: 'TRY',
    timeZone: 'Europe/Istanbul',
    dateFormat: 'dd.MM.yyyy',
  },
  password: { enabled: false },
}

const closedLoanRows = [
  {
    id: 'l1',
    type: 'loan' as const,
    updatedAt: '2026-01-01T00:00:00.000Z',
    data: {
      id: 'l1',
      name: 'Konut',
      bankId: 'b1',
      currency: 'TRY',
      principal: 20_000,
      termMonths: 2,
      interestRate: 0,
      interestPeriod: 'monthly',
      firstInstallmentDate: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  },
  {
    id: 'p1',
    type: 'loanPayment' as const,
    updatedAt: '2026-01-01T00:00:00.000Z',
    data: {
      id: 'p1',
      loanId: 'l1',
      installmentIndex: 1,
      paidDate: '2026-01-05T00:00:00.000Z',
      paidAmount: 10_000,
      scheduledAmount: 10_000,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  },
  {
    id: 'p2',
    type: 'loanPayment' as const,
    updatedAt: '2026-01-01T00:00:00.000Z',
    data: {
      id: 'p2',
      loanId: 'l1',
      installmentIndex: 2,
      paidDate: '2026-02-05T00:00:00.000Z',
      paidAmount: 10_000,
      scheduledAmount: 10_000,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  },
]

describe('computeSettledDebtIndex', () => {
  it('tüm taksitleri ödenmiş krediyi kapanmış sayar', () => {
    const settled = computeSettledDebtIndex(
      {
        loans: [closedLoanRows[0]!.data as never],
        loanPayments: [closedLoanRows[1]!.data as never, closedLoanRows[2]!.data as never],
        installmentAdvances: [],
        installmentAdvancePayments: [],
        creditCards: [],
        creditCardTransactions: [],
        cashAdvanceAccounts: [],
        cashAdvanceTransactions: [],
      },
      { asOf: '2026-03-01T00:00:00.000Z' },
    )
    expect(settled.loanIds.has('l1')).toBe(true)
  })
})

describe('settled debt AI exclusion', () => {
  it('buildAiContextDocument kapanmış krediyi dışlar', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: closedLoanRows,
    })
    expect(doc.sections.loans).toHaveLength(0)
    expect(doc.schedules.loans).toHaveLength(0)
    expect(doc.omitted.settledDebtCount).toBe(1)
  })

  it('buildAiFinanceSnapshot kapanmış kredi entity ve schedule göndermez', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      closedLoanRows,
      profile.localeSettings,
    )
    expect(snap.entities.some((e) => e.type === 'loan')).toBe(false)
    expect(snap.entities.some((e) => e.type === 'loanPayment')).toBe(false)
    expect(snap.derived?.loanSchedules).toEqual([])
    expect(snap.derived?.contextVersion).toBe(11)
  })
})
