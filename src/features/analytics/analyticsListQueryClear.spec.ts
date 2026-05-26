import { describe, expect, it, vi } from 'vitest'
import {
  analyticsRangeQueryActive,
  clearAnalyticsListRouteQuery,
} from '@/features/analytics/analyticsListQueryClear'

describe('analyticsListQueryClear', () => {
  it('analyticsRangeQueryActive URL aralığı varsa true döner', () => {
    expect(
      analyticsRangeQueryActive({
        query: { from: '2026-01-01' },
      } as never),
    ).toBe(true)
    expect(analyticsRangeQueryActive({ query: {} } as never)).toBe(false)
  })

  it('clearAnalyticsListRouteQuery liste ve paylaşılan anahtarları tek replace ile siler', () => {
    const replace = vi.fn()
    clearAnalyticsListRouteQuery({
      route: {
        path: '/analytics',
        hash: '',
        query: {
          status_debtInstallments: 'paid',
          amountFrom_debtInstallments: '100',
          bank: 'b1',
          from: '2026-01-01',
          to: '2026-12-31',
          cardDue: 'min',
        },
      } as never,
      router: { replace } as never,
      stateKey: 'debtInstallments',
      listFilters: [
        { kind: 'select', key: 'status', label: 'Durum', options: [], getValue: () => '' },
        { kind: 'numberRange', key: 'amount', label: 'Tutar', getValue: () => 0 },
      ],
      sharedQueryKeys: ['bank', 'from', 'to'],
    })

    expect(replace).toHaveBeenCalledOnce()
    expect(replace.mock.calls[0]?.[0]?.query).toEqual({ cardDue: 'min' })
  })
})
