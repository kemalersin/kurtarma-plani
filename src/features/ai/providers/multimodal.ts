import type { ChatTurnMessage } from '@/core/types/ai'
import { prepareUserMessage } from '@/features/ai/attachment-utils'

/** OpenAI Chat Completions / uyumlu sağlayıcılar */
export function buildOpenAiMessageContent(
  message: ChatTurnMessage,
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const prepared = prepareUserMessage(message)
  if (message.role === 'assistant') {
    return prepared.text || message.content
  }
  if (!prepared.images.length) {
    return prepared.text || message.content
  }

  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = []
  if (prepared.text.trim()) {
    parts.push({ type: 'text', text: prepared.text })
  }
  for (const image of prepared.images) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.dataBase64}` },
    })
  }
  return parts.length ? parts : prepared.text
}

/** Anthropic Messages API */
export function buildAnthropicMessageContent(
  message: ChatTurnMessage,
): string | Array<Record<string, unknown>> {
  const prepared = prepareUserMessage(message)
  if (
    message.role === 'assistant' ||
    (!prepared.images.length && !prepared.pdfs.length && !prepared.text.trim())
  ) {
    return prepared.text || message.content
  }

  const blocks: Array<Record<string, unknown>> = []
  for (const pdf of prepared.pdfs) {
    blocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: pdf.mimeType,
        data: pdf.dataBase64,
      },
    })
  }
  for (const image of prepared.images) {
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.dataBase64,
      },
    })
  }
  if (prepared.text.trim()) {
    blocks.push({ type: 'text', text: prepared.text })
  }
  return blocks.length ? blocks : prepared.text
}

/** Google Gemini generateContent */
export function buildGeminiMessageParts(
  message: ChatTurnMessage,
): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
  const prepared = prepareUserMessage(message)
  if (
    message.role === 'assistant' ||
    (!prepared.images.length && !prepared.pdfs.length && !prepared.text.trim())
  ) {
    return [{ text: prepared.text || message.content }]
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  if (prepared.text.trim()) {
    parts.push({ text: prepared.text })
  }
  for (const file of [...prepared.pdfs, ...prepared.images]) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.dataBase64,
      },
    })
  }
  return parts.length ? parts : [{ text: prepared.text }]
}
