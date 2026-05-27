<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Alert,
  Button,
  Input,
  message,
  Popconfirm,
  Space,
  Spin,
  Typography,
} from 'ant-design-vue'
import KpSelect from '@/components/KpSelect.vue'
import {
  PaperClipOutlined,
  SendOutlined,
  StopOutlined,
  SettingOutlined,
  DeleteOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FileOutlined,
  CloseCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import KpMarkdown from '@/components/KpMarkdown.vue'
import AiProposalPanel from '@/components/AiProposalPanel.vue'
import KpTypingDots from '@/components/KpTypingDots.vue'
import KpTooltip from '@/components/KpTooltip.vue'
import type { ChatAttachment, ChatMessage } from '@/core/types/ai'
import { useAiStore } from '@/stores/ai'
import { useConnectivity } from '@/composables/useConnectivity'
import { formatCostUsd, formatTokenCount } from '@/features/ai/cost'
import {
  attachmentLabel,
  getMessageAttachments,
} from '@/features/ai/attachment-utils'
import {
  CHAT_ATTACHMENT_LIMITS,
  attachmentDataUrl,
  fileToChatAttachment,
} from '@/features/ai/chat-attachments'
import { isHiddenAiContextMessage } from '@/features/ai/snapshot'
import {
  extractProposalBundles,
  stripProposalBlocks,
} from '@/features/ai/proposals/parse'
import {
  attachmentsNotSupportedMessage,
  supportsChatAttachments,
} from '@/features/ai/providers/vision'
import {
  KP_AI_CHAT_FLOATING_OVERLAY_Z_INDEX,
  KP_AI_CHAT_OVERLAY_Z_INDEX_KEY,
} from '@/components/kp-ai-chat-overlay'

const props = withDefaults(
  defineProps<{
    emptyHint: string
    variant?: 'embedded' | 'floating'
    expandable?: boolean
    expanded?: boolean
    showClose?: boolean
    toolbarTitle?: string
  }>(),
  {
    variant: 'embedded',
    expandable: false,
    expanded: false,
    showClose: false,
    toolbarTitle: 'Sohbet',
  },
)

const emit = defineEmits<{
  'update:expanded': [value: boolean]
  close: []
}>()

const ai = useAiStore()
const router = useRouter()
const { online } = useConnectivity()

const overlayZIndex = computed(() =>
  props.variant === 'floating' ? KP_AI_CHAT_FLOATING_OVERLAY_Z_INDEX : undefined,
)
provide(KP_AI_CHAT_OVERLAY_Z_INDEX_KEY, overlayZIndex)

const draft = ref('')
const pendingAttachments = ref<ChatAttachment[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const stickToBottom = ref(ai.getChatScroll(ai.activeChatKey)?.stickToBottom ?? true)
let suppressScrollPinUpdate = false

const SCROLL_BOTTOM_THRESHOLD_PX = 64

const MESSAGE_INPUT_PLACEHOLDER =
  'Mesajınızı yazın veya dosya/görsel yapıştırıp yükleyin\n(Enter gönderir, Shift+Enter yeni satıra geçer)'

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_BOTTOM_THRESHOLD_PX
}

function scrollMessagesToBottom(): void {
  const el = listRef.value
  if (!el) return
  suppressScrollPinUpdate = true
  el.scrollTop = el.scrollHeight
  requestAnimationFrame(() => {
    suppressScrollPinUpdate = false
  })
}

function persistScrollPosition(key: string = ai.activeChatKey): void {
  const el = listRef.value
  if (!el || !key) return
  ai.saveChatScroll(key, {
    scrollTop: el.scrollTop,
    stickToBottom: stickToBottom.value,
  })
}

function restoreScrollPosition(key: string = ai.activeChatKey): void {
  const el = listRef.value
  if (!el || !key) return
  const saved = ai.getChatScroll(key)
  if (!saved) {
    stickToBottom.value = true
    if (visibleMessages.value.length) scrollMessagesToBottom()
    return
  }
  stickToBottom.value = saved.stickToBottom
  suppressScrollPinUpdate = true
  el.scrollTop = saved.scrollTop
  requestAnimationFrame(() => {
    suppressScrollPinUpdate = false
  })
}

function onMessagesScroll(): void {
  if (suppressScrollPinUpdate) return
  const el = listRef.value
  if (!el) return
  stickToBottom.value = isNearBottom(el)
  persistScrollPosition()
}

function toggleExpanded(): void {
  emit('update:expanded', !props.expanded)
}

const attachmentUploadHint = computed(() => {
  if (!(ai.settings?.providers.length ?? 0)) {
    return 'Önce Ayarlar → AI bölümünden sağlayıcı ekleyin.'
  }
  if (ai.showProviderPicker && !ai.chat?.providerId) {
    return 'Önce sağlayıcı seçin.'
  }
  const provider = ai.activeProvider?.provider
  if (!provider) return 'Sağlayıcı yapılandırılmadı.'
  return 'Görsel veya dosya ekle (JPEG, PNG, PDF, TXT, CSV, JSON)'
})

const hasProviders = computed(() => (ai.settings?.providers.length ?? 0) > 0)

/** Tam sayfa AI Asistan'da sayfa düzeyinde gösterilir; panel içinde tekrarlanmaz. */
const showProviderSetupBanner = computed(() => props.variant !== 'embedded')

const needsProviderSelection = computed(
  () => ai.showProviderPicker && !ai.chat?.providerId,
)

const chatProviderId = computed({
  get: () => ai.chat?.providerId,
  set: (value: string | undefined) => {
    if (value) void ai.setChatProvider(value)
  },
})

const pendingAttachmentProbe = computed(() =>
  pendingAttachments.value.length ?
    [{ role: 'user' as const, content: draft.value, attachments: pendingAttachments.value }]
  : [],
)

const supportsPendingAttachments = computed(() => {
  const provider = ai.activeProvider?.provider
  if (!provider || !pendingAttachments.value.length) return true
  return supportsChatAttachments(
    provider,
    pendingAttachmentProbe.value,
    ai.activeProvider?.defaultModelId,
  )
})

const canSend = computed(
  () =>
    online.value &&
    !ai.streaming &&
    (draft.value.trim().length > 0 || pendingAttachments.value.length > 0) &&
    Boolean(ai.activeProvider?.defaultModelId) &&
    supportsPendingAttachments.value,
)

const usageLine = computed(() => {
  const u = ai.sessionUsage
  if (!u.inputTokens && !u.outputTokens) return null
  return `Oturum: ${formatTokenCount(u.inputTokens)} girdi · ${formatTokenCount(u.outputTokens)} çıktı · ${formatCostUsd(u.costUsd)}`
})

const visibleMessages = computed(() =>
  (ai.chat?.messages ?? []).filter((m) => !isHiddenAiContextMessage(m.content)),
)

const showEmptyHint = computed(
  () => ai.loaded && !visibleMessages.value.length,
)

const streamingAssistantId = computed(() => {
  if (!ai.streaming) return null
  const messages = ai.chat?.messages
  if (!messages?.length) return null
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg?.role === 'assistant' && !msg.content) return msg.id
  }
  return null
})

