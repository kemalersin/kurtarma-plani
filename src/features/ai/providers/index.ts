import type { AiProviderId } from '@/core/types/ai-settings'
import type { StreamChatParams } from '@/core/types/ai'
import { formatProviderError, normalizeApiKey } from '@/features/ai/provider-auth'
import {
  buildAnthropicMessageContent,
  buildGeminiMessageParts,
  buildOpenAiMessageContent,
} from '@/features/ai/providers/multimodal'
import { createOllamaAdapter } from '@/features/ai/providers/ollama'
import { devAiProxyBaseUrl } from '@/features/ai/providers/proxy-url'
import { DEFAULT_BASE_URLS } from '@/features/ai/providers/defaults'
import { extractOpenAiStreamText, readSse } from '@/features/ai/providers/sse'
import type { AiProviderAdapter } from '@/features/ai/providers/types'
import {
  assertChatAttachmentsSupported,
} from '@/features/ai/providers/vision'
import { resolveAnthropicModelId } from '@/features/ai/providers/anthropic-models'

export type { AiProviderAdapter } from '@/features/ai/providers/types'
export { DEFAULT_BASE_URLS } from '@/features/ai/providers/defaults'

/** Kayıtlı varsayılan bulut URL'si geliştirmede proxy ile değiştirilir. */
function shouldUseDevProxy(provider: AiProviderId, normalized?: string): boolean {
  const devProxy = devAiProxyBaseUrl(provider)
  if (!devProxy) return false
  if (!normalized) return true
  const def = DEFAULT_BASE_URLS[provider].replace(/\/+$/, '')
  const cleaned = normalized.replace(/\/+$/, '')
  return cleaned === def
}

export function resolveBaseUrl(provider: AiProviderId, baseUrl?: string): string {
  const normalized = normalizeProviderBaseUrl(provider, baseUrl)
  const devProxy = devAiProxyBaseUrl(provider)
  if (devProxy && shouldUseDevProxy(provider, normalized)) return devProxy
  if (normalized) return normalized
  if (devProxy) return devProxy
  return DEFAULT_BASE_URLS[provider]
}

/** Kayıtlı / kullanıcı base URL'lerini sağlayıcı kurallarına göre düzeltir. */
export function normalizeProviderBaseUrl(
  provider: AiProviderId,
  baseUrl?: string,
): string | undefined {
  const trimmed = baseUrl?.trim()
  if (!trimmed) return undefined
  let cleaned = trimmed.replace(/\/+$/, '')
  if (provider === 'deepseek' && cleaned.endsWith('/v1')) {
    cleaned = cleaned.slice(0, -3)
  }
  if (provider === 'anthropic' && cleaned.endsWith('/v1')) {
    cleaned = cleaned.slice(0, -3)
  }
  if (provider === 'openai' || provider === 'ollama' || provider === 'vllm') {
    if (!cleaned.endsWith('/v1')) cleaned = `${cleaned}/v1`
  }
  return cleaned
}

function usageFromOpenAi(chunk: Record<string, unknown>) {
  const usage = chunk.usage as Record<string, unknown> | undefined
  if (!usage) return null
  const details = usage.prompt_tokens_details as Record<string, unknown> | undefined
  const cached = details?.cached_tokens
  return {
    inputTokens: Number(usage.prompt_tokens ?? 0),
    outputTokens: Number(usage.completion_tokens ?? 0),
    cacheReadTokens: cached != null ? Number(cached) : undefined,
  }
}

/** OpenAI uyumlu uçlar /v1/chat/completions kullanır; DeepSeek resmi taban /chat/completions. */
function chatCompletionsUrl(provider: AiProviderId, base: string): string {
  if (provider === 'deepseek') {
    return `${base}/chat/completions`
  }
  const root = base.endsWith('/v1') ? base : `${base}/v1`
  return `${root}/chat/completions`
}

/** OpenAI Chat Completions uyumlu (OpenAI, DeepSeek, vLLM). Ollama ayrı adapter. */
export function createOpenAiCompatibleAdapter(id: AiProviderId): AiProviderAdapter {
  return {
    id,
    async *streamChat(params: StreamChatParams) {
      assertChatAttachmentsSupported(id, params.messages, params.model)

      const base = resolveBaseUrl(id, params.baseUrl)
      const url = chatCompletionsUrl(id, base)
      const apiKey = normalizeApiKey(params.apiKey)
      const body = {
        model: params.model,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: params.system },
          ...params.messages.map((m) => ({
            role: m.role,
            content: buildOpenAiMessageContent(m),
          })),
        ],
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: params.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(formatProviderError(text || `HTTP ${res.status}`))
      }

      for await (const chunk of readSse(res)) {
        const text = extractOpenAiStreamText(chunk)
        if (text) yield { type: 'text', text }
        const usage = usageFromOpenAi(chunk)
        if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
          yield { type: 'usage', ...usage }
        }
      }
    },
  }
}

