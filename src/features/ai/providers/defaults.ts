import type { AiProviderId } from '@/core/types/ai-settings'

export const DEFAULT_BASE_URLS: Record<AiProviderId, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com',
  ollama: 'http://localhost:11434/v1',
  vllm: 'http://localhost:8000/v1',
}
