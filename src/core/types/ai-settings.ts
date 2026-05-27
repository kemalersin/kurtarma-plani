export type AiProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'ollama' | 'vllm'

export interface AiProviderConfig {
  id: string
  provider: AiProviderId
  label: string
  apiKey?: string
  baseUrl?: string
  defaultModelId?: string
}

export interface AiSettings {
  activeProviderId?: string
  providers: AiProviderConfig[]
  /** Varsayılan sistem promptunun sonuna eklenir. */
  customSystemPrompt?: string
  /** Sağ alttaki sayfa içi AI sohbet düğmesi. Belirtilmezse gösterilir. */
  showFloatingChatFab?: boolean
}
