import type { AiProviderId } from '@/core/types/ai-settings'
import { DEFAULT_BASE_URLS } from '@/features/ai/providers/defaults'

export const DEV_AI_PROXY_PREFIX = '/kp-ai-proxy'

const DEV_PROXY_PROVIDERS = new Set<AiProviderId>([
  'anthropic',
  'openai',
  'gemini',
  'deepseek',
])

export function usesDevAiProxy(provider: AiProviderId): boolean {
  return import.meta.env.DEV && DEV_PROXY_PROVIDERS.has(provider)
}

/** Vite dev sunucusunda CORS'suz erişim için yerel proxy yolu. */
export function devAiProxyBaseUrl(provider: AiProviderId): string | undefined {
  if (!usesDevAiProxy(provider)) return undefined
  switch (provider) {
    case 'anthropic':
      return `${DEV_AI_PROXY_PREFIX}/anthropic`
    case 'openai':
      return `${DEV_AI_PROXY_PREFIX}/openai/v1`
    case 'gemini':
      return `${DEV_AI_PROXY_PREFIX}/gemini/v1beta`
    case 'deepseek':
      return `${DEV_AI_PROXY_PREFIX}/deepseek`
    default:
      return undefined
  }
}

/** UI placeholder ve varsayılan çözümleme. */
export function effectiveDefaultBaseUrl(provider: AiProviderId): string {
  return devAiProxyBaseUrl(provider) ?? DEFAULT_BASE_URLS[provider]
}

export const CLOUD_CORS_HINT =
  'Bulut sağlayıcılar tarayıcıdan doğrudan çağrılamaz (CORS). Geliştirmede Vite proxy kullanılır; tek HTML dağıtımında Ollama/vLLM (yerel) veya CORS destekli bir proxy base URL girin.'
