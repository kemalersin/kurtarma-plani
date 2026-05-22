import type { AiProviderId } from '@/core/types/ai-settings'
import type { ChatTurnMessage } from '@/core/types/ai'
import {
  getMessageAttachments,
  messageHasImageAttachments,
  messageHasPdfAttachments,
  messageHasTextAttachments,
} from '@/features/ai/attachment-utils'

export function messagesHaveImages(messages: ChatTurnMessage[]): boolean {
  return messages.some((m) => m.role === 'user' && messageHasImageAttachments(m))
}

export function messagesHaveAttachments(messages: ChatTurnMessage[]): boolean {
  return messages.some((m) => m.role === 'user' && getMessageAttachments(m).length > 0)
}

export function messagesHavePdf(messages: ChatTurnMessage[]): boolean {
  return messages.some((m) => m.role === 'user' && messageHasPdfAttachments(m))
}

/** OpenAI `image_url` içerik dizisini destekleyen sağlayıcılar. */
export function supportsOpenAiVisionFormat(provider: AiProviderId): boolean {
  return provider === 'openai'
}

/** Yerel / alternatif görsel API'si olan sağlayıcılar. */
export function supportsNativeVision(provider: AiProviderId): boolean {
  return provider === 'ollama' || provider === 'anthropic' || provider === 'gemini'
}

export function supportsChatImages(
  provider: AiProviderId,
  _modelId?: string,
): boolean {
  return supportsOpenAiVisionFormat(provider) || supportsNativeVision(provider)
}

export function supportsChatPdf(provider: AiProviderId): boolean {
  return provider === 'anthropic' || provider === 'gemini'
}

export function supportsChatAttachments(
  provider: AiProviderId,
  messages: ChatTurnMessage[],
  modelId?: string,
): boolean {
  const userMessages = messages.filter((m) => m.role === 'user')
  const hasImages = userMessages.some(messageHasImageAttachments)
  const hasPdf = userMessages.some(messageHasPdfAttachments)
  const hasTextFiles = userMessages.some(messageHasTextAttachments)
  if (hasTextFiles && !hasImages && !hasPdf) return true
  if (hasImages && !supportsChatImages(provider, modelId)) return false
  if (hasPdf && !supportsChatPdf(provider)) return false
  return true
}

export function visionNotSupportedMessage(provider: AiProviderId): string {
  const labels: Record<AiProviderId, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    gemini: 'Gemini',
    deepseek: 'DeepSeek',
    ollama: 'Ollama',
    vllm: 'vLLM',
  }
  const name = labels[provider]
  if (provider === 'ollama') {
    return `${name} ile görsel göndermek için vision destekli bir model seçin (ör. llava, gemma3, qwen2.5vl).`
  }
  if (provider === 'deepseek' || provider === 'vllm') {
    return `${name} bu uygulamada görsel/PDF sohbeti desteklemiyor. Metin dosyası (TXT/CSV/JSON) gönderebilir veya OpenAI, Anthropic, Gemini, Ollama kullanın.`
  }
  return `${name} görsel sohbeti desteklemiyor.`
}

export function pdfNotSupportedMessage(provider: AiProviderId): string {
  if (supportsChatPdf(provider)) return ''
  return 'PDF yalnızca Anthropic ve Gemini sağlayıcılarında desteklenir. TXT/CSV/JSON dosyaları tüm sağlayıcılarda metin olarak eklenir.'
}

export function attachmentsNotSupportedMessage(
  provider: AiProviderId,
  messages: ChatTurnMessage[],
): string {
  const userMessages = messages.filter((m) => m.role === 'user')
  if (userMessages.some(messageHasPdfAttachments) && !supportsChatPdf(provider)) {
    return pdfNotSupportedMessage(provider)
  }
  if (userMessages.some(messageHasImageAttachments) && !supportsChatImages(provider)) {
    return visionNotSupportedMessage(provider)
  }
  return 'Ek dosya bu sağlayıcı ile desteklenmiyor.'
}

export function assertChatImagesSupported(
  provider: AiProviderId,
  messages: ChatTurnMessage[],
  modelId?: string,
): void {
  if (!messagesHaveImages(messages)) return
  if (!supportsChatImages(provider, modelId)) {
    throw new Error(visionNotSupportedMessage(provider))
  }
}

export function assertChatAttachmentsSupported(
  provider: AiProviderId,
  messages: ChatTurnMessage[],
  modelId?: string,
): void {
  if (!messagesHaveAttachments(messages)) return
  if (!supportsChatAttachments(provider, messages, modelId)) {
    throw new Error(attachmentsNotSupportedMessage(provider, messages))
  }
}
