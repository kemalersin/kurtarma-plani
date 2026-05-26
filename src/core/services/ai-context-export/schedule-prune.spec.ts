import { describe, expect, it } from 'vitest'
import {
  trimCreditCardInstallmentSchedulesForAi,
  trimCreditCardPeriodRowsForAi,
  trimCreditCardPeriodSchedulesForAi,
  trimLoanInstallmentRowsForAi,
  trimPeriodRowsForAi,
} from '@/core/services/ai-context-export/schedule-prune'

describe('schedule-prune', () => {
  it('trimPeriodRowsForAi ödenmiş dönemleri çıkarır', () => {
    const rows = [
      { status: 'paid' as const, id: 1 },
      { status: 'overdue' as const, id: 2 },
      { status: 'upcoming' as const, id: 3 },
    ]
    expect(trimPeriodRowsForAi(rows).map((r) => r.id)).toEqual([2, 3])
  })

  it('trimCreditCardPeriodSchedulesForAi boş kartları çıkarır', () => {
    const asOf = '2026-05-26T00:00:00.000Z'
    const out = trimCreditCardPeriodSchedulesForAi([
      {
        cardId: 'c1',
        label: 'Kart',
        currency: 'TRY',
        periods: [{ status: 'paid' } as never],
      },
      {
        cardId: 'c2',
        label: 'Kart 2',
        currency: 'TRY',
        periods: [
          {
            status: 'upcoming',
            dueDate: { iso: '2026-06-25T00:00:00.000Z', formatted: '25.06.2026' },
          } as never,
        ],
      },
    ], asOf)
    expect(out).toHaveLength(1)
    expect(out[0]?.cardId).toBe('c2')
  })

  it('trimCreditCardPeriodRowsForAi geçmiş ay vadelerini çıkarır', () => {
    const rows = trimCreditCardPeriodRowsForAi(
      [
        {
          status: 'overdue',
          dueDate: { iso: '2026-04-25T00:00:00.000Z', formatted: '25.04.2026' },
        } as never,
        {
          status: 'upcoming',
          dueDate: { iso: '2026-05-25T00:00:00.000Z', formatted: '25.05.2026' },
        } as never,
      ],
      '2026-05-26T00:00:00.000Z',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.dueDate.iso).toContain('2026-05')
  })

  it('trimCreditCardInstallmentSchedulesForAi yalnızca gelecek taksitleri bırakır', () => {
    const out = trimCreditCardInstallmentSchedulesForAi([
      {
        cardId: 'c1',
        transactionId: 't1',
        label: 'Telefon',
        currency: 'TRY',
        originalDate: { iso: '2026-01-01', formatted: '01.01.2026' },
        transactionAmount: { value: '1000', formatted: '1.000', currency: 'TRY' },
        repaymentTotal: { value: '1000', formatted: '1.000', currency: 'TRY' },
        installmentCount: 3,
        accruedThroughIndex: 1,
        installments: [
          { index: 1, status: 'accrued' as const, accrualDate: { iso: '', formatted: '' }, amount: { value: '0', formatted: '0', currency: 'TRY' } },
          { index: 2, status: 'future' as const, accrualDate: { iso: '', formatted: '' }, amount: { value: '0', formatted: '0', currency: 'TRY' } },
        ],
      },
    ])
    expect(out[0]?.installments).toHaveLength(1)
    expect(out[0]?.installments[0]?.status).toBe('future')
  })

  it('trimLoanInstallmentRowsForAi geçmiş ay vadelerini çıkarır', () => {
    const rows = trimLoanInstallmentRowsForAi(
      [
        {
          index: 1,
          status: 'overdue',
          dueDate: { iso: '2026-03-01T00:00:00.000Z', formatted: '01.03.2026' },
          installment: { value: '1', formatted: '1', currency: 'TRY' },
          principal: { value: '1', formatted: '1', currency: 'TRY' },
          interest: { value: '0', formatted: '0', currency: 'TRY' },
          beginningBalance: { value: '1', formatted: '1', currency: 'TRY' },
          endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
        },
        {
          index: 2,
          status: 'unpaid',
          dueDate: { iso: '2026-05-01T00:00:00.000Z', formatted: '01.05.2026' },
          installment: { value: '1', formatted: '1', currency: 'TRY' },
          principal: { value: '1', formatted: '1', currency: 'TRY' },
          interest: { value: '0', formatted: '0', currency: 'TRY' },
          beginningBalance: { value: '1', formatted: '1', currency: 'TRY' },
          endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
        },
      ],
      '2026-05-26T00:00:00.000Z',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.index).toBe(2)
  })
})
