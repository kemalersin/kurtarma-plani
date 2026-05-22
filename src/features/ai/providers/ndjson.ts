/** Satır satır JSON (Ollama native stream) okuyucu. */
export async function* readNdjson(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
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
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        yield JSON.parse(trimmed) as Record<string, unknown>
      } catch {
        /* malformed line */
      }
    }
  }

  const tail = buffer.trim()
  if (tail) {
    try {
      yield JSON.parse(tail) as Record<string, unknown>
    } catch {
      /* malformed tail */
    }
  }
}

export function extractOllamaStreamText(chunk: Record<string, unknown>): string | undefined {
  const msg = chunk.message as { content?: string } | undefined
  if (typeof msg?.content === 'string' && msg.content.length > 0) return msg.content
  return undefined
}
