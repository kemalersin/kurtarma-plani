import { describe, expect, it } from 'vitest'
import {
  isRelayDeviceTokenInvalidError,
  isRelayEncryptionPasswordError,
  relayErrorMessageFromUnknown,
  shortenSyncErrorMessage,
  translateRelayErrorMessage,
} from '@/core/services/sync/relay-errors'

describe('relay-errors', () => {
  it('APP_NOT_FOUND kısa Türkçe mesaj döner', () => {
    expect(
      relayErrorMessageFromUnknown({ code: 'APP_NOT_FOUND', message: 'Application is not registered' }),
    ).toBe('Uygulama kimliği kayıtlı değil.')
  })

  it('DEVICE_TOKEN_INVALID kısa Türkçe mesaj döner', () => {
    expect(
      relayErrorMessageFromUnknown({
        code: 'DEVICE_TOKEN_INVALID',
        message: 'Device token is invalid or revoked',
      }),
    ).toBe('Cihaz oturumu geçersiz; yeniden eşleştirin veya kurtarma anahtarı kullanın.')
  })

  it('ESR_CLIENT_NEEDS_PAIRING kısa Türkçe mesaj döner', () => {
    expect(
      translateRelayErrorMessage('ESR_CLIENT_NEEDS_PAIRING', 'Device token missing'),
    ).toBe('Cihaz oturumu yok; eşleştirme veya recovery gerekli.')
  })

  it('bilinmeyen uzun mesajı kısaltır', () => {
    const long = 'A'.repeat(100)
    expect(shortenSyncErrorMessage(long, 56).endsWith('…')).toBe(true)
    expect(shortenSyncErrorMessage(long, 56).length).toBe(56)
  })

  it('PAIRING_CODE_INVALID kod ve İngilizce mesaj Türkçeleşir', () => {
    expect(
      relayErrorMessageFromUnknown({
        code: 'PAIRING_CODE_INVALID',
        message: 'Pairing code is invalid, expired, or already used',
      }),
    ).toBe('Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.')
    expect(relayErrorMessageFromUnknown(new Error('PAIRING_CODE_INVALID'))).toBe(
      'Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.',
    )
    const sdkStyle = new Error('Pairing code is invalid, expired, or already used')
    ;(sdkStyle as Error & { code: string }).code = 'PAIRING_CODE_INVALID'
    expect(relayErrorMessageFromUnknown(sdkStyle)).toBe(
      'Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.',
    )
  })

  it('isRelayDeviceTokenInvalidError SDK Error.code ile true', () => {
    const err = new Error('Device token is invalid or revoked')
    ;(err as Error & { code: string }).code = 'DEVICE_TOKEN_INVALID'
    expect(isRelayDeviceTokenInvalidError(err)).toBe(true)
  })

  it('eşleştirme kodu mesajı noktalama farkıyla Türkçeleşir', () => {
    expect(
      relayErrorMessageFromUnknown(
        'Pairing code is invalid, expired, or already used.',
      ),
    ).toBe('Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.')
    expect(
      translateRelayErrorMessage(undefined, 'Error: pairing code invalid'),
    ).toBe('Eşleştirme kodu yanlış, süresi dolmuş veya zaten kullanılmış.')
  })

  it('ENV-ENC1 parola mesajı tek Türkçe satıra iner', () => {
    expect(
      relayErrorMessageFromUnknown(
        new Error('Password is required to decrypt ENV-ENC1 payload'),
      ),
    ).toBe('Senkron parolası gerekli.')
    expect(isRelayEncryptionPasswordError('Password is required to decrypt ENV-ENC1 payload')).toBe(
      true,
    )
  })

  it('eski uzun Türkçe kayıtları kısaltır', () => {
    expect(
      translateRelayErrorMessage(
        undefined,
        'Uygulama kimliği relay sunucusunda kayıtlı değil. Ayarlardaki uygulama kimliğini kontrol edin.',
      ),
    ).toBe('Uygulama kimliği kayıtlı değil.')
  })
})
