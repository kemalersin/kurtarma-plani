import {
  exportRawKey,
  generateDataKey,
  importRawKey,
  unwrapDataKey,
  wrapDataKey,
  type WrappedKey,
} from '@/core/crypto/aes'
import { verifyPassword } from '@/core/crypto/password'
import type { ProfilePasswordInfo } from '@/core/types/profile'

export interface PasswordInfoForPassword {
  enabled: true
  wrappedKey: string
  wrapIv: string
  salt: string
  iterations: number
}

export interface PasswordInfoForPlain {
  enabled: false
  dataKey: string
}

/**
 * Yeni profil için dataKey üret + ProfilePasswordInfo formatına dönüştür.
 */
export async function buildPasswordInfo(
  password: string | undefined,
): Promise<{ info: ProfilePasswordInfo; key: CryptoKey }> {
  const key = await generateDataKey()
  if (!password) {
    const dataKey = await exportRawKey(key)
    return { info: { enabled: false, dataKey }, key }
  }
  const wrapped = await wrapDataKey(key, password)
  return {
    info: {
      enabled: true,
      wrappedKey: wrapped.wrappedKey,
      wrapIv: wrapped.wrapIv,
      salt: wrapped.salt,
      iterations: wrapped.iterations,
    },
    key,
  }
}

/**
 * Parolasız profilde dataKey'i raw olarak import et.
 */
async function importPlainKey(info: ProfilePasswordInfo): Promise<CryptoKey> {
  if (info.enabled) {
    throw new Error('Parolasız profil bekleniyordu.')
  }
  if (!info.dataKey) {
    throw new Error('Parolasız profil dataKey içermiyor; legacy migration gerekli.')
  }
  return importRawKey(info.dataKey)
}

/**
 * Parolalı profilde wrappedKey'i AES unwrap ile çöz; başarısız olursa parola yanlış demektir.
 */
async function unwrapWithPassword(
  info: ProfilePasswordInfo,
  password: string,
): Promise<CryptoKey> {
  if (
    !info.wrappedKey ||
    !info.wrapIv ||
    !info.salt ||
    typeof info.iterations !== 'number'
  ) {
    throw new Error('Parolalı profil wrap alanları eksik (legacy migration gerekli).')
  }
  const wrapped: WrappedKey = {
    wrappedKey: info.wrappedKey,
    wrapIv: info.wrapIv,
    salt: info.salt,
    iterations: info.iterations,
  }
  return unwrapDataKey(password, wrapped)
}

/**
 * Profilin parola bilgisini açar. Başarısızlıkta `null` döner.
 * Aynı zamanda M1 → M2 dönüşümü için "needs migration" sinyali verir:
 * - Yeni hesap key'i döner, ancak `info` v1 formatındaysa
 *   `migratedInfo` doluder; çağıran kaydetmelidir.
 */
export async function unlockProfileKey(
  info: ProfilePasswordInfo,
  password: string | undefined,
): Promise<{ key: CryptoKey; migratedInfo?: ProfilePasswordInfo } | null> {
  try {
    if (!info.enabled) {
      if (info.dataKey) {
        return { key: await importPlainKey(info) }
      }
      // Legacy parolasız M1 profili: dataKey üret ve geçişi sinyalle
      const generated = await buildPasswordInfo(undefined)
      return { key: generated.key, migratedInfo: generated.info }
    }

    if (info.wrappedKey) {
      if (!password) return null
      const key = await unwrapWithPassword(info, password)
      return { key }
    }

    // Legacy M1 parolalı profil: önce hash ile doğrula, sonra dataKey üret + wrap et
    if (!password) return null
    if (info.legacyHash && info.salt && info.iterations) {
      const ok = await verifyPassword(password, info.legacyHash, info.salt, info.iterations)
      if (!ok) return null
    } else {
      // M1 alanları (legacyHash yerine "hash" diye saklanmış olabilir)
      const legacyHash = (info as unknown as { hash?: string }).hash
      if (!legacyHash || !info.salt || !info.iterations) return null
      const ok = await verifyPassword(password, legacyHash, info.salt, info.iterations)
      if (!ok) return null
    }
    const generated = await buildPasswordInfo(password)
    return { key: generated.key, migratedInfo: generated.info }
  } catch {
    return null
  }
}