function messageProposals(content: string) {
  return extractProposalBundles(content)
}

function displayContent(content: string): string {
  return stripProposalBlocks(content)
}

watch(
  () => ai.activeChatKey,
  async (_newKey, oldKey) => {
    if (oldKey) persistScrollPosition(oldKey)
    await nextTick()
    await nextTick()
    restoreScrollPosition()
  },
)

watch(
  () => ai.chat?.messages.map((m) => m.content).join('\n'),
  async () => {
    if (!stickToBottom.value) return
    await nextTick()
    scrollMessagesToBottom()
  },
)

onMounted(async () => {
  if (!ai.loaded) return
  await nextTick()
  restoreScrollPosition()
})

onBeforeUnmount(() => {
  persistScrollPosition()
})

watch(
  () => ai.loaded,
  async (loaded) => {
    if (!loaded) return
    await nextTick()
    restoreScrollPosition()
  },
)

async function clearChatHistory(): Promise<void> {
  await ai.clearChat()
  stickToBottom.value = true
  await nextTick()
  const el = listRef.value
  if (el) el.scrollTop = 0
}

async function submit(): Promise<void> {
  const text = draft.value
  const attachments =
    pendingAttachments.value.length ? [...pendingAttachments.value] : undefined
  draft.value = ''
  pendingAttachments.value = []
  stickToBottom.value = true
  await ai.sendMessage(text, attachments)
  await nextTick()
  scrollMessagesToBottom()
}

function openFilePicker(): void {
  fileInputRef.value?.click()
}

