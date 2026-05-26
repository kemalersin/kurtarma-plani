import { describe, expect, it } from 'vitest'
import { buildLoanSchedules } from '@/core/services/ai-context-export/loan-schedules'
import { createAiContextFormatters } from '@/core/services/ai-context-export/format-helpers'
import type { Loan, LoanPayment } from '@/core/types/entities'

const fmt = createAiContextFormatters({
  locale: 'tr-TR',
  currency: 'TRY',
  timeZone: 'Europe/Istanbul',
  dateFormat: 'dd.MM.yyyy',
})

describe('buildLoanSchedules', () => {
  it('geciken taksitlerde gecikme yükünü rollup satırına yansıtır', () => {
    const asOf = '2026-03-15T00:00:00.000Z'
    const schedules = buildLoanSchedules({
      loans: [
        {
          id: 'l1',
          name: 'Kredi',
          bankId: 'b1',
          currency: 'TRY',
          principal: 20_000,
          termMonths: 4,
          interestRate: 0.04,
          interestPeriod: 'monthly',
          firstInstallmentDate: '2026-03-01T00:00:00.000Z',
          createdAt: asOf,
          updatedAt: asOf,
        } as Loan,
      ],
      loanPayments: [] as LoanPayment[],
      bankMap: new Map([['b1', { id: 'b1', name: 'Banka', createdAt: asOf, updatedAt: asOf }]]),
      fmt,
      asOf,
    })

    const rows = schedules[0]!.installments
    expect(Number(schedules[0]!.remainingDebtBreakdown.accruedLateFees.value)).toBeGreaterThan(0)
    expect(rows).toHaveLength(4)
    expect(Number(rows[1]!.installment.value)).toBeGreaterThan(Number(rows[0]!.installment.value))
    expect(Number(rows[2]!.installment.value)).toBe(Number(rows[0]!.installment.value))
  })
})
