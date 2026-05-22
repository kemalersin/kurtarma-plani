import type { StreamChatParams, StreamEvent, ChatTurnMessage } from '@/core/types/ai'
import { prepareUserMessage } from '@/features/ai/attachment-utils'
import { formatProviderError } from '@/features/ai/provider-auth'
import { extractOpenAiStreamText, readSse } from '@/features/ai/providers/sse'
import { extractOllamaStreamText, readNdjson } from '@/features/ai/providers/ndjson'
import { messagesHaveImages } from '@/features/ai/providers/vision'
import type { AiProviderAdapter } from '@/features/ai/providers/types'

function ollamaRoot(baseUrl?: string): string {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '')
  const base = trimmed || 'http://localhost:11434'
  return base.replace(/\/v1\/?$/, '')
}

export function buildOllamaChatMessage(
  message: ChatTurnMessage,
): { role: string; content: string; images?: string[] } {
  const prepared = prepareUserMessage(message)
  const content = prepared.text.trim() || ' '
  if (message.role === 'assistant' || !prepared.images.length) {
    return { role: message.role, content }
  }
  return {
    role: message.role,
    content,
    images: prepared.images.map((img) => img.dataBase64),
  }
}

function ollamaChatUrl(baseUrl?: string): string {
  return `${ollamaRoot(baseUrl)}/api/chat`
}

function ollamaOpenAiChatUrl(baseUrl?: string): string {
  return `${ollamaRoot(baseUrl)}/v1/chat/completions`
}

function usageFromOllama(chunk: Record<string, unknown>) {
  const input = chunk.prompt_eval_count
  const output = chunk.eval_count
  if (input == null && output == null) return null
  return {
    inputTokens: Number(input ?? 0),
    outputTokens: Number(output ?? 0),
  }
}

async function* streamOllamaNative(params: StreamChatParams): AsyncGenerator<StreamEvent> {
  const url = ollamaChatUrl(params.baseUrl)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      stream: true,
      messages: [
        { role: 'system', content: params.system },
        ...params.messages.map(buildOllamaChatMessage),
      ],
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatProviderError(text || `HTTP ${res.status}`))
  }

  for await (const chunk of readNdjson(res)) {
    const text = extractOllamaStreamText(chunk)
    if (text) yield { type: 'text', text }
    const usage = usageFromOllama(chunk)
    if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      yield { type: 'usage', ...usage }
    }
  }
}

async function* streamOllamaOpenAiCompat(params: StreamChatParams): AsyncGenerator<StreamEvent> {
  const url = ollamaOpenAiChatUrl(params.baseUrl)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      stream: true,
      messages: [
        { role: 'system', content: params.system },
        ...params.messages.map((m) => ({
          role: m.role,
          content: prepareUserMessage(m).text || m.content,
        })),
      ],
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(formatProviderError(text || `HTTP ${res.status}`))
  }

  for await (const chunk of readSse(res)) {
    const text = extractOpenAiStreamText(chunk)
    if (text) yield { type: 'text', text }
  }
}

export function createOllamaAdapter(): AiProviderAdapter {
  return {
    id: 'ollama',
    async *streamChat(params: StreamChatParams) {
      if (messagesHaveImages(params.messages)) {
        yield* streamOllamaNative(params)
        return
      }
      yield* streamOllamaOpenAiCompat(params)
    },
  }
}
