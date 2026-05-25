import { z } from 'zod'
import type { AiProviderId } from '@/core/types/ai-settings'

const Iso = z.string().min(1)

export const ChatRoles = ['user', 'assistant'] as const
export type ChatRole = (typeof ChatRoles)[number]

export const ChatAttachmentKinds = ['image', 'document'] as const
export type ChatAttachmentKind = (typeof ChatAttachmentKinds)[number]

export const ChatAttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(ChatAttachmentKinds),
  mimeType: z.string().min(1),
  /** Base64 (data URL prefix olmadan) */
  dataBase64: z.string().min(1),
  fileName: z.string().optional(),
})
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>

/** Geriye dönük uyumluluk */
export const ChatImageAttachmentSchema = ChatAttachmentSchema
export type ChatImageAttachment = ChatAttachment

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(ChatRoles),
  content: z.string(),
  attachments: z.array(ChatAttachmentSchema).optional(),
  /** @deprecated attachments kullanın */
  images: z.array(ChatAttachmentSchema).optional(),
  /** Bu mesajdaki proposal bloklarından veritabanına yazılanların `proposalBundleKey` değerleri */
  appliedProposalKeys: z.array(z.string()).optional(),
  createdAt: Iso,
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatSessionUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
})
export type ChatSessionUsage = z.infer<typeof ChatSessionUsageSchema>

export const ChatSessionSchema = z.object({
  id: z.string(),
  messages: z.array(ChatMessageSchema),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  usageTotals: ChatSessionUsageSchema.optional(),
  snapshotFingerprint: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type ChatSession = z.infer<typeof ChatSessionSchema>

export const AiUsageEntrySchema = z.object({
  id: z.string(),
  at: Iso,
  providerId: z.string(),
  modelId: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheWriteTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative(),
  sessionId: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type AiUsageEntry = z.infer<typeof AiUsageEntrySchema>

export const AiSettingsEntitySchema = z.object({
  id: z.string(),
  activeProviderId: z.string().optional(),
  providers: z.array(
    z.object({
      id: z.string(),
      provider: z.custom<AiProviderId>(),
      label: z.string(),
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      defaultModelId: z.string().optional(),
    }),
  ),
  customSystemPrompt: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type AiSettingsEntity = z.infer<typeof AiSettingsEntitySchema>

export const AI_SETTINGS_ID = 'ai-settings'
export const ACTIVE_CHAT_ID = 'active'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface StreamUsageEvent extends TokenUsage {
  type: 'usage'
}

export interface StreamTextEvent {
  type: 'text'
  text: string
}

export type StreamEvent = StreamTextEvent | StreamUsageEvent

export interface ChatTurnMessage {
  role: ChatRole
  content: string
  attachments?: ChatAttachment[]
  /** @deprecated attachments kullanın */
  images?: ChatAttachment[]
}

export interface StreamChatParams {
  model: string
  apiKey: string
  baseUrl?: string
  system: string
  messages: ChatTurnMessage[]
  signal?: AbortSignal
}