async function addAttachmentsFromFiles(files: FileList | File[]): Promise<void> {
  const list = Array.from(files)
  if (!list.length) return

  const remaining = CHAT_ATTACHMENT_LIMITS.maxCount - pendingAttachments.value.length
  if (remaining <= 0) {
    message.warning(`En fazla ${CHAT_ATTACHMENT_LIMITS.maxCount} dosya eklenebilir.`)
    return
  }

  const batch = list.slice(0, remaining)
  if (list.length > remaining) {
    message.warning(`En fazla ${CHAT_ATTACHMENT_LIMITS.maxCount} dosya eklenebilir; fazlası atlandı.`)
  }

  for (const file of batch) {
    try {
      pendingAttachments.value.push(await fileToChatAttachment(file))
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error))
    }
  }

  const provider = ai.activeProvider?.provider
  if (provider && pendingAttachments.value.length && !supportsPendingAttachments.value) {
    message.warning(attachmentsNotSupportedMessage(provider, pendingAttachmentProbe.value))
  }
}

function onFileInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) void addAttachmentsFromFiles(input.files)
  input.value = ''
}

function removePendingAttachment(id: string): void {
  pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== id)
}

function messageAttachments(msg: ChatMessage): ChatAttachment[] {
  return getMessageAttachments(msg)
}

function onPaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length) {
    event.preventDefault()
    void addAttachmentsFromFiles(files)
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canSend.value) void submit()
  }
}

function goToAiSettings(): void {
  if (props.variant === 'floating') emit('close')
  router.push({ name: 'settings', query: { tab: 'ai' } })
}
</script>

