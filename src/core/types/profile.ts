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
  hash?: string
  salt?: string
  iterations?: number
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
