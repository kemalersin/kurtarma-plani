<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
} from '@ant-design/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import KpNotice from '@/components/KpNotice.vue'
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

const ai = useAiStore()
const router = useRouter()
const { online } = useConnectivity()

const draft = ref('')
const pendingAttachments = ref<ChatAttachment[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const chatExpanded = ref(false)

onMounted(async () => {
  if (!ai.loaded) await ai.load()
  window.addEventListener('keydown', onEscapeKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscapeKey)
  document.body.style.overflow = ''
})

function onEscapeKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && chatExpanded.value) chatExpanded.value = false
}

watch(chatExpanded, (expanded) => {
  document.body.style.overflow = expanded ? 'hidden' : ''
})

function toggleChatExpanded(): void {
  chatExpanded.value = !chatExpanded.value
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

function isLastMessage(messageId: string): boolean {
  const messages = visibleMessages.value
  if (!messages.length) return false
  return messages[messages.length - 1]?.id === messageId
}

watch(
  () => ai.chat?.messages.map((m) => m.content).join('\n'),
  async () => {
    await nextTick()
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  },
)

async function submit(): Promise<void> {
  const text = draft.value
  const attachments =
    pendingAttachments.value.length ? [...pendingAttachments.value] : undefined
  draft.value = ''
  pendingAttachments.value = []
  await ai.sendMessage(text, attachments)
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
</script>

<template>
  <div class="kp-ai-page" :class="{ 'kp-ai-page--expanded': chatExpanded }">
    <template v-if="!chatExpanded">
      <PageHeader
        title="AI Asistan"
        subtitle="Finans verileriniz üzerinde analiz ve planlama (yalnızca çevrimiçi)."
      />

      <KpNotice
        v-if="!online"
        tone="warning"
        title="Çevrimdışısınız"
        detail="AI sohbet yalnızca internet bağlantısı varken kullanılabilir. Finans modülleri çevrimdışı çalışmaya devam eder."
        class="kp-ai-page__notice"
      />

      <Alert
        v-else-if="ai.loaded && !hasProviders"
        type="info"
        show-icon
        message="AI sağlayıcısı yapılandırılmadı"
        class="kp-ai-page__notice"
      >
        <template #description>
          <Typography.Paragraph class="kp-ai-page__alert-desc">
            Ayarlar → AI sekmesinden API anahtarı ve model ekleyin.
          </Typography.Paragraph>
          <Button type="primary" size="small" @click="router.push({ name: 'settings', query: { tab: 'ai' } })">
            <SettingOutlined />
            AI ayarlarına git
          </Button>
        </template>
      </Alert>
    </template>

    <div
      class="kp-ai-chat"
      :class="{
        'kp-ai-chat--disabled': !online,
        'kp-ai-chat--expanded': chatExpanded,
      }"
    >
      <div class="kp-ai-chat__toolbar">
        <Typography.Text strong>{{ chatExpanded ? 'AI Asistan' : 'Sohbet' }}</Typography.Text>
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
          <KpTooltip :title="chatExpanded ? 'Küçült (Esc)' : 'Tam ekran'">
            <Button
              type="text"
              size="small"
              :aria-label="chatExpanded ? 'Sohbeti küçült' : 'Sohbeti tam ekran yap'"
              @click="toggleChatExpanded"
            >
              <FullscreenExitOutlined v-if="chatExpanded" />
              <FullscreenOutlined v-else />
            </Button>
          </KpTooltip>
        </div>
      </div>

      <Alert
        v-if="chatExpanded && !online"
        type="warning"
        show-icon
        banner
        message="Çevrimdışısınız — AI sohbet kullanılamaz."
        class="kp-ai-chat__banner"
      />
      <Alert
        v-else-if="chatExpanded && ai.loaded && !hasProviders"
        type="info"
        show-icon
        banner
        message="AI sağlayıcısı yapılandırılmadı."
        class="kp-ai-chat__banner"
      />
      <Alert
        v-else-if="chatExpanded && ai.loaded && needsProviderSelection"
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
      >
        <Spin v-if="!ai.loaded" />
        <Typography.Paragraph v-else-if="showEmptyHint" type="secondary" class="kp-ai-chat__empty">
          Borç, nakit akışı ve varlıklarınız hakkında soru sorun. Yanıtlar profil verinize dayanır; hassas kayıtlar modele gönderilmez.
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
              <Typography.Text
                v-if="
                  isLastMessage(msg.id) &&
                  !msg.content.trim() &&
                  !messageProposals(msg.content).length
                "
                type="secondary"
                class="kp-ai-chat__empty-reply"
              >
                Yanıt alınamadı.
              </Typography.Text>
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
            <div v-else class="kp-ai-chat__file-chip kp-ai-chat__file-chip--pending">
              <FileOutlined />
              <span>{{ attachmentLabel(att) }}</span>
            </div>
            <button
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
          placeholder="Mesajınızı yazın veya dosya/görsel yapıştırın (Enter gönder, Shift+Enter satır)"
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
            :disabled="!visibleMessages.length && !ai.sessionUsage.inputTokens && !ai.sessionUsage.outputTokens"
            @confirm="ai.clearChat()"
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
  </div>
</template>

<style scoped>
.kp-ai-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.kp-ai-page--expanded {
  position: fixed;
  inset: 0;
  z-index: 300;
  height: auto;
  padding: 12px;
  box-sizing: border-box;
  background: var(--kp-bg, #f5f5f7);
}

.kp-ai-page__notice {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.kp-ai-page__alert-desc {
  margin-bottom: 8px;
}

.kp-ai-chat {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: var(--kp-radius, 8px);
  background: #fff;
  overflow: hidden;
}

.kp-ai-page--expanded .kp-ai-chat {
  flex: 1;
  min-height: 0;
  border-radius: var(--kp-radius, 8px);
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

.kp-ai-chat__banner {
  flex-shrink: 0;
}

.kp-ai-chat__messages {
  flex: 1;
  min-height: 160px;
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
  white-space: nowrap;
}

@media (max-width: 640px) {
  .kp-ai-chat__empty {
    white-space: normal;
    font-size: 13px;
    line-height: 1.45;
    text-wrap: balance;
  }
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

.kp-ai-chat__empty-reply {
  font-style: italic;
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
  gap: 8px;
  margin-bottom: 8px;
}

.kp-ai-chat__pending-item {
  position: relative;
}

.kp-ai-chat__pending-remove {
  position: absolute;
  top: -6px;
  right: -6px;
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
}

.kp-ai-chat__images,
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
  min-width: 120px;
}

.kp-ai-chat__images:last-child,
.kp-ai-chat__text:only-child {
  margin-bottom: 0;
}

.kp-ai-chat__image {
  display: block;
  max-width: min(240px, 100%);
  max-height: 180px;
  border-radius: 6px;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.04);
}

.kp-ai-chat__text {
  white-space: pre-wrap;
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

[data-theme='dark'] .kp-ai-page--expanded {
  background: var(--kp-bg, #141416);
}

[data-theme='dark'] .kp-ai-chat {
  background: #1f1f1f;
  border-color: rgba(255, 255, 255, 0.08);
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
