import type { ChatAttachment } from '@/core/types/ai'
import { newId } from '@/core/util/id'

export const CHAT_ATTACHMENT_LIMITS = {
  maxCount: 4,
  maxImageBytes: 4 * 1024 * 1024,
  maxDocumentBytes: 8 * 1024 * 1024,
  maxTextBytes: 512 * 1024,
  maxDimension: 1600,
  accept:
    'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/json',
} as const

/** Geriye dönük alias */
export const CHAT_IMAGE_LIMITS = {
  maxCount: CHAT_ATTACHMENT_LIMITS.maxCount,
  maxBytes: CHAT_ATTACHMENT_LIMITS.maxImageBytes,
  maxDimension: CHAT_ATTACHMENT_LIMITS.maxDimension,
  accept: 'image/jpeg,image/png,image/webp,image/gif',
} as const

const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const TEXT_MIMES = new Set(['text/plain', 'text/csv', 'application/json'])

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Dosya okunamadı.'))
    reader.readAsArrayBuffer(file)
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Görsel yüklenemedi.'))
    img.src = src
  })
}

async function compressRasterImage(
  file: File,
  mimeType: string,
): Promise<{ mimeType: string; dataBase64: string }> {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImageElement(dataUrl)
  const maxDim = CHAT_ATTACHMENT_LIMITS.maxDimension
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Görsel işlenemedi.')
  ctx.drawImage(img, 0, 0, width, height)

  const outputMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
  const outUrl = canvas.toDataURL(outputMime, outputMime === 'image/jpeg' ? 0.88 : undefined)
  const dataBase64 = outUrl.split(',')[1]
  if (!dataBase64) throw new Error('Görsel kodlanamadı.')
  return { mimeType: outputMime, dataBase64 }
}

function resolveMimeType(file: File): string {
  if (file.type) return file.type
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return file.type
}

function validateSize(file: File, mimeType: string): void {
  if (IMAGE_MIMES.has(mimeType)) {
    if (file.size > CHAT_ATTACHMENT_LIMITS.maxImageBytes) {
      throw new Error('Görsel en fazla 4 MB olabilir.')
    }
    return
  }
  if (TEXT_MIMES.has(mimeType)) {
    if (file.size > CHAT_ATTACHMENT_LIMITS.maxTextBytes) {
      throw new Error('Metin dosyası en fazla 512 KB olabilir.')
    }
    return
  }
  if (file.size > CHAT_ATTACHMENT_LIMITS.maxDocumentBytes) {
    throw new Error('Dosya en fazla 8 MB olabilir.')
  }
}

/** Sohbete eklenecek dosyayı doğrular ve base64'e çevirir. */
export async function fileToChatAttachment(file: File): Promise<ChatAttachment> {
  const mimeType = resolveMimeType(file)
  const fileName = file.name || undefined

  if (IMAGE_MIMES.has(mimeType)) {
    validateSize(file, mimeType)
    if (mimeType === 'image/gif') {
      const dataUrl = await readFileAsDataUrl(file)
      const dataBase64 = dataUrl.split(',')[1]
      if (!dataBase64) throw new Error('GIF okunamadı.')
      return { id: newId(), kind: 'image', mimeType, dataBase64, fileName }
    }
    const compressed = await compressRasterImage(file, mimeType)
    return { id: newId(), kind: 'image', fileName, ...compressed }
  }

  if (mimeType === 'application/pdf' || TEXT_MIMES.has(mimeType)) {
    validateSize(file, mimeType)
    const buffer = await readFileAsArrayBuffer(file)
    return {
      id: newId(),
      kind: 'document',
      mimeType,
      dataBase64: arrayBufferToBase64(buffer),
      fileName,
    }
  }

  throw new Error('Desteklenen türler: JPEG, PNG, WebP, GIF, PDF, TXT, CSV, JSON.')
}

/** @deprecated fileToChatAttachment kullanın */
export const fileToChatImage = fileToChatAttachment

export function chatImageDataUrl(att: ChatAttachment): string {
  return `data:${att.mimeType};base64,${att.dataBase64}`
}

export const attachmentDataUrl = chatImageDataUrl
