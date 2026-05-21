import { PBKDF2_HASH, PBKDF2_ITERATIONS, PBKDF2_KEY_BITS } from '@/core/constants'

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
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

export async function hashPassword(password: string): Promise<PasswordHashResult> {
  const salt = randomBytes(16)
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS)
  return {
    hash: toBase64(bits),
    salt: toBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  }
}

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
