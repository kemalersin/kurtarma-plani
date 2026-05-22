import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import type { AiProviderConfig, AiSettings } from '@/core/types/ai-settings'
import {
  ACTIVE_CHAT_ID,
  AI_SETTINGS_ID,
  type AiSettingsEntity,
  type AiUsageEntry,
  type ChatMessage,
  type ChatAttachment,
  type ChatSession,
  type ChatSessionUsage,
  type TokenUsage,
} from '@/core/types/ai'
import { isCloudCatalogProvider } from '@/core/types/ai-catalog'
import { computeCostUsd } from '@/features/ai/cost'
import { getProviderAdapter, normalizeProviderBaseUrl } from '@/features/ai/providers'
import { normalizeChatMessage } from '@/features/ai/attachment-utils'
import {
  assertChatAttachmentsSupported,
  attachmentsNotSupportedMessage,
  supportsChatAttachments,
} from '@/features/ai/providers/vision'
import {
  buildAiFinanceSnapshot,
  buildDomainSystemPrompt,
  buildSnapshotAckContent,
  buildSnapshotContextContent,
  computeSnapshotFingerprint,
} from '@/features/ai/snapshot'
import { normalizeApiKey, validateApiKey } from '@/features/ai/provider-auth'
import { useProfileStore } from '@/stores/profile'
import { useModelsCatalogStore } from '@/stores/models-catalog'
import { newId } from '@/core/util/id'

const PROVIDER_LABELS: Record<AiProviderConfig['provider'], string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  ollama: 'Ollama',
  vllm: 'vLLM',
}

function defaultSettingsEntity(now: string): AiSettingsEntity {
  return {
    id: AI_SETTINGS_ID,
    providers: [],
    createdAt: now,
    updatedAt: now,
  }
}

function emptyChat(now: string): ChatSession {
  return {
    id: ACTIVE_CHAT_ID,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function emptyUsageTotals(): ChatSessionUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 }
}

function sumSessionUsageEntries(entries: AiUsageEntry[]): ChatSessionUsage {
  return entries
    .filter((e) => e.sessionId === ACTIVE_CHAT_ID)
    .reduce(
      (acc, e) => ({
        inputTokens: acc.inputTokens + e.inputTokens,
        outputTokens: acc.outputTokens + e.outputTokens,
        costUsd: acc.costUsd + e.costUsd,
      }),
      emptyUsageTotals(),
    )
}

