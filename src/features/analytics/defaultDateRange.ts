import { addMonths, startOfMonth, subMonths } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import type { AnalyticsDateRange } from '@/features/analytics/reports'

const DEFAULT_TIME_ZONE = 'Europe/Istanbul'

/**
 * Analiz sayfası varsayılan tarih aralığı.
 * Başlangıç: profil timezone'unda bir önceki ayın ilk günü.
 * Bitiş: bugünden 6 ay sonrası (aynı timezone).
 */
export function defaultAnalyticsDateRange(
  timeZone = DEFAULT_TIME_ZONE,
  ref = new Date(),
): AnalyticsDateRange {
  const zonedNow = toZonedTime(ref, timeZone)
  const fromDate = startOfMonth(subMonths(zonedNow, 1))
  const toDate = addMonths(zonedNow, 6)
  return {
    from: formatInTimeZone(fromDate, timeZone, 'yyyy-MM-dd'),
    to: formatInTimeZone(toDate, timeZone, 'yyyy-MM-dd'),
  }
}

/** Eski varsayılan (bugünden ±6 ay, UTC gün dilimi) — URL göçü için. */
export function legacyDefaultAnalyticsDateRange(ref = new Date()): AnalyticsDateRange {
  const back = new Date(ref)
  back.setMonth(back.getMonth() - 6)
  const fwd = new Date(ref)
  fwd.setMonth(fwd.getMonth() + 6)
  return {
    from: back.toISOString().slice(0, 10),
    to: fwd.toISOString().slice(0, 10),
  }
}

export function isLegacyDefaultAnalyticsDateRange(
  from: string,
  to: string,
  ref = new Date(),
): boolean {
  if (!from || !to) return false
  const legacy = legacyDefaultAnalyticsDateRange(ref)
  return from === legacy.from && to === legacy.to
}
