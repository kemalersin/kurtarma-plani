import { describe, expect, it } from 'vitest'
import { repoEncryptionKey } from '@/core/db/encrypted-repo'

describe('repoEncryptionKey', () => {
  it('parolasız profilde null döner', () => {
    expect(repoEncryptionKey(false, {} as CryptoKey)).toBeNull()
  })

  it('parolalı profilde dataKey döner', () => {
    const key = {} as CryptoKey
    expect(repoEncryptionKey(true, key)).toBe(key)
  })

  it('parolalı profilde anahtar yoksa null döner', () => {
    expect(repoEncryptionKey(true, null)).toBeNull()
  })
})