export function createAnthropicAdapter(): AiProviderAdapter {
  return {
    id: 'anthropic',
    async *streamChat(params: StreamChatParams) {
      assertChatAttachmentsSupported('anthropic', params.messages, params.model)
      const base = resolveBaseUrl('anthropic', params.baseUrl)
      const apiKey = normalizeApiKey(params.apiKey)
      const model = resolveAnthropicModelId(params.model)
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          /** Tarayıcıdan (veya dev proxy üzerinden) CORS istekleri için zorunlu. */
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          stream: true,
          system: params.system,
          messages: params.messages.map((m) => ({
            role: m.role,
            content: buildAnthropicMessageContent(m),
          })),
        }),
        signal: params.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(formatProviderError(text || `HTTP ${res.status}`))
      }

      for await (const chunk of readSse(res)) {
        if (chunk.type === 'content_block_delta') {
          const delta = chunk.delta as { text?: string } | undefined
          if (delta?.text) yield { type: 'text', text: delta.text }
        }
        if (chunk.type === 'message_delta') {
          const usage = chunk.usage as Record<string, number> | undefined
          if (usage) {
            yield {
              type: 'usage',
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              cacheReadTokens: usage.cache_read_input_tokens,
              cacheWriteTokens: usage.cache_creation_input_tokens,
            }
          }
        }
      }
    },
  }
}

export function createGeminiAdapter(): AiProviderAdapter {
  return {
    id: 'gemini',
    async *streamChat(params: StreamChatParams) {
      assertChatAttachmentsSupported('gemini', params.messages, params.model)
      const base = resolveBaseUrl('gemini', params.baseUrl)
      const apiKey = normalizeApiKey(params.apiKey)
      const url = `${base}/models/${encodeURIComponent(params.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`

      const contents = params.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: buildGeminiMessageParts(m),
      }))

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.system }] },
          contents,
        }),
        signal: params.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(formatProviderError(text || `HTTP ${res.status}`))
      }

      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of readSse(res)) {
        const candidates = chunk.candidates as
          | Array<{ content?: { parts?: Array<{ text?: string }> } }>
          | undefined
        const parts = candidates?.[0]?.content?.parts
        if (parts) {
          for (const p of parts) {
            if (p.text) yield { type: 'text', text: p.text }
          }
        }
        const meta = chunk.usageMetadata as
          | { promptTokenCount?: number; candidatesTokenCount?: number }
          | undefined
        if (meta?.promptTokenCount != null) inputTokens = meta.promptTokenCount
        if (meta?.candidatesTokenCount != null) outputTokens = meta.candidatesTokenCount
      }

      if (inputTokens || outputTokens) {
        yield { type: 'usage', inputTokens, outputTokens }
      }
    },
  }
}

const adapters: Record<AiProviderId, AiProviderAdapter> = {
  anthropic: createAnthropicAdapter(),
  openai: createOpenAiCompatibleAdapter('openai'),
  gemini: createGeminiAdapter(),
  deepseek: createOpenAiCompatibleAdapter('deepseek'),
  ollama: createOllamaAdapter(),
  vllm: createOpenAiCompatibleAdapter('vllm'),
}

export function getProviderAdapter(id: AiProviderId): AiProviderAdapter {
  return adapters[id]
}

export interface RemoteModelOption {
  id: string
  name: string
}

export async function fetchOllamaModels(baseUrl: string): Promise<RemoteModelOption[]> {
  const root = baseUrl.replace(/\/v1\/?$/, '')
  const res = await fetch(`${root}/api/tags`, { method: 'GET' })
  if (!res.ok) throw new Error(`Ollama model listesi alınamadı (HTTP ${res.status}).`)
  const json = (await res.json()) as { models?: Array<{ name?: string }> }
  return (json.models ?? [])
    .map((m) => m.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => ({ id: name, name }))
}

export async function fetchVllmModels(baseUrl: string, apiKey?: string): Promise<RemoteModelOption[]> {
  const base = resolveBaseUrl('vllm', baseUrl)
  const headers: Record<string, string> = {}
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
  const res = await fetch(`${base}/models`, { headers })
  if (!res.ok) throw new Error(`vLLM model listesi alınamadı (HTTP ${res.status}).`)
  const json = (await res.json()) as { data?: Array<{ id?: string }> }
  return (json.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id))
    .map((id) => ({ id, name: id }))
}
