/** SSE `data:` satırlarından JSON olayları çıkarır. */
export function* parseSseEvents(buffer: string): Generator<Record<string, unknown>> {
  const normalized = buffer.replace(/\r\n/g, '\n')
  for (const part of normalized.split('\n\n')) {
    if (!part.trim()) continue
    for (const line of part.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data) as Record<string, unknown>
      } catch {
        /* malformed chunk */
      }
    }
  }
}

export async function* readSse(response: Response): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) throw new Error('Yanıt gövdesi yok.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      buffer += decoder.decode()
      break
    }
    buffer += decoder.decode(value, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      yield* parseSseEvents(part)
    }
  }

  if (buffer.trim()) {
    yield* parseSseEvents(buffer)
  }
}

/** OpenAI Chat Completions stream parçasından metin çıkarır. */
export function extractOpenAiStreamText(chunk: Record<string, unknown>): string | undefined {
  const choices = chunk.choices as
    | Array<{
        delta?: { content?: string | null; reasoning_content?: string | null }
        message?: { content?: string | null }
      }>
    | undefined
  const choice = choices?.[0]
  const deltaContent = choice?.delta?.content
  if (typeof deltaContent === 'string' && deltaContent.length > 0) return deltaContent
  const reasoning = choice?.delta?.reasoning_content
  if (typeof reasoning === 'string' && reasoning.length > 0) return reasoning
  const messageContent = choice?.message?.content
  if (typeof messageContent === 'string' && messageContent.length > 0) return messageContent
  return undefined
}
