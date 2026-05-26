export const APP_NAME = 'Kurtarma Planı'
export const APP_VERSION = __APP_VERSION__
export const APP_BUILD_DATE = __APP_BUILD_DATE__
export const APP_GITHUB_URL = 'https://github.com/kemalersin/kurtarma-plani'
export const APP_GITHUB_REPO = 'kemalersin/kurtarma-plani'
export const APP_GITHUB_BRANCH = 'main'
export const APP_GITHUB_PAGES_BRANCH = 'pages'
/** Canlı dağıtım (GitHub Pages + özel alan adı). */
export const APP_GITHUB_PAGES_URL = 'https://kurtar.co/'
export const APP_GITHUB_PAGES_TREE_URL = `${APP_GITHUB_URL}/tree/${APP_GITHUB_PAGES_BRANCH}`
export const APP_GITHUB_PAGES_RAW_INDEX_URL = `https://raw.githubusercontent.com/${APP_GITHUB_REPO}/${APP_GITHUB_PAGES_BRANCH}/index.html`
export const APP_GITHUB_PACKAGE_JSON_URL = `https://raw.githubusercontent.com/${APP_GITHUB_REPO}/${APP_GITHUB_BRANCH}/package.json`
export const APP_SUPPORT_URL =
  'https://buy.polar.sh/polar_cl_usN4UjpXleT4nGn3r2j2CcADPtdBvlvhCV3Em2Zhrxc'

export const EXPORT_FILE_TYPE = 'kurtarma-plani-export' as const
export const AI_CONTEXT_FILE_TYPE = 'kurtarma-plani-ai-context' as const
export const AI_CONTEXT_VERSION = 3
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
  'https://raw.githubusercontent.com/kemalersin/kurtarma-plani/main/banking-presets/tr-latest.json'
