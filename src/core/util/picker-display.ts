import dayjs, { type Dayjs } from 'dayjs'

export function normalizePickerDayjs(
  raw: Dayjs | string | null | undefined,
): Dayjs | null {
  if (raw == null || raw === '') return null
  const parsed = typeof raw === 'string' ? dayjs(raw) : raw
  return parsed.isValid() ? parsed : null
}

export function formatPickerDayjsDisplay(
  raw: Dayjs | string | null | undefined,
  format: string,
): string {
  const parsed = normalizePickerDayjs(raw)
  return parsed ? parsed.format(format) : ''
}

export function formatPickerRangeDisplay(
  raw: [Dayjs, Dayjs] | [string, string] | null | undefined,
  format: string,
): string {
  if (!raw?.[0] || !raw[1]) return ''
  const start = normalizePickerDayjs(raw[0])
  const end = normalizePickerDayjs(raw[1])
  if (!start || !end) return ''
  return `${start.format(format)} – ${end.format(format)}`
}
