import { describe, expect, it } from 'vitest'
import { cashflowStatusTag } from './cashflowLabels'

describe('cashflowStatusTag', () => {
  it('gerçekleşen kayıtta yeşil etiket döner', () => {
    expect(
      cashflowStatusTag({
        plannedDate: '2026-01-01T00:00:00.000Z',
        actualDate: '2026-01-05T00:00:00.000Z',
      }),
    ).toEqual({ color: 'success', label: 'Gerçekleşti' })
  })

  it('yinelenen kayıtta mor etiket döner', () => {
    expect(
      cashflowStatusTag({
        plannedDate: '2026-01-01T00:00:00.000Z',
        recurrence: 'monthly',
      }),
    ).toEqual({ color: 'purple', label: 'Yinelenen · Aylık' })
  })
})
