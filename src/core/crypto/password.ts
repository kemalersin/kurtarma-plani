import { PBKDF2_HASH, PBKDF2_ITERATIONS, PBKDF2_KEY_BITS } from '@/core/constants'
import { fromBase64, randomBytes, toBase64 } from '@/core/crypto/codec'

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    baseKey,
    PBKDF2_KEY_BITS,
  )
  return new Uint8Array(bits)
}

export interface PasswordHashResult {
  hash: string
  salt: string
  iterations: number
}

/** @deprecated M2'den itibaren parola doğrulaması AES unwrap üzerinden yapılır. */
export async function hashPassword(password: string): Promise<PasswordHashResult> {
  const salt = randomBytes(16)
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return {
    hash: toBase64(bits),
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  }
}

/**
 * M1 profillerini (yalnızca PBKDF2 hash ile saklananları) açabilmek için
 * korunur. M2 itibarıyla parola doğru ise AES `unwrapDataKey` başarılı olur;
 * bu fonksiyon yalnızca legacy fallback'tir.
 */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  saltB64: string,
  iterations: number,
): Promise<boolean> {
  const salt = fromBase64(saltB64)
  const bits = await deriveBits(password, salt, iterations)
  const candidate = toBase64(bits)
  return timingSafeEqual(candidate, expectedHash)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
