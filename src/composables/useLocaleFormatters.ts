import { computed } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import { useProfileStore } from '@/stores/profile'

interface LocaleFormatters {
  /** TRY 2 hane, profil locale + currency'e göre `Intl.NumberFormat`. */
  formatCurrency(amount: number | string, currency?: string): string
  /** ISO tarihi profil locale + timezone'e göre kısa format ("dd.MM.yyyy"). */
  formatDate(iso: string): string
  /** ISO tarihi profil locale + timezone'e göre uzun format (gün adı + ay adı). */
  formatDateLong(iso: string): string
  /** Salt sayı (binlik, ondalık) profil locale'ine göre. */
  formatNumber(value: number | string, options?: Intl.NumberFormatOptions): string
}

/**
 * Profil `localeSettings` üzerinden tutar, sayı ve tarih formatlayıcıları.
 *
 * Kural (developer-ux.mdc § Bölgesel biçim):
 *   - Asla ham ISO tarihi gösterme
 *   - Tutar: `Intl.NumberFormat(profile.locale, { currency })`
 *   - Timezone: profil ayarı; varsayılan `Europe/Istanbul`
 */
export function useLocaleFormatters(): LocaleFormatters {
  const profileStore = useProfileStore()

  const settings = computed(() => profileStore.activeProfile?.localeSettings)
  const locale = computed(() => settings.value?.locale ?? 'tr-TR')
  const timeZone = computed(() => settings.value?.timeZone ?? 'Europe/Istanbul')
  const dateFormat = computed(
    () => settings.value?.dateFormat ?? DEFAULT_LOCALE_SETTINGS.dateFormat,
  )
  const defaultCurrency = computed(() => settings.value?.currency ?? 'TRY')

  function formatCurrency(amount: number | string, currency?: string): string {
    const ccy = currency ?? defaultCurrency.value
    const maxFractionDigits = new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: ccy,
    }).resolvedOptions().maximumFractionDigits
    return new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: ccy,
      maximumFractionDigits: maxFractionDigits ?? 2,
    }).format(typeof amount === 'string' ? Number(amount) : amount)
  }

  function formatDate(iso: string): string {
    return formatInTimeZone(iso, timeZone.value, dateFormat.value)
  }

  function formatDateLong(iso: string): string {
    return new Intl.DateTimeFormat(locale.value, {
      timeZone: timeZone.value,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date(iso))
  }

  function formatNumber(
    value: number | string,
    options: Intl.NumberFormatOptions = {},
  ): string {
    return new Intl.NumberFormat(locale.value, options).format(
      typeof value === 'string' ? Number(value) : value,
    )
  }

  return { formatCurrency, formatDate, formatDateLong, formatNumber }
}
