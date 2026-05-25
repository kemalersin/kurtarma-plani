import { describe, expect, it } from 'vitest'
import {
  buildTextFileAppendix,
  prepareUserMessage,
} from '@/features/ai/attachment-utils'
import type { ChatAttachment } from '@/core/types/ai'

describe('prepareUserMessage', () => {
  it('appends text file content to message text', () => {
    const csvBase64 = btoa('tutar,vade\n1000,2025-01-01')
    const attachments: ChatAttachment[] = [
      {
        id: '1',
        kind: 'document',
        mimeType: 'text/csv',
        dataBase64: csvBase64,
        fileName: 'plan.csv',
      },
    ]
    const prepared = prepareUserMessage({
      role: 'user',
      content: 'Tabloyu oku',
      attachments,
    })
    expect(prepared.text).toContain('[Ek dosya: plan.csv]')
    expect(prepared.text).toContain('tutar,vade')
    expect(prepared.pdfs).toHaveLength(0)
  })

  it('separates pdf from images', () => {
    const prepared = prepareUserMessage({
      role: 'user',
      content: '',
      attachments: [
        {
          id: '1',
          kind: 'document',
          mimeType: 'application/pdf',
          dataBase64: 'abc',
          fileName: 'plan.pdf',
        },
        {
          id: '2',
          kind: 'image',
          mimeType: 'image/jpeg',
          dataBase64: 'xyz',
        },
      ],
    })
    expect(prepared.pdfs).toHaveLength(1)
    expect(prepared.images).toHaveLength(1)
  })
})

describe('buildTextFileAppendix', () => {
  it('wraps json files in fenced block', () => {
    const body = buildTextFileAppendix([
      {
        id: '1',
        kind: 'document',
        mimeType: 'application/json',
        dataBase64: btoa('{"a":1}'),
        fileName: 'data.json',
      },
    ])
    expect(body).toContain('```json')
    expect(body).toContain('{"a":1}')
  })
})
