import { describe, expect, it } from 'vitest'
import { parseEsrPairingInput } from '@/core/services/sync/relay-pairing'

const NS = '11111111-1111-4111-8111-111111111111'

describe('parseEsrPairingInput', () => {
  it('esr:// QR payloadından namespace ve kod çıkarır', () => {
    const payload = `esr://pair/v1/${NS}?code=847291&exp=9999999999&host=Desktop`
    const result = parseEsrPairingInput(payload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.namespaceId).toBe(NS)
      expect(result.code).toBe('847291')
    }
  })

  it('6 haneli kod + namespace override kabul eder', () => {
    const result = parseEsrPairingInput('847291', NS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.namespaceId).toBe(NS)
      expect(result.code).toBe('847291')
    }
  })

  it('yalnızca kod için namespace ister', () => {
    const result = parseEsrPairingInput('847291')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('needs-namespace')
  })
})
