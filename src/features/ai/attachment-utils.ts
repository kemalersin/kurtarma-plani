import type { ChatAttachment, ChatMessage, ChatTurnMessage } from '@/core/types/ai'

const TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
])

const PDF_MIME = 'application/pdf'

export function isTextAttachmentMime(mimeType: string): boolean {
  return TEXT_MIMES.has(mimeType)
}

export function isPdfAttachmentMime(mimeType: string): boolean {
  return mimeType === PDF_MIME
}

export function isImageAttachment(att: ChatAttachment): boolean {
  return att.kind === 'image'
}

export function decodeAttachmentUtf8(att: ChatAttachment): string {
  const binary = atob(att.dataBase64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/** Eski `images` alanını attachments'a taşır. */
export function normalizeChatMessage(message: ChatMessage): ChatMessage {
  if (message.attachments?.length) return message
  if (!message.images?.length) return message
  return {
    ...message,
    attachments: message.images.map((img) => ({
      ...img,
      kind: img.kind ?? 'image',
    })),
  }
}

export function getMessageAttachments(message: ChatTurnMessage | ChatMessage): ChatAttachment[] {
  if (message.attachments?.length) return message.attachments
  return (message.images ?? []).map((img) => ({
    ...img,
    kind: img.kind ?? 'image',
  }))
}

export function messageHasImageAttachments(message: ChatTurnMessage | ChatMessage): boolean {
  return getMessageAttachments(message).some(isImageAttachment)
}

export function messageHasPdfAttachments(message: ChatTurnMessage | ChatMessage): boolean {
  return getMessageAttachments(message).some((a) => isPdfAttachmentMime(a.mimeType))
}

export function messageHasTextAttachments(message: ChatTurnMessage | ChatMessage): boolean {
  return getMessageAttachments(message).some((a) => isTextAttachmentMime(a.mimeType))
}

export function buildTextFileAppendix(attachments: ChatAttachment[]): string {
  const parts: string[] = []
  for (const att of attachments) {
    if (!isTextAttachmentMime(att.mimeType)) continue
    const name = att.fileName ?? 'dosya'
    let body: string
    try {
      body = decodeAttachmentUtf8(att)
    } catch {
      body = '(dosya okunamadı)'
    }
    const fence =
      att.mimeType === 'text/csv' ? 'csv'
      : att.mimeType === 'application/json' ? 'json'
      : 'text'
    parts.push(`[Ek dosya: ${name}]\n\`\`\`${fence}\n${body}\n\`\`\``)
  }
  return parts.join('\n\n')
}

export interface PreparedUserMessage {
  text: string
  images: ChatAttachment[]
  pdfs: ChatAttachment[]
}

export function prepareUserMessage(message: ChatTurnMessage): PreparedUserMessage {
  const attachments = getMessageAttachments(message)
  const textParts = [message.content.trim()]
  const appendix = buildTextFileAppendix(attachments)
  if (appendix) textParts.push(appendix)
  return {
    text: textParts.filter(Boolean).join('\n\n'),
    images: attachments.filter(isImageAttachment),
    pdfs: attachments.filter((a) => isPdfAttachmentMime(a.mimeType)),
  }
}

export function attachmentDataUrl(att: ChatAttachment): string {
  return `data:${att.mimeType};base64,${att.dataBase64}`
}

export function attachmentLabel(att: ChatAttachment): string {
  return att.fileName ?? (att.kind === 'image' ? 'Görsel' : 'Dosya')
}
