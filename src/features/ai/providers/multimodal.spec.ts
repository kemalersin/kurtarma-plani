import { describe, expect, it } from 'vitest'
import type { ChatTurnMessage } from '@/core/types/ai'
import {
  buildAnthropicMessageContent,
  buildGeminiMessageParts,
  buildOpenAiMessageContent,
} from '@/features/ai/providers/multimodal'

const sampleImage = {
  id: 'img-1',
  kind: 'image' as const,
  mimeType: 'image/jpeg',
  dataBase64: 'abc123',
}

function userMessage(content: string, attachments = [sampleImage]): ChatTurnMessage {
  return { role: 'user', content, attachments }
}

describe('buildOpenAiMessageContent', () => {
  it('returns plain string when no attachments', () => {
    expect(buildOpenAiMessageContent({ role: 'user', content: 'Merhaba' })).toBe('Merhaba')
  })

  it('returns text + image_url parts for multimodal user message', () => {
    const result = buildOpenAiMessageContent(userMessage('Planı ekle'))
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([
      { type: 'text', text: 'Planı ekle' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,abc123' } },
    ])
  })
})

describe('buildAnthropicMessageContent', () => {
  it('returns pdf document block', () => {
    const result = buildAnthropicMessageContent({
      role: 'user',
      content: 'Oku',
      attachments: [
        {
          id: 'pdf-1',
          kind: 'document',
          mimeType: 'application/pdf',
          dataBase64: 'pdfdata',
          fileName: 'plan.pdf',
        },
      ],
    })
    expect(result).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: 'pdfdata' },
      },
      { type: 'text', text: 'Oku' },
    ])
  })
})

describe('buildGeminiMessageParts', () => {
  it('returns inlineData for pdf', () => {
    const result = buildGeminiMessageParts({
      role: 'user',
      content: 'Oku',
      attachments: [
        {
          id: 'pdf-1',
          kind: 'document',
          mimeType: 'application/pdf',
          dataBase64: 'pdfdata',
        },
      ],
    })
    expect(result).toEqual([
      { text: 'Oku' },
      { inlineData: { mimeType: 'application/pdf', data: 'pdfdata' } },
    ])
  })
})
