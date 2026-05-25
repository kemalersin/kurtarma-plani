import {
  AES_IV_BYTES,
  AES_KEY_BITS,
  AES_SALT_BYTES,
  PBKDF2_HASH,
  PBKDF2_ITERATIONS,
} from '@/core/constants'
import { fromBase64, randomBytes, toBase64 } from '@/core/crypto/codec'

const AES_PARAMS: AesKeyGenParams = { name: 'AES-GCM', length: AES_KEY_BITS }
const AES_KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']

export interface EncryptedPayload {
  iv: string
  ct: string
}

export interface WrappedKey {
  wrappedKey: string
  wrapIv: string
  salt: string
  iterations: number
}

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_PARAMS, true, AES_KEY_USAGES)
}

export async function exportRawKey(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key))
  return toBase64(raw)
}

export async function importRawKey(rawBase64: string): Promise<CryptoKey> {
  const raw = fromBase64(rawBase64)
  return crypto.subtle.importKey('raw', raw, AES_PARAMS, true, AES_KEY_USAGES)
}

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export async function wrapDataKey(
  dataKey: CryptoKey,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<WrappedKey> {
  const salt = randomBytes(AES_SALT_BYTES)
  const wrapIv = randomBytes(AES_IV_BYTES)
  const wrappingKey = await deriveWrappingKey(password, salt, iterations)
  const wrapped = new Uint8Array(
    await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv: wrapIv }),
  )
  return {
    wrappedKey: toBase64(wrapped),
    wrapIv: toBase64(wrapIv),
    salt: toBase64(salt),
    iterations,
  }
}

export async function unwrapDataKey(
  password: string,
  wrapped: WrappedKey,
): Promise<CryptoKey> {
  const salt = fromBase64(wrapped.salt)
  const wrapIv = fromBase64(wrapped.wrapIv)
  const wrappedRaw = fromBase64(wrapped.wrappedKey)
  const wrappingKey = await deriveWrappingKey(password, salt, wrapped.iterations)
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedRaw,
    wrappingKey,
    { name: 'AES-GCM', iv: wrapIv },
    AES_PARAMS,
    true,
    AES_KEY_USAGES,
  )
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const iv = randomBytes(AES_IV_BYTES)
  const data = new TextEncoder().encode(JSON.stringify(value))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data),
  )
  return { iv: toBase64(iv), ct: toBase64(ct) }
}

export async function decryptJson<T = unknown>(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<T> {
  const iv = fromBase64(payload.iv)
  const ct = fromBase64(payload.ct)
  const data = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct),
  )
  return JSON.parse(new TextDecoder().decode(data)) as T
}

export async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<EncryptedPayload> {
  const iv = randomBytes(AES_IV_BYTES)
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes),
  )
  return { iv: toBase64(iv), ct: toBase64(ct) }
}

export async function decryptBytes(key: CryptoKey, payload: EncryptedPayload): Promise<Uint8Array> {
  const iv = fromBase64(payload.iv)
  const ct = fromBase64(payload.ct)
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct))
}

export async function deriveFileKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}
