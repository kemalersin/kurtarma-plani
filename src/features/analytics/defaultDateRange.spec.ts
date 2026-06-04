import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultAnalyticsDateRange, isLegacyDefaultAnalyticsDateRange, legacyDefaultAnalyticsDateRange } from '@/features/analytics/defaultDateRange'

describe('defaultAnalyticsDateRange', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('başlangıcı bir önceki ayın ilk günü, bitişi bugünden 6 ay sonrası yapar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T12:00:00.000Z'))

    expect(defaultAnalyticsDateRange('Europe/Istanbul')).toEqual({
      from: '2026-05-01',
      to: '2026-12-04',
    })
  })

  it('yıl sınırında bir önceki ayı doğru hesaplar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'))

    expect(defaultAnalyticsDateRange('Europe/Istanbul')).toEqual({
      from: '2025-12-01',
      to: '2026-07-15',
    })
  })

  it('eski ±6 ay UTC varsayılanını tanır', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-04T12:00:00.000Z'))
    const legacy = legacyDefaultAnalyticsDateRange()
    expect(isLegacyDefaultAnalyticsDateRange(legacy.from, legacy.to)).toBe(true)
    expect(isLegacyDefaultAnalyticsDateRange('2026-05-01', legacy.to)).toBe(false)
  })
})
