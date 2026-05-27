<script setup lang="ts">
import { computed, inject, ref, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'
import { Alert, Button, List, Popconfirm, Space, Typography, message } from 'ant-design-vue'
import { DatabaseOutlined } from '@ant-design/icons-vue'
import { useAiProposalApply } from '@/composables/useAiProposalApply'
import { KP_AI_CHAT_OVERLAY_Z_INDEX_KEY } from '@/components/kp-ai-chat-overlay'
import { summarizeProposalItems } from '@/features/ai/proposals/labels'
import { proposalBundleKey } from '@/features/ai/proposals/parse'
import type { AiProposalBundle } from '@/features/ai/proposals/types'
import { useAiStore } from '@/stores/ai'

const props = defineProps<{
  messageId: string
  bundle: AiProposalBundle
}>()

const ai = useAiStore()
const { chat } = storeToRefs(ai)
const overlayZIndex = inject<ComputedRef<number | undefined>>(
  KP_AI_CHAT_OVERLAY_Z_INDEX_KEY,
  computed(() => undefined),
)
const { apply } = useAiProposalApply()
const applying = ref(false)
const appliedLocally = ref(false)
const lastError = ref<string | null>(null)

const bundleKey = computed(() => proposalBundleKey(props.bundle))

const isApplied = computed(() => {
  if (appliedLocally.value) return true
  const msg = chat.value?.messages.find((m) => m.id === props.messageId)
  return msg?.appliedProposalKeys?.includes(bundleKey.value) ?? false
})

const summaryItems = computed(() => summarizeProposalItems(props.bundle.items))

async function onApply(): Promise<void> {
  applying.value = true
  lastError.value = null
  try {
    const result = await apply(props.bundle)
    if (result.created.length) {
      appliedLocally.value = true
      message.success(`${result.created.length} kayıt eklendi.`)
      await ai.markProposalApplied(props.messageId, bundleKey.value)
    }
    if (result.errors.length) {
      lastError.value = result.errors.join('\n')
      if (!result.created.length) {
        message.error('Kayıtlar eklenemedi.')
      } else {
        message.warning('Bazı kayıtlar eklenemedi.')
      }
    }
  } catch (error) {
    lastError.value = error instanceof Error ? error.message : String(error)
    message.error(lastError.value)
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="kp-ai-proposals">
    <Typography.Text strong class="kp-ai-proposals__title">
      <DatabaseOutlined />
      Kayıt önerisi
    </Typography.Text>
    <List size="small" :data-source="summaryItems" class="kp-ai-proposals__list">
      <template #renderItem="{ item }">
        <List.Item class="kp-ai-proposals__item">{{ item.label }}</List.Item>
      </template>
    </List>
    <Alert
      v-if="lastError"
      type="error"
      show-icon
      :message="lastError"
      class="kp-ai-proposals__error"
    />
    <Space class="kp-ai-proposals__actions">
      <Popconfirm
        title="Önerilen kayıtlar profilinize eklensin mi?"
        ok-text="Ekle"
        cancel-text="Vazgeç"
        :z-index="overlayZIndex"
        :disabled="isApplied || applying"
        @confirm="onApply"
      >
        <Button type="primary" size="small" :loading="applying" :disabled="isApplied">
          {{ isApplied ? 'Eklendi' : 'Kayıtları ekle' }}
        </Button>
      </Popconfirm>
      <Typography.Text v-if="isApplied" type="secondary" class="kp-ai-proposals__done">
        Veritabanına yazıldı.
      </Typography.Text>
    </Space>
  </div>
</template>

<style scoped>
.kp-ai-proposals {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--kp-radius, 8px);
  border: 1px dashed rgba(22, 119, 255, 0.35);
  background: rgba(22, 119, 255, 0.04);
}

.kp-ai-proposals__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.kp-ai-proposals__list {
  margin-bottom: 8px;
}

.kp-ai-proposals__item {
  padding: 4px 0 !important;
  border: none !important;
}

.kp-ai-proposals__error {
  margin-bottom: 8px;
}

.kp-ai-proposals__actions {
  width: 100%;
}

.kp-ai-proposals__done {
  font-size: 12px;
}

[data-theme='dark'] .kp-ai-proposals {
  border-color: rgba(64, 150, 255, 0.35);
  background: rgba(64, 150, 255, 0.08);
}
</style>
