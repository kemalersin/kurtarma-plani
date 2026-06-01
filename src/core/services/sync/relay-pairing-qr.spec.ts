import { describe, expect, it } from 'vitest'
import { pairingQrDataUrl, pairingQrSvg } from '@/core/services/sync/relay-pairing-qr'

const NS = '11111111-1111-4111-8111-111111111111'

describe('pairingQrSvg', () => {
  it('esr:// payload için SVG üretir', () => {
    const payload = `esr://pair/v1/${NS}?code=847291&exp=9999999999&host=Desktop`
    const svg = pairingQrSvg(payload)
    expect(svg).toMatch(/^<\?xml/)
    expect(svg).toContain('<svg')
    expect(svg).toContain('<path')
  })

  it('boş payload hata verir', () => {
    expect(() => pairingQrSvg('  ')).toThrow('QR payload boş.')
  })
})

describe('pairingQrDataUrl', () => {
  it('data URL döner', () => {
    const url = pairingQrDataUrl('esr://pair/v1/test?code=123456')
    expect(url.startsWith('data:image/svg+xml;charset=UTF-8,')).toBe(true)
  })
})
