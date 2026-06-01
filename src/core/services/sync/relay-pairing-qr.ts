import { qrcodegen } from './qrcodegen'

const { QrCode } = qrcodegen

const QR_BORDER = 2
const QR_LIGHT = '#ffffff'
const QR_DARK = '#000000'

/** Host eşleştirme `qrPayload` → taranabilir SVG (Nayuki qrcodegen, harici paket yok). */
export function pairingQrSvg(payload: string): string {
  const text = payload.trim()
  if (!text) throw new Error('QR payload boş.')

  const qr = QrCode.encodeText(text, QrCode.Ecc.MEDIUM)
  const n = qr.size
  const total = n + QR_BORDER * 2

  let path = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.getModule(x, y)) {
        path += `M${x + QR_BORDER},${y + QR_BORDER}h1v1h-1z`
      }
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${total} ${total}" stroke="none">`,
    `<rect width="100%" height="100%" fill="${QR_LIGHT}"/>`,
    `<path d="${path}" fill="${QR_DARK}"/>`,
    '</svg>',
  ].join('')
}

/** `pairingQrSvg` → `data:image/svg+xml` (img src). */
export function pairingQrDataUrl(payload: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pairingQrSvg(payload))}`
}
