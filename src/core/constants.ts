export const APP_NAME = 'Kurtarma Planı'
export const APP_VERSION = __APP_VERSION__
export const APP_BUILD_DATE = __APP_BUILD_DATE__

export const EXPORT_FILE_TYPE = 'kurtarma-plani-export' as const
export const SCHEMA_VERSION = 1

export const META_DB_NAME = 'kurtarma-plani.meta'
export const PROFILE_DB_PREFIX = 'kurtarma-plani.profile.'

export const PBKDF2_ITERATIONS = 310_000
export const PBKDF2_KEY_BITS = 256
export const PBKDF2_HASH = 'SHA-256'

export const AES_KEY_BITS = 256
export const AES_IV_BYTES = 12
export const AES_SALT_BYTES = 16

export const BANKING_PRESET_KEY = 'active'
export const DEFAULT_BANKING_PRESET_FEED_URL =
  'https://raw.githubusercontent.com/kurtarma-plani/banking-presets/main/tr-latest.json'
