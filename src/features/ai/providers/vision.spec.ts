import { describe, expect, it } from 'vitest'
import { buildOllamaChatMessage } from '@/features/ai/providers/ollama'
import {
  supportsChatAttachments,
  supportsChatPdf,
  pdfNotSupportedMessage,
} from '@/features/ai/providers/vision'

describe('attachment provider support', () => {
  it('allows text files on deepseek', () => {
    expect(
      supportsChatAttachments('deepseek', [
        {
          role: 'user',
          content: '',
          attachments: [
            {
              id: '1',
              kind: 'document',
              mimeType: 'text/csv',
              dataBase64: btoa('a,b'),
            },
          ],
        },
      ]),
    ).toBe(true)
  })

  it('blocks pdf on openai', () => {
    expect(supportsChatPdf('openai')).toBe(false)
    expect(pdfNotSupportedMessage('openai')).toContain('Anthropic')
  })
})

describe('buildOllamaChatMessage', () => {
  it('inlines text file appendix into content', () => {
    const message = buildOllamaChatMessage({
      role: 'user',
      content: 'Oku',
      attachments: [
        {
          id: '1',
          kind: 'document',
          mimeType: 'text/plain',
          dataBase64: btoa('satir'),
          fileName: 'not.txt',
        },
      ],
    })
    expect(message.content).toContain('[Ek dosya: not.txt]')
    expect(message.images).toBeUndefined()
  })
})