export const useAiStore = defineStore('ai', () => {
  const profileStore = useProfileStore()
  const modelsCatalogStore = useModelsCatalogStore()
  const settings = ref<AiSettingsEntity | null>(null)
  const chat = ref<ChatSession | null>(null)
  const usageEntries = ref<AiUsageEntry[]>([])
  const loaded = ref(false)
  const streaming = ref(false)
  const streamError = ref<string | null>(null)
  const turnUsage = ref<TokenUsage & { costUsd: number }>({
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  })
  let abortController: AbortController | null = null

  function repo(): EncryptedRepo {
    if (!profileStore.activeProfileId) throw new Error('Aktif profil yok.')
    return new EncryptedRepo(profileStore.activeProfileId, profileStore.dataKey)
  }

  async function load(): Promise<void> {
    if (!profileStore.activeProfileId) return
    await modelsCatalogStore.load()
    const r = repo()
    const settingsRow = await r.get<AiSettingsEntity>(AI_SETTINGS_ID)
    const chatRow = await r.get<ChatSession>(ACTIVE_CHAT_ID)
    const usageRows = await r.list<AiUsageEntry>('aiUsage')
    const now = new Date().toISOString()
    settings.value = settingsRow?.data ?? defaultSettingsEntity(now)
    usageEntries.value = usageRows.map((row) => row.data).sort((a, b) => b.at.localeCompare(a.at))

    let chatData = chatRow?.data ?? emptyChat(now)
    if (!chatData.usageTotals) {
      const migrated = sumSessionUsageEntries(usageEntries.value)
      if (migrated.inputTokens || migrated.outputTokens) {
        chatData = { ...chatData, usageTotals: migrated }
        await r.put({
          id: ACTIVE_CHAT_ID,
          type: 'chatSession',
          updatedAt: now,
          data: chatData,
        })
      }
    }
    chat.value = {
      ...chatData,
      messages: chatData.messages.map(normalizeChatMessage),
    }
    loaded.value = true
  }

  function reset(): void {
    settings.value = null
    chat.value = null
    usageEntries.value = []
    loaded.value = false
    streaming.value = false
    streamError.value = null
    turnUsage.value = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    abortController?.abort()
    abortController = null
  }

  const activeProvider = computed(() => {
    const s = settings.value
    if (!s?.activeProviderId) return undefined
    return s.providers.find((p) => p.id === s.activeProviderId)
  })

  const modelOptions = computed(() => {
    const provider = activeProvider.value
    if (!provider) return []
    if (isCloudCatalogProvider(provider.provider)) {
      return modelsCatalogStore.listModelOptions(provider.provider)
    }
    if (provider.defaultModelId) {
      return [{ value: provider.defaultModelId, label: provider.defaultModelId }]
    }
    return []
  })

  /** Aktif sohbet oturumunun birikimli kullanımı (yayın sırasında anlık tur dahil). */
  const sessionUsage = computed<ChatSessionUsage>(() => {
    const base = chat.value?.usageTotals ?? emptyUsageTotals()
    if (!streaming.value) return base
    return {
      inputTokens: base.inputTokens + turnUsage.value.inputTokens,
      outputTokens: base.outputTokens + turnUsage.value.outputTokens,
      costUsd: base.costUsd + turnUsage.value.costUsd,
    }
  })

  async function saveSettings(next: AiSettings): Promise<void> {
    const now = new Date().toISOString()
    const entity: AiSettingsEntity = {
      id: AI_SETTINGS_ID,
      ...next,
      createdAt: settings.value?.createdAt ?? now,
      updatedAt: now,
    }
    await repo().put({
      id: AI_SETTINGS_ID,
      type: 'aiSettings',
      updatedAt: now,
      data: entity,
      sensitive: true,
    })
    settings.value = entity
  }

  async function upsertProvider(config: AiProviderConfig): Promise<void> {
    const apiKey =
      config.apiKey != null && config.apiKey !== '' ?
        normalizeApiKey(config.apiKey)
      : config.apiKey
    const next: AiProviderConfig = {
      ...config,
      apiKey,
      baseUrl: normalizeProviderBaseUrl(config.provider, config.baseUrl),
    }
    const needsKey = next.provider !== 'ollama' && next.provider !== 'vllm'
    if (needsKey) {
      const validationError = validateApiKey(next.provider, next.apiKey)
      if (validationError) throw new Error(validationError)
    }
    const s = settings.value ?? defaultSettingsEntity(new Date().toISOString())
    const idx = s.providers.findIndex((p) => p.id === config.id)
    const providers =
      idx >= 0 ?
        s.providers.map((p, i) => (i === idx ? next : p))
      : [...s.providers, next]
    await saveSettings({
      activeProviderId: s.activeProviderId ?? next.id,
      providers,
    })
  }

  async function removeProvider(id: string): Promise<void> {
    const s = settings.value
    if (!s) return
    const providers = s.providers.filter((p) => p.id !== id)
    const activeProviderId =
      s.activeProviderId === id ? providers[0]?.id : s.activeProviderId
    await saveSettings({ activeProviderId, providers })
  }

  async function persistChat(next: ChatSession): Promise<void> {
    const now = new Date().toISOString()
    const entity = { ...next, updatedAt: now }
    await repo().put({
      id: ACTIVE_CHAT_ID,
      type: 'chatSession',
      updatedAt: now,
      data: entity,
    })
    chat.value = entity
  }

  async function appendUsage(entry: Omit<AiUsageEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString()
    const row: AiUsageEntry = {
      ...entry,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    }
    await repo().put({ id: row.id, type: 'aiUsage', updatedAt: now, data: row })
    usageEntries.value = [row, ...usageEntries.value]
  }

  async function clearSessionUsageEntries(): Promise<void> {
    const r = repo()
    const rows = await r.list<AiUsageEntry>('aiUsage')
    const sessionRows = rows.filter((row) => row.data.sessionId === ACTIVE_CHAT_ID)
    await Promise.all(sessionRows.map((row) => r.delete(row.id)))
    usageEntries.value = usageEntries.value.filter((e) => e.sessionId !== ACTIVE_CHAT_ID)
  }

  async function prepareChatContext(
    session: ChatSession,
    now: string,
  ): Promise<{ session: ChatSession; system: string }> {
    const profile = profileStore.activeProfile
    if (!profile) throw new Error('Profil yok.')
    const decoded = await repo().exportAllDecoded()
    const profileMeta = {
      name: profile.name,
      currency: profile.localeSettings.currency,
      locale: profile.localeSettings.locale,
      timeZone: profile.localeSettings.timeZone,
    }
    const fingerprint = computeSnapshotFingerprint(decoded)
    const system = buildDomainSystemPrompt(profileMeta, settings.value?.customSystemPrompt)

    if (fingerprint === session.snapshotFingerprint) {
      return { session, system }
    }

    const snapshot = buildAiFinanceSnapshot(profileMeta, decoded)
    const kind = session.snapshotFingerprint ? 'update' : 'initial'
    const contextMessages: ChatMessage[] = [
      {
        id: newId(),
        role: 'user',
        content: buildSnapshotContextContent(snapshot, kind),
        createdAt: now,
      },
      {
        id: newId(),
        role: 'assistant',
        content: buildSnapshotAckContent(),
        createdAt: now,
      },
    ]

    return {
      session: {
        ...session,
        messages: [...session.messages, ...contextMessages],
        snapshotFingerprint: fingerprint,
      },
      system,
    }
  }

  function stopStreaming(): void {
    abortController?.abort()
    abortController = null
    streaming.value = false
  }

  async function sendMessage(text: string, attachments?: ChatAttachment[]): Promise<void> {
    const trimmed = text.trim()
    const attachmentList = attachments?.length ? [...attachments] : undefined
    if ((!trimmed && !attachmentList?.length) || streaming.value) return

    const provider = activeProvider.value
    const needsKey = provider?.provider !== 'ollama' && provider?.provider !== 'vllm'
    const key = normalizeApiKey(provider?.apiKey)
    if (!provider || (needsKey && !key)) {
      streamError.value = 'API anahtarı tanımlı değil. Ayarlar → AI bölümünden ekleyin.'
      return
    }
    const modelId = provider.defaultModelId?.trim()
    if (!modelId) {
      streamError.value = 'Model seçilmedi.'
      return
    }

    const probeHistory = attachmentList ?
      [{ role: 'user' as const, content: trimmed, attachments: attachmentList }]
    : []
    if (
      attachmentList?.length &&
      !supportsChatAttachments(provider.provider, probeHistory, modelId)
    ) {
      streamError.value = attachmentsNotSupportedMessage(provider.provider, probeHistory)
      return
    }

    streamError.value = null
    const now = new Date().toISOString()
    const session = chat.value ?? emptyChat(now)
    const { session: sessionWithContext, system } = await prepareChatContext(session, now)
    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      content: trimmed,
      attachments: attachmentList,
      createdAt: now,
    }
    const assistantId = newId()
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now,
    }

    const nextSession: ChatSession = {
      ...sessionWithContext,
      messages: [...sessionWithContext.messages, userMessage, assistantMessage],
      providerId: provider.id,
      modelId,
      updatedAt: now,
    }
    await persistChat(nextSession)

    turnUsage.value = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    streaming.value = true
    abortController = new AbortController()

    const catalog =
      isCloudCatalogProvider(provider.provider) ?
        modelsCatalogStore.modelCatalog(provider.provider, modelId)
      : undefined

    let liveMessages = nextSession.messages

    try {
      const adapter = getProviderAdapter(provider.provider)
      const history = liveMessages
        .filter((m) => m.id !== assistantId)
        .map((m) => normalizeChatMessage(m))
        .map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        }))

      assertChatAttachmentsSupported(provider.provider, history, modelId)

      let assistantText = ''
      let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

      for await (const event of adapter.streamChat({
        model: modelId,
        apiKey: normalizeApiKey(provider.apiKey),
        baseUrl: normalizeProviderBaseUrl(provider.provider, provider.baseUrl),
        system,
        messages: history,
        signal: abortController.signal,
      })) {
        if (event.type === 'text') {
          assistantText += event.text
          liveMessages = liveMessages.map((m) =>
            m.id === assistantId ? { ...m, content: assistantText } : m,
          )
          chat.value = { ...nextSession, messages: liveMessages }
        } else {
          usage = {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cacheReadTokens: event.cacheReadTokens,
            cacheWriteTokens: event.cacheWriteTokens,
          }
          const costUsd = computeCostUsd(catalog, usage)
          turnUsage.value = { ...usage, costUsd }
        }
      }

      if (!assistantText.trim()) {
        streamError.value = 'Sağlayıcıdan boş yanıt alındı.'
      }

      const finalNow = new Date().toISOString()
      const finalMessages = liveMessages.map((m) =>
        m.id === assistantId ? { ...m, content: assistantText, createdAt: finalNow } : m,
      )
      const costUsd = computeCostUsd(catalog, usage)
      const prevTotals = session.usageTotals ?? chat.value?.usageTotals ?? emptyUsageTotals()
      const usageTotals: ChatSessionUsage = {
        inputTokens: prevTotals.inputTokens + usage.inputTokens,
        outputTokens: prevTotals.outputTokens + usage.outputTokens,
        costUsd: prevTotals.costUsd + costUsd,
      }
      await persistChat({
        ...nextSession,
        messages: finalMessages,
        usageTotals,
        updatedAt: finalNow,
      })

      if (usage.inputTokens || usage.outputTokens) {
        await appendUsage({
          at: finalNow,
          providerId: provider.id,
          modelId,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheWriteTokens: usage.cacheWriteTokens,
          costUsd,
          sessionId: ACTIVE_CHAT_ID,
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      streamError.value = error instanceof Error ? error.message : String(error)
    } finally {
      streaming.value = false
      abortController = null
    }
  }

  async function clearChat(): Promise<void> {
    stopStreaming()
    const now = new Date().toISOString()
    await clearSessionUsageEntries()
    turnUsage.value = emptyUsageTotals()
    await persistChat(emptyChat(now))
  }

  const totalUsageCost = computed(() =>
    usageEntries.value.reduce((sum, e) => sum + e.costUsd, 0),
  )

  function newProviderDraft(provider: AiProviderConfig['provider']): AiProviderConfig {
    return {
      id: newId(),
      provider,
      label: PROVIDER_LABELS[provider],
    }
  }

  return {
    settings,
    chat,
    usageEntries,
    loaded,
    streaming,
    streamError,
    turnUsage,
    sessionUsage,
    activeProvider,
    modelOptions,
    totalUsageCost,
    load,
    reset,
    saveSettings,
    upsertProvider,
    removeProvider,
    sendMessage,
    clearChat,
    stopStreaming,
    newProviderDraft,
  }
})
