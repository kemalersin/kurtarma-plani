import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import {
  formatPickerDayjsDisplay,
  formatPickerRangeDisplay,
  normalizePickerDayjs,
} from '@/core/util/picker-display'

describe('picker-display', () => {
  it('normalizePickerDayjs geçerli dayjs ve ISO string döndürür', () => {
    const value = dayjs('2026-05-26')
    expect(normalizePickerDayjs(value)?.format('YYYY-MM-DD')).toBe('2026-05-26')
    expect(normalizePickerDayjs('2026-05-26')?.format('YYYY-MM-DD')).toBe('2026-05-26')
    expect(normalizePickerDayjs(null)).toBeNull()
    expect(normalizePickerDayjs('invalid')).toBeNull()
  })

  it('formatPickerDayjsDisplay profil formatına göre metin üretir', () => {
    expect(formatPickerDayjsDisplay(dayjs('2026-05-26'), 'DD.MM.YYYY')).toBe('26.05.2026')
    expect(formatPickerDayjsDisplay(null, 'DD.MM.YYYY')).toBe('')
  })

  it('formatPickerRangeDisplay aralığı birleştirir', () => {
    const range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs('2026-05-01'), dayjs('2026-05-26')]
    expect(formatPickerRangeDisplay(range, 'DD.MM.YYYY')).toBe('01.05.2026 – 26.05.2026')
  })
})
