/** Locale'e göre binlik / ondalık ayırıcılar (`Intl` formatToParts). */
export function getLocaleSeparators(locale: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.89)
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  }
}

/** Para birimi için `Intl` ondalık hane üst sınırı. */
export function getCurrencyMaxFractionDigits(locale: string, currency: string): number {
  return (
    new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

/** Ham yüzde alanları (0–100); locale ondalık hane üst sınırı. */
export function getPercentMaxFractionDigits(locale: string): number {
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).resolvedOptions().maximumFractionDigits ?? 2
  )
}

/** 0–1 kesir oranı → locale yüzde metni (örn. 0,0425 → «4,25%»). */
export function formatFractionAsPercent(fraction: number, locale: string): string {
  const maxFd = getPercentMaxFractionDigits(locale)
  const body = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFd,
  }).format(fraction * 100)
  return `${body}%`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** InputNumber `parser`: görünen metni sayıya çevirir. */
export function parseLocaleDecimalInput(
  display: string | undefined,
  locale: string,
): number | undefined {
  if (display == null || display === '') return undefined
  const { decimal, group } = getLocaleSeparators(locale)
  const cleaned = display
    .trim()
    .replace(new RegExp(escapeRegExp(group), 'g'), '')
    .replace(decimal, '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

/** InputNumber `formatter`: sayıyı locale biçiminde gösterir. */
export function formatLocaleDecimalInput(
  value: number | string | undefined,
  locale: string,
  maxFractionDigits: number,
  useGrouping = true,
): string {
  if (value === undefined || value === null || value === '') return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
    useGrouping,
  }).format(n)
}
