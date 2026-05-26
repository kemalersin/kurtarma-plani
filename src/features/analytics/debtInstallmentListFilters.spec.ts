import { describe, expect, it } from 'vitest'
import { filterDebtInstallmentRows } from '@/features/analytics/debtInstallmentListFilters'
import type { DebtInstallmentRow } from '@/features/analytics/reports'

function row(partial: Partial<DebtInstallmentRow> & Pick<DebtInstallmentRow, 'key'>): DebtInstallmentRow {
  return {
    debtKind: 'loan',
    debtId: 'd1',
    debtName: 'Konut',
    bankId: 'b1',
    bankName: 'Test Bankası',
    installmentIndex: 1,
    dueDate: '2026-06-01T00:00:00.000Z',
    amount: '1000',
    paid: false,
    status: 'upcoming',
    ...partial,
  }
}

describe('filterDebtInstallmentRows', () => {
  const rows = [
    row({ key: '1', status: 'paid', paid: true }),
    row({ key: '2', status: 'overdue', debtName: 'Taşıt' }),
    row({
      key: '3',
      debtKind: 'creditCardStatement',
      status: 'upcoming',
      debtName: 'Kart',
    }),
  ]

  it('durum filtresine göre süzer', () => {
    const filtered = filterDebtInstallmentRows(rows, {
      rawValue: (k) => (k === 'status' ? 'paid' : ''),
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.key).toBe('1')
  })

  it('tür filtresine göre süzer', () => {
    const filtered = filterDebtInstallmentRows(rows, {
      rawValue: (k) => (k === 'kind' ? 'creditCard' : ''),
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.key).toBe('3')
  })

  it('arama metnine göre süzer', () => {
    const filtered = filterDebtInstallmentRows(
      rows,
      { rawValue: () => '' },
      'taşıt',
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.key).toBe('2')
  })
})
