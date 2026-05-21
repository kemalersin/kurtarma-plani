import type {
  LocaleSettings,
  SupportedCurrency,
  SupportedLocale,
  SupportedTimeZone,
} from '@/core/types/profile'

export const DEFAULT_LOCALE_SETTINGS: LocaleSettings = {
  locale: 'tr-TR',
  currency: 'TRY',
  timeZone: 'Europe/Istanbul',
  dateFormat: 'dd.MM.yyyy',
}

interface Option<T extends string> {
  value: T
  label: string
}

export const SUPPORTED_LOCALES: ReadonlyArray<Option<SupportedLocale>> = [
  { value: 'tr-TR', label: 'Türkçe (Türkiye)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'fr-FR', label: 'Français (France)' },
]

export const SUPPORTED_CURRENCIES: ReadonlyArray<Option<SupportedCurrency>> = [
  { value: 'TRY', label: '₺ Türk Lirası (TRY)' },
  { value: 'USD', label: '$ ABD Doları (USD)' },
  { value: 'EUR', label: '€ Euro (EUR)' },
  { value: 'GBP', label: '£ Sterlin (GBP)' },
]

export const SUPPORTED_TIMEZONES: ReadonlyArray<Option<SupportedTimeZone>> = [
  { value: 'Europe/Istanbul', label: 'İstanbul (Europe/Istanbul)' },
  { value: 'Europe/London', label: 'Londra (Europe/London)' },
  { value: 'Europe/Berlin', label: 'Berlin (Europe/Berlin)' },
  { value: 'Europe/Paris', label: 'Paris (Europe/Paris)' },
  { value: 'America/New_York', label: 'New York (America/New_York)' },
  { value: 'UTC', label: 'UTC' },
]

export const SUPPORTED_DATE_FORMATS: ReadonlyArray<Option<string>> = [
  { value: 'dd.MM.yyyy', label: 'gg.aa.yyyy (örn. 21.05.2026)' },
  { value: 'dd/MM/yyyy', label: 'gg/aa/yyyy (örn. 21/05/2026)' },
  { value: 'yyyy-MM-dd', label: 'yyyy-aa-gg (örn. 2026-05-21)' },
  { value: 'MM/dd/yyyy', label: 'aa/gg/yyyy (örn. 05/21/2026)' },
]
