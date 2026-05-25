import { formatInTimeZone } from 'date-fns-tz'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type { LocaleSettings } from '@/core/types/profile'
import type { DateField, MoneyField } from '@/core/services/ai-context-export/types'

export interface AiContextFormatters {
  formatCurrency(amount: number | string, currency?: string): string
  formatDate(iso: string): string
}

export function createAiContextFormatters(settings: LocaleSettings): AiContextFormatters {
  const locale = settings.locale ?? 'tr-TR'
  const timeZone = settings.timeZone ?? 'Europe/Istanbul'
  const dateFormat = settings.dateFormat ?? DEFAULT_LOCALE_SETTINGS.dateFormat
  const defaultCurrency = settings.currency ?? 'TRY'

  function formatCurrency(amount: number | string, currency?: string): string {
    const ccy = currency ?? defaultCurrency
    const maxFractionDigits = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: ccy,
    }).resolvedOptions().maximumFractionDigits
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: maxFractionDigits ?? 2,
    }).format(typeof amount === 'string' ? Number(amount) : amount)
  }

  function formatDate(iso: string): string {
    return formatInTimeZone(iso, timeZone, dateFormat)
  }

  return { formatCurrency, formatDate }
}

export function moneyField(
  value: string | number,
  currency: string,
  fmt: AiContextFormatters,
): MoneyField {
  const str = String(value)
  return {
    value: str,
    formatted: fmt.formatCurrency(str, currency),
    currency,
  }
}

export function dateField(iso: string, fmt: AiContextFormatters): DateField {
  return { iso, formatted: fmt.formatDate(iso) }
}
