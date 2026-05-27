import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notifySyncLocalChange } from '@/core/services/sync/sync-scheduler'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import type { AiProviderConfig, AiSettings } from '@/core/types/ai-settings'
import {
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
import {
  chatSessionStorageId,
  LEGACY_ACTIVE_CHAT_ID,
} from '@/features/ai/page-chat'
import { pruneTrailingEmptyAssistantMessages } from '@/features/ai/chat-message-cleanup'
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

function emptyChat(sessionId: string, now: string): ChatSession {
  return {
    id: sessionId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

function emptyUsageTotals(): ChatSessionUsage {
  return { inputTokens: 0, outputTokens: 0, costUsd: 0 }
}

export interface ChatScrollState {
  scrollTop: number
  stickToBottom: boolean
}

function plainChatSession(session: ChatSession): ChatSession {
  return JSON.parse(JSON.stringify(session)) as ChatSession
}

function sumSessionUsageEntries(
  entries: AiUsageEntry[],
  sessionId: string,
): ChatSessionUsage {
  return entries
    .filter((e) => e.sessionId === sessionId || e.sessionId === LEGACY_ACTIVE_CHAT_ID)
    .reduce(
      (acc, e) => ({
        inputTokens: acc.inputTokens + e.inputTokens,
        outputTokens: acc.outputTokens + e.outputTokens,
        costUsd: acc.costUsd + e.costUsd,
      }),
      emptyUsageTotals(),
    )
}

function resolveChatProviderId(
  providers: AiProviderConfig[],
  chatProviderId: string | undefined,
  legacyActiveProviderId: string | undefined,
): string | undefined {
  if (chatProviderId && providers.some((p) => p.id === chatProviderId)) {
    return chatProviderId
  }
  if (
    legacyActiveProviderId &&
    providers.some((p) => p.id === legacyActiveProviderId)
  ) {
    return legacyActiveProviderId
  }
  if (providers.length === 1) return providers[0]?.id
  return undefined
}

function withResolvedChatProvider(
  session: ChatSession,
  providers: AiProviderConfig[],
  legacyActiveProviderId?: string,
): ChatSession {
  const providerId = resolveChatProviderId(
    providers,
    session.providerId,
    legacyActiveProviderId,
  )
  if (!providerId) {
    if (!session.providerId) return session
    const { providerId: _removed, modelId: _model, ...rest } = session
    return rest as ChatSession
  }
  const provider = providers.find((p) => p.id === providerId)
  if (
    session.providerId === providerId &&
    session.modelId === provider?.defaultModelId
  ) {
    return session
  }
  return {
    ...session,
    providerId,
    modelId: provider?.defaultModelId,
  }
}

export const useAiStore = defineStore('ai', () => {
  const profileStore = useProfileStore()
  const modelsCatalogStore = useModelsCatalogStore()
  const settings = ref<AiSettingsEntity | null>(null)
  const chat = ref<ChatSession | null>(null)
  const activeChatKey = ref('home')
  const chatScrollByKey = ref<Record<string, ChatScrollState>>({})
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
  let legacyMigrated = false

  function repo(): EncryptedRepo {
    if (!profileStore.activeProfileId) throw new Error('Aktif profil yok.')
    return new EncryptedRepo(profileStore.activeProfileId, profileStore.encryptionKey)
  }

  function currentSessionId(): string {
    return chatSessionStorageId(activeChatKey.value)
  }

  function saveChatScroll(key: string, state: ChatScrollState): void {
    chatScrollByKey.value = { ...chatScrollByKey.value, [key]: state }
  }

  function getChatScroll(key: string): ChatScrollState | undefined {
    return chatScrollByKey.value[key]
  }

  function clearChatScroll(key: string): void {
    if (!(key in chatScrollByKey.value)) return
    const next = { ...chatScrollByKey.value }
    delete next[key]
    chatScrollByKey.value = next
  }

  async function migrateLegacySession(r: EncryptedRepo): Promise<void> {
    if (legacyMigrated) return
    legacyMigrated = true

    const legacyRow = await r.get<ChatSession>(LEGACY_ACTIVE_CHAT_ID)
    const legacyData = legacyRow?.data
    if (!legacyData?.messages?.length) return

    const targetId = chatSessionStorageId('ai')
    const existing = await r.get<ChatSession>(targetId)
    const now = new Date().toISOString()

    if (!existing?.data?.messages?.length) {
      const migrated: ChatSession = {
        ...legacyData,
        id: targetId,
        updatedAt: now,
      }
      await r.put({
        id: targetId,
        type: 'chatSession',
        updatedAt: now,
        data: migrated,
      })
    }

    const usageRows = await r.list<AiUsageEntry>('aiUsage')
    for (const row of usageRows) {
      if (row.data.sessionId !== LEGACY_ACTIVE_CHAT_ID) continue
      const updated: AiUsageEntry = {
        ...row.data,
        sessionId: targetId,
        updatedAt: now,
      }
      await r.put({
        id: row.id,
        type: 'aiUsage',
        updatedAt: now,
        data: updated,
      })
    }

    await r.delete(LEGACY_ACTIVE_CHAT_ID)
    usageEntries.value = usageEntries.value.map((entry) =>
      entry.sessionId === LEGACY_ACTIVE_CHAT_ID ?
        { ...entry, sessionId: targetId }
      : entry,
    )
  }

  async function load(): Promise<void> {
    if (!profileStore.activeProfileId) return
    await modelsCatalogStore.load()
    const r = repo()
    await migrateLegacySession(r)
    const settingsRow = await r.get<AiSettingsEntity>(AI_SETTINGS_ID)
    const usageRows = await r.list<AiUsageEntry>('aiUsage')
    const now = new Date().toISOString()
    settings.value = settingsRow?.data ?? defaultSettingsEntity(now)
    usageEntries.value = usageRows.map((row) => row.data).sort((a, b) => b.at.localeCompare(a.at))
    loaded.value = true
  }

  async function switchSession(key: string): Promise<void> {
    if (!profileStore.activeProfileId) return
    if (!loaded.value) await load()

    if (activeChatKey.value === key && chat.value?.id === chatSessionStorageId(key)) {
      return
    }

    if (streaming.value) stopStreaming()

    activeChatKey.value = key
    const sessionId = chatSessionStorageId(key)
    const r = repo()
    const chatRow = await r.get<ChatSession>(sessionId)
    const now = new Date().toISOString()
    const settingsData = settings.value ?? defaultSettingsEntity(now)

    let chatData = chatRow?.data ?? emptyChat(sessionId, now)
    if (!chatData.usageTotals) {
      const migrated = sumSessionUsageEntries(usageEntries.value, sessionId)
      if (migrated.inputTokens || migrated.outputTokens) {
        chatData = { ...chatData, usageTotals: migrated }
        await r.put({
          id: sessionId,
          type: 'chatSession',
          updatedAt: now,
          data: chatData,
        })
      }
    }

    const resolvedChat = withResolvedChatProvider(
      chatData,
      settingsData.providers,
      settingsData.activeProviderId,
    )
    if (resolvedChat !== chatData) {
      await r.put({
        id: sessionId,
        type: 'chatSession',
        updatedAt: now,
        data: resolvedChat,
      })
      chatData = resolvedChat
    }

    const normalizedMessages = chatData.messages.map(normalizeChatMessage)
    const prunedMessages = pruneTrailingEmptyAssistantMessages(normalizedMessages)
    if (prunedMessages.length !== normalizedMessages.length) {
      chatData = { ...chatData, messages: prunedMessages, updatedAt: now }
      await r.put({
        id: sessionId,
        type: 'chatSession',
        updatedAt: now,
        data: chatData,
      })
    }

    chat.value = {
      ...chatData,
      messages: prunedMessages,
    }
    streamError.value = null
    turnUsage.value = emptyUsageTotals()
  }

  function reset(): void {
    settings.value = null
    chat.value = null
    activeChatKey.value = 'home'
    chatScrollByKey.value = {}
    usageEntries.value = []
    loaded.value = false
    streaming.value = false
    streamError.value = null
    turnUsage.value = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    legacyMigrated = false
    abortController?.abort()
    abortController = null
  }

  const activeProvider = computed(() => {
    const s = settings.value
    if (!s?.providers.length) return undefined
    const id = resolveChatProviderId(
      s.providers,
      chat.value?.providerId,
      s.activeProviderId,
    )
    if (!id) return undefined
    return s.providers.find((p) => p.id === id)
  })

  const showProviderPicker = computed(
    () => (settings.value?.providers.length ?? 0) > 1,
  )

  /** Sağ alttaki floating sohbet düğmesi (Ayarlar → AI). */
  const showFloatingChatFab = computed(
    () => settings.value?.showFloatingChatFab !== false,
  )

  const chatProviderOptions = computed(() =>
    (settings.value?.providers ?? []).map((p) => ({
      value: p.id,
      label: p.label,
    })),
  )

  const lastUsedProviderId = computed(() => activeProvider.value?.id)

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
      customSystemPrompt: s.customSystemPrompt,
      showFloatingChatFab: s.showFloatingChatFab,
      providers,
    })
    const session = chat.value ?? emptyChat(currentSessionId(), new Date().toISOString())
    if (!session.providerId || idx < 0) {
      await persistChat(
        withResolvedChatProvider(session, providers, undefined),
      )
    }
  }

  async function removeProvider(id: string): Promise<void> {
    const s = settings.value
    if (!s) return
    const providers = s.providers.filter((p) => p.id !== id)
    await saveSettings({
      customSystemPrompt: s.customSystemPrompt,
      showFloatingChatFab: s.showFloatingChatFab,
      providers,
    })
    const session = chat.value
    if (session?.providerId === id) {
      await persistChat(withResolvedChatProvider(session, providers, undefined))
    }
  }

  async function setChatProvider(providerId: string): Promise<void> {
    const s = settings.value
    if (!s) return
    const provider = s.providers.find((p) => p.id === providerId)
    if (!provider) return
    const now = new Date().toISOString()
    const session = chat.value ?? emptyChat(currentSessionId(), now)
    await persistChat({
      ...session,
      providerId,
      modelId: provider.defaultModelId,
      updatedAt: now,
    })
  }

  async function persistChat(next: ChatSession): Promise<void> {
    const now = new Date().toISOString()
    const entity = plainChatSession({ ...next, updatedAt: now })
    await repo().put({
      id: entity.id,
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
    const sessionId = currentSessionId()
    const r = repo()
    const rows = await r.list<AiUsageEntry>('aiUsage')
    const sessionRows = rows.filter(
      (row) =>
        row.data.sessionId === sessionId ||
        row.data.sessionId === LEGACY_ACTIVE_CHAT_ID,
    )
    await Promise.all(sessionRows.map((row) => r.delete(row.id)))
    usageEntries.value = usageEntries.value.filter(
      (e) => e.sessionId !== sessionId && e.sessionId !== LEGACY_ACTIVE_CHAT_ID,
    )
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

    const snapshot = buildAiFinanceSnapshot(profileMeta, decoded, profile.localeSettings)
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

  async function commitAssistantTurn(input: {
    baseSession: ChatSession
    assistantId: string
    messages: ChatMessage[]
    assistantText: string
    usage: TokenUsage
    catalog: ReturnType<typeof modelsCatalogStore.modelCatalog> | undefined
    provider: AiProviderConfig
    aborted?: boolean
  }): Promise<void> {
    const { baseSession, assistantId, messages, assistantText, usage, catalog, provider, aborted } =
      input
    const liveContent = messages.find((m) => m.id === assistantId)?.content ?? assistantText
    const trimmed = liveContent.trim()

    if (!trimmed) {
      const pruned = pruneTrailingEmptyAssistantMessages(messages)
      await persistChat({
        ...baseSession,
        messages: pruned,
        updatedAt: new Date().toISOString(),
      })
      if (!aborted) {
        streamError.value = 'Sağlayıcıdan boş yanıt alındı.'
      }
      return
    }

    const finalNow = new Date().toISOString()
    const finalMessages = messages.map((m) =>
      m.id === assistantId ? { ...m, content: liveContent, createdAt: finalNow } : m,
    )
    const costUsd = computeCostUsd(catalog, usage)
    const prevTotals = baseSession.usageTotals ?? chat.value?.usageTotals ?? emptyUsageTotals()
    const usageTotals: ChatSessionUsage = {
      inputTokens: prevTotals.inputTokens + usage.inputTokens,
      outputTokens: prevTotals.outputTokens + usage.outputTokens,
      costUsd: prevTotals.costUsd + costUsd,
    }
    await persistChat({
      ...baseSession,
      messages: finalMessages,
      usageTotals,
      updatedAt: finalNow,
    })

    if (usage.inputTokens || usage.outputTokens) {
      await appendUsage({
        at: finalNow,
        providerId: provider.id,
        modelId: provider.defaultModelId ?? '',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costUsd,
        sessionId: currentSessionId(),
      })
    }
  }

  async function sendMessage(text: string, attachments?: ChatAttachment[]): Promise<void> {
    const trimmed = text.trim()
    const attachmentList = attachments?.length ? [...attachments] : undefined
    if ((!trimmed && !attachmentList?.length) || streaming.value) return

    const provider = activeProvider.value
    const needsKey = provider?.provider !== 'ollama' && provider?.provider !== 'vllm'
    const key = normalizeApiKey(provider?.apiKey)
    if (!provider || (needsKey && !key)) {
      streamError.value =
        showProviderPicker.value && !chat.value?.providerId ?
          'Sohbet için bir sağlayıcı seçin.'
        : 'API anahtarı tanımlı değil. Ayarlar → AI bölümünden ekleyin.'
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
    const session = chat.value ?? emptyChat(currentSessionId(), now)
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
    let assistantText = ''
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

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

      await commitAssistantTurn({
        baseSession: nextSession,
        assistantId,
        messages: liveMessages,
        assistantText,
        usage,
        catalog,
        provider,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        await commitAssistantTurn({
          baseSession: nextSession,
          assistantId,
          messages: liveMessages,
          assistantText,
          usage,
          catalog,
          provider,
          aborted: true,
        })
        return
      }
      streamError.value = error instanceof Error ? error.message : String(error)
      await commitAssistantTurn({
        baseSession: nextSession,
        assistantId,
        messages: liveMessages,
        assistantText,
        usage,
        catalog,
        provider,
        aborted: true,
      })
    } finally {
      streaming.value = false
      abortController = null
    }
  }

  async function clearChat(): Promise<void> {
    stopStreaming()
    const now = new Date().toISOString()
    const sessionId = currentSessionId()
    const lastProviderId = chat.value?.providerId
    await clearSessionUsageEntries()
    turnUsage.value = emptyUsageTotals()
    const next = emptyChat(sessionId, now)
    if (lastProviderId) {
      const provider = settings.value?.providers.find((p) => p.id === lastProviderId)
      if (provider) {
        next.providerId = lastProviderId
        next.modelId = provider.defaultModelId
      }
    }
    await persistChat(next)
    clearChatScroll(activeChatKey.value)
  }

  async function markProposalApplied(messageId: string, bundleKey: string): Promise<void> {
    const session = chat.value
    if (!session) return
    const messages = session.messages.map((m) => {
      if (m.id !== messageId) return m
      const keys = m.appliedProposalKeys ?? []
      if (keys.includes(bundleKey)) return m
      return {
        ...m,
        appliedProposalKeys: [...keys, bundleKey],
      }
    })
    await persistChat({ ...session, messages })
    notifySyncLocalChange()
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
    activeChatKey,
    usageEntries,
    loaded,
    streaming,
    streamError,
    turnUsage,
    sessionUsage,
    activeProvider,
    lastUsedProviderId,
    showProviderPicker,
    showFloatingChatFab,
    chatProviderOptions,
    modelOptions,
    totalUsageCost,
    load,
    reset,
    switchSession,
    saveSettings,
    upsertProvider,
    removeProvider,
    setChatProvider,
    sendMessage,
    clearChat,
    stopStreaming,
    markProposalApplied,
    newProviderDraft,
    saveChatScroll,
    getChatScroll,
    clearChatScroll,
  }
})
