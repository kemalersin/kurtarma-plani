/** UI ve toast için uzun hata metinlerini tek satırda kısaltır. */
export function shortenSyncErrorMessage(message: string, maxLength = 56): string {
  const oneLine = message.replace(/\s+/g, ' ').trim()
  if (!oneLine) return oneLine
  if (oneLine.length <= maxLength) return oneLine
  return `${oneLine.slice(0, maxLength - 1).trimEnd()}…`
}

const RELAY_ERROR_BY_CODE: Record<string, string> = {
  APP_NOT_FOUND: 'Uygulama kimliği kayıtlı değil.',
  ESR_CLIENT_OFFLINE: 'Relay sunucusuna ulaşılamadı.',
  ESR_CLIENT_NAMESPACE_EXISTS: 'Profil başka cihazda kayıtlı.',
  ESR_CLIENT_NEEDS_PAIRING: 'Cihaz oturumu yok; eşleştirme veya recovery gerekli.',
  ESR_CLIENT_NO_FETCH: 'Tarayıcı ağ isteği yapamıyor.',
  NAMESPACE_NOT_FOUND: 'Relay namespace bulunamadı.',
  PAIRING_CODE_INVALID: 'Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.',
  PAIRING_CODE_EXPIRED: 'Eşleştirme kodunun süresi dolmuş; host cihazdan yeni kod üretin.',
  DEVICE_LIMIT_PAYMENT_REQUIRED: 'Cihaz limiti doldu (unlock gerekir).',
  DEVICE_LIMIT_BLOCKED: 'Cihaz limiti doldu.',
  DEVICE_TOKEN_INVALID: 'Cihaz oturumu geçersiz; yeniden eşleştirin veya kurtarma anahtarı kullanın.',
  ESR_CLIENT_ENCRYPTION_PASSWORD_REQUIRED: 'Senkron parolası gerekli.',
}

const RELAY_ERROR_BY_MESSAGE: Record<string, string> = {
  'Application is not registered': 'Uygulama kimliği kayıtlı değil.',
  'Device token is invalid or revoked':
    'Cihaz oturumu geçersiz; yeniden eşleştirin veya kurtarma anahtarı kullanın.',
  'Pairing code is invalid, expired, or already used':
    'Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.',
  'Uygulama kimliği relay sunucusunda kayıtlı değil. Ayarlardaki uygulama kimliğini kontrol edin.':
    'Uygulama kimliği kayıtlı değil.',
  'Password is required to decrypt ENV-ENC1 payload': 'Senkron parolası gerekli.',
}

function isEnvEnc1PasswordMessage(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('env-enc1') || m.includes('password is required to decrypt')
}

function isPairingCodeInvalidMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('pairing code') &&
    (m.includes('invalid') || m.includes('expired') || m.includes('already used'))
  )
}

/** ENV-ENC1 / şifre eksikliği — kurulumda çift toast önlenir. */
export function isRelayEncryptionPasswordError(errorOrMessage: unknown): boolean {
  const fields = relayErrorFields(errorOrMessage)
  if (fields) {
    if (fields.code === 'ESR_CLIENT_ENCRYPTION_PASSWORD_REQUIRED') return true
    if (isEnvEnc1PasswordMessage(fields.message)) return true
  }
  if (typeof errorOrMessage === 'string') {
    return isEnvEnc1PasswordMessage(errorOrMessage)
  }
  return false
}

function resolveRelayErrorCode(code: string | undefined, message: string): string | undefined {
  const trimmedCode = code?.trim()
  if (trimmedCode && RELAY_ERROR_BY_CODE[trimmedCode]) return trimmedCode

  const trimmedMessage = message.trim()
  if (trimmedMessage && RELAY_ERROR_BY_CODE[trimmedMessage]) return trimmedMessage

  return trimmedCode || undefined
}

export function translateRelayErrorMessage(code: string | undefined, message: string): string {
  if (isEnvEnc1PasswordMessage(message)) {
    return RELAY_ERROR_BY_CODE.ESR_CLIENT_ENCRYPTION_PASSWORD_REQUIRED!
  }
  if (isPairingCodeInvalidMessage(message)) {
    return RELAY_ERROR_BY_CODE.PAIRING_CODE_INVALID!
  }
  const resolvedCode = resolveRelayErrorCode(code, message)
  if (resolvedCode) return RELAY_ERROR_BY_CODE[resolvedCode]!
  if (RELAY_ERROR_BY_MESSAGE[message]) return RELAY_ERROR_BY_MESSAGE[message]
  return shortenSyncErrorMessage(message, 72)
}

function relayErrorFields(error: unknown): { code?: string; message: string } | null {
  if (error instanceof Error) {
    const coded = error as Error & { code?: string }
    return { code: coded.code, message: error.message }
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const message =
      typeof record.message === 'string'
        ? record.message
        : typeof record.code === 'string'
          ? record.code
          : null
    if (!message) return null
    const code = typeof record.code === 'string' ? record.code : undefined
    return { code, message }
  }
  if (typeof error === 'string' && error.trim()) {
    return { message: error.trim() }
  }
  return null
}

export function relayErrorMessageFromUnknown(error: unknown): string {
  const fields = relayErrorFields(error)
  if (fields) {
    return translateRelayErrorMessage(fields.code, fields.message)
  }
  return 'Relay bağlantısı kurulamadı.'
}

/** UI / toast için Türkçeleştirilmiş `Error` (sync store ve kurulum). */
export function toRelayUserError(error: unknown): Error {
  return new Error(relayErrorMessageFromUnknown(error))
}

/** Sunucuda iptal / geçersiz cihaz oturumu (arka plan bildirimleri dahil). */
export function isRelayDeviceTokenInvalidError(error: unknown): boolean {
  const fields = relayErrorFields(error)
  if (!fields) return false
  const code = fields.code?.trim()
  if (code === 'DEVICE_TOKEN_INVALID' || code === 'UNAUTHORIZED') return true
  const msg = fields.message.toLowerCase()
  return (
    msg.includes('device token is invalid') ||
    msg.includes('invalid or revoked') ||
    fields.message.trim() === 'DEVICE_TOKEN_INVALID'
  )
}
