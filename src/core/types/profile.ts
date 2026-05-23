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

import type { SyncConfig } from '@/core/types/sync'
import type { UpdateCheckConfig } from '@/core/types/update-check'

export interface AppMeta {
  schemaVersion: number
  appVersion: string
  createdAt: string
  updatedAt: string
  activeProfileId?: string
  /** Senkron dosyası yazan cihazlar arası benzersiz kimlik. */
  deviceId?: string
  /** Otomatik senkron ayarları (dosya handle ayrı store'da — bkz. docs/SYNC.md). */
  sync?: SyncConfig
  /** GitHub sürüm kontrolü tercihleri. */
  updateCheck?: UpdateCheckConfig
}
