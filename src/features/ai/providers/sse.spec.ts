import { describe, expect, it } from 'vitest'
import { extractOpenAiStreamText, parseSseEvents } from '@/features/ai/providers/sse'

describe('parseSseEvents', () => {
  it('data satırlarını JSON olayına çevirir', () => {
    const events = [
      ...parseSseEvents('data: {"choices":[{"delta":{"content":"Mer"}}]}\n\n'),
    ]
    expect(events).toHaveLength(1)
    expect(extractOpenAiStreamText(events[0]!)).toBe('Mer')
  })

  it('son buffer parçasını da işler (kapanış \\n\\n olmadan)', () => {
    const events = [
      ...parseSseEvents('data: {"choices":[{"delta":{"content":"haba"}}]}'),
    ]
    expect(extractOpenAiStreamText(events[0]!)).toBe('haba')
  })

  it('CRLF satır sonlarını destekler', () => {
    const events = [
      ...parseSseEvents('data: {"choices":[{"delta":{"content":"x"}}]}\r\n\r\n'),
    ]
    expect(extractOpenAiStreamText(events[0]!)).toBe('x')
  })
})

describe('extractOpenAiStreamText', () => {
  it('message.content yedek alanını okur', () => {
    const text = extractOpenAiStreamText({
      choices: [{ message: { content: 'Tam yanıt' } }],
    })
    expect(text).toBe('Tam yanıt')
  })

  it('reasoning_content alanını okur', () => {
    const text = extractOpenAiStreamText({
      choices: [{ delta: { reasoning_content: 'Düşünüyorum…' } }],
    })
    expect(text).toBe('Düşünüyorum…')
  })
})