<template>
  <div
    class="kp-ai-chat"
    :class="{
      'kp-ai-chat--disabled': !online,
      'kp-ai-chat--embedded': variant === 'embedded',
      'kp-ai-chat--floating': variant === 'floating',
      'kp-ai-chat--expanded': expanded,
    }"
  >
    <div class="kp-ai-chat__toolbar">
      <Typography.Text strong>
        {{ expanded ? 'AI Asistan' : toolbarTitle }}
      </Typography.Text>
      <div class="kp-ai-chat__toolbar-actions">
        <KpSelect
          v-if="ai.showProviderPicker"
          v-model:value="chatProviderId"
          :options="ai.chatProviderOptions"
          placeholder="Sağlayıcı"
          size="small"
          :disabled="!online || ai.streaming"
          class="kp-ai-chat__provider-select"
        />
        <KpTooltip v-if="expandable" :title="expanded ? 'Küçült (Esc)' : 'Tam ekran'">
          <Button
            type="text"
            size="small"
            :aria-label="expanded ? 'Sohbeti küçült' : 'Sohbeti tam ekran yap'"
            @click="toggleExpanded"
          >
            <FullscreenExitOutlined v-if="expanded" />
            <FullscreenOutlined v-else />
          </Button>
        </KpTooltip>
        <KpTooltip v-if="showClose" title="Kapat">
          <Button
            type="text"
            size="small"
            aria-label="Sohbeti kapat"
            @click="emit('close')"
          >
            <CloseOutlined />
          </Button>
        </KpTooltip>
      </div>
    </div>

    <Alert
      v-if="!online"
      type="warning"
      show-icon
      banner
      message="Çevrimdışısınız — AI sohbet kullanılamaz."
      class="kp-ai-chat__banner"
    />
    <Alert
      v-else-if="ai.loaded && !hasProviders && showProviderSetupBanner"
      type="info"
      show-icon
      banner
      class="kp-ai-chat__banner"
    >
      <template #message>AI sağlayıcısı yapılandırılmadı.</template>
      <template #description>
        <Button type="link" size="small" class="kp-ai-chat__settings-link" @click="goToAiSettings">
          <SettingOutlined />
          AI ayarlarına git
        </Button>
      </template>
    </Alert>
    <Alert
      v-else-if="ai.loaded && needsProviderSelection"
      type="info"
      show-icon
      banner
      message="Mesaj göndermek için sağlayıcı seçin."
      class="kp-ai-chat__banner"
    />

    <div
      ref="listRef"
      class="kp-ai-chat__messages"
      :class="{ 'kp-ai-chat__messages--empty': showEmptyHint }"
      @scroll="onMessagesScroll"
    >
      <Spin v-if="!ai.loaded" />
      <Typography.Paragraph v-else-if="showEmptyHint" type="secondary" class="kp-ai-chat__empty">
        {{ emptyHint }}
      </Typography.Paragraph>
      <div
        v-for="msg in visibleMessages"
        :key="msg.id"
        class="kp-ai-chat__bubble"
        :class="`kp-ai-chat__bubble--${msg.role}`"
      >
        <Typography.Text type="secondary" class="kp-ai-chat__role">
          {{ msg.role === 'user' ? 'Siz' : 'Asistan' }}
        </Typography.Text>
        <div v-if="msg.role === 'user'" class="kp-ai-chat__content">
          <div v-if="messageAttachments(msg).length" class="kp-ai-chat__attachments">
            <template v-for="att in messageAttachments(msg)" :key="att.id">
              <img
                v-if="att.kind === 'image'"
                class="kp-ai-chat__image"
                :src="attachmentDataUrl(att)"
                :alt="attachmentLabel(att)"
              />
              <div v-else class="kp-ai-chat__file-chip">
                <FileOutlined />
                <span>{{ attachmentLabel(att) }}</span>
              </div>
            </template>
          </div>
          <div v-if="msg.content" class="kp-ai-chat__text">{{ msg.content }}</div>
        </div>
        <div v-else class="kp-ai-chat__content kp-ai-chat__content--md">
          <KpTypingDots v-if="msg.id === streamingAssistantId && !msg.content.trim()" />
          <template v-else>
            <KpMarkdown
              v-if="displayContent(msg.content).trim()"
              :source="displayContent(msg.content)"
            />
              <AiProposalPanel
                v-for="(bundle, index) in messageProposals(msg.content)"
                :key="`${msg.id}-proposal-${index}`"
                :message-id="msg.id"
                :bundle="bundle"
              />
            </template>
          </div>
      </div>
    </div>

    <Alert
      v-if="ai.streamError"
      type="error"
      :message="ai.streamError"
      show-icon
      banner
      class="kp-ai-chat__error"
    />

    <div class="kp-ai-chat__composer">
      <input
        ref="fileInputRef"
        type="file"
        class="kp-ai-chat__file-input"
        :accept="CHAT_ATTACHMENT_LIMITS.accept"
        multiple
        @change="onFileInputChange"
      />
      <div v-if="pendingAttachments.length" class="kp-ai-chat__pending">
        <div
          v-for="att in pendingAttachments"
          :key="att.id"
          class="kp-ai-chat__pending-item"
        >
          <img
            v-if="att.kind === 'image'"
            class="kp-ai-chat__image"
            :src="attachmentDataUrl(att)"
            :alt="attachmentLabel(att)"
          />
          <div
            v-else
            class="kp-ai-chat__file-chip kp-ai-chat__file-chip--pending"
          >
            <FileOutlined />
            <span>{{ attachmentLabel(att) }}</span>
            <button
              type="button"
              class="kp-ai-chat__pending-remove"
              aria-label="Dosyayı kaldır"
              @click="removePendingAttachment(att.id)"
            >
              <CloseCircleOutlined />
            </button>
          </div>
          <button
            v-if="att.kind === 'image'"
            type="button"
            class="kp-ai-chat__pending-remove"
            aria-label="Dosyayı kaldır"
            @click="removePendingAttachment(att.id)"
          >
            <CloseCircleOutlined />
          </button>
        </div>
      </div>
      <Input.TextArea
        v-model:value="draft"
        :disabled="!online || ai.streaming"
        :placeholder="MESSAGE_INPUT_PLACEHOLDER"
        :auto-size="{ minRows: 2, maxRows: 6 }"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <div class="kp-ai-chat__footer">
        <Typography.Text v-if="usageLine" type="secondary" class="kp-ai-chat__usage">
          {{ usageLine }}
        </Typography.Text>
        <Space wrap class="kp-ai-chat__actions">
          <KpTooltip :title="attachmentUploadHint">
            <Button
              :disabled="
                !online ||
                ai.streaming ||
                pendingAttachments.length >= CHAT_ATTACHMENT_LIMITS.maxCount
              "
              aria-label="Dosya ekle"
              @click="openFilePicker"
            >
              <PaperClipOutlined />
            </Button>
          </KpTooltip>
          <Popconfirm
            title="Sohbet geçmişi ve bu oturumun kullanım özeti temizlensin mi?"
            ok-text="Temizle"
            cancel-text="Vazgeç"
            :z-index="overlayZIndex"
            :disabled="!visibleMessages.length && !ai.sessionUsage.inputTokens && !ai.sessionUsage.outputTokens"
            @confirm="clearChatHistory()"
          >
            <Button
              :disabled="
                !visibleMessages.length &&
                !ai.sessionUsage.inputTokens &&
                !ai.sessionUsage.outputTokens
              "
            >
              <DeleteOutlined />
              Temizle
            </Button>
          </Popconfirm>
          <Button v-if="ai.streaming" danger @click="ai.stopStreaming()">
            <StopOutlined />
            Durdur
          </Button>
          <Button v-else type="primary" :disabled="!canSend" @click="submit">
            <SendOutlined />
            Gönder
          </Button>
        </Space>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kp-ai-chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* Ant Design taban (Teleport ile body'de de AI Asistan sayfasıyla aynı) */
  font-size: 14px;
  line-height: 1.5714285714285714;
  color: rgba(0, 0, 0, 0.88);
}

