import type { AiProviderId } from '@/core/types/ai-settings'
import type { StreamChatParams, StreamEvent } from '@/core/types/ai'

export interface AiProviderAdapter {
  readonly id: AiProviderId
  streamChat(params: StreamChatParams): AsyncGenerator<StreamEvent, void>
}
