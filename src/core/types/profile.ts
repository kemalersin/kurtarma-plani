export type SupportedLocale = 'tr-TR' | 'en-US' | 'en-GB' | 'de-DE' | 'fr-FR'
export type SupportedCurrency = 'TRY' | 'USD' | 'EUR' | 'GBP'
export type SupportedTimeZone =
  | 'Europe/Istanbul'
  | 'Europe/London'
  | 'Europe/Berlin'
  | 'Europe/Paris'
  | 'America/New_York'
  | 'UTC'

export interface LocaleSettings {
  locale: SupportedLocale
  currency: SupportedCurrency
  timeZone: SupportedTimeZone
  dateFormat: string
}

export interface ProfilePasswordInfo {
  enabled: boolean
  /** Parolasız profilde AES dataKey doğrudan base64 raw olarak saklanır. */
  dataKey?: string
  /** Parolalı profilde AES dataKey, PBKDF2 türetilmiş wrappingKey ile sarılır. */
  wrappedKey?: string
  wrapIv?: string
  salt?: string
  iterations?: number
  /** Yalnızca M1 (legacy) profillerini açmak için saklanır; M2 itibarıyla yeni profillerde yer almaz. */
  legacyHash?: string
}

export interface ProfileMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
  localeSettings: LocaleSettings
  password: ProfilePasswordInfo
}

export interface AppMeta {
  schemaVersion: number
  appVersion: string
  createdAt: string
  updatedAt: string
  activeProfileId?: string
}