.kp-ai-chat :deep(.ant-typography) {
  font-size: inherit;
  line-height: inherit;
}

.kp-ai-chat :deep(.ant-typography-secondary) {
  color: rgba(0, 0, 0, 0.45);
}

.kp-ai-chat :deep(.ant-input),
.kp-ai-chat :deep(textarea.ant-input) {
  font-size: 14px;
  line-height: 1.5714285714285714;
}

.kp-ai-chat :deep(.ant-btn) {
  font-size: 14px;
}

.kp-ai-chat--embedded {
  flex: 1 1 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--kp-radius, 8px);
  background: #fff;
}

.kp-ai-chat--floating {
  flex: 1 1 0;
  height: 100%;
  background: #fff;
}

.kp-ai-chat--disabled {
  opacity: 0.72;
  pointer-events: none;
}

.kp-ai-chat__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.kp-ai-chat__toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  margin-left: auto;
}

.kp-ai-chat__provider-select {
  min-width: 140px;
  max-width: min(220px, 42vw);
}

.kp-ai-chat__settings-link {
  padding: 0;
  height: auto;
}

.kp-ai-chat__banner {
  flex-shrink: 0;
}

.kp-ai-chat__messages {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.kp-ai-chat__messages--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.kp-ai-chat__empty {
  text-align: center;
  margin: 0;
  padding: 0 12px;
  max-width: 100%;
  white-space: normal;
  line-height: 1.5;
  text-wrap: balance;
}

.kp-ai-chat__bubble {
  margin-bottom: 12px;
  max-width: 92%;
}

.kp-ai-chat__bubble--user {
  margin-left: auto;
}

.kp-ai-chat__bubble--assistant {
  margin-right: auto;
}

.kp-ai-chat__role {
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
}

.kp-ai-chat__content {
  word-break: break-word;
  padding: 10px 12px;
  border-radius: var(--kp-radius, 8px);
  background: rgba(0, 0, 0, 0.02);
}

.kp-ai-chat__bubble--user .kp-ai-chat__content {
  background: #e6f4ff;
}

.kp-ai-chat__bubble--user .kp-ai-chat__text {
  white-space: pre-wrap;
}

.kp-ai-chat__content--md {
  padding: 8px 12px;
}

.kp-ai-chat__error {
  flex-shrink: 0;
}

.kp-ai-chat__composer {
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.kp-ai-chat__file-input {
  display: none;
}

.kp-ai-chat__pending {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.kp-ai-chat__pending-item {
  position: relative;
  flex: 0 0 auto;
  max-width: 100%;
}

.kp-ai-chat__pending-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.kp-ai-chat__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.kp-ai-chat__file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 13px;
  max-width: min(280px, 100%);
}

.kp-ai-chat__file-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kp-ai-chat__file-chip--pending {
  position: relative;
  display: inline-flex;
  max-width: 280px;
  padding-right: 28px;
}

.kp-ai-chat__image {
  display: block;
  max-width: min(240px, 100%);
  max-height: 180px;
  border-radius: 6px;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.04);
}

.kp-ai-chat__pending-item:has(> .kp-ai-chat__image) {
  display: inline-block;
  width: fit-content;
}

.kp-ai-chat__text {
  white-space: pre-wrap;
  font-size: inherit;
  line-height: inherit;
}

.kp-ai-chat__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.kp-ai-chat__usage {
  font-size: 12px;
  line-height: 1.4;
  min-width: 0;
  flex: 1 1 12rem;
}

.kp-ai-chat__actions {
  justify-content: flex-end;
  flex: 0 0 auto;
  margin-left: auto;
}

[data-theme='dark'] .kp-ai-chat--embedded,
[data-theme='dark'] .kp-ai-chat--floating {
  background: #1f1f1f;
  border-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

[data-theme='dark'] .kp-ai-chat :deep(.ant-typography-secondary) {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-ai-chat__toolbar {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .kp-ai-chat__content {
  background: rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .kp-ai-chat__bubble--user .kp-ai-chat__content {
  background: rgba(22, 119, 255, 0.22);
}

[data-theme='dark'] .kp-ai-chat__composer {
  border-top-color: rgba(255, 255, 255, 0.08);
}
</style>
