<script setup lang="ts">
import { computed, ref } from 'vue'
import { Alert, Button, List, Popconfirm, Space, Typography, message } from 'ant-design-vue'
import { DatabaseOutlined } from '@ant-design/icons-vue'
import { useAiProposalApply } from '@/composables/useAiProposalApply'
import { proposalItemLabel } from '@/features/ai/proposals/labels'
import type { AiProposalBundle } from '@/features/ai/proposals/types'

const props = defineProps<{
  bundle: AiProposalBundle
}>()

const { apply } = useAiProposalApply()
const applying = ref(false)
const applied = ref(false)
const lastError = ref<string | null>(null)

const summaryItems = computed(() =>
  props.bundle.items.map((item) => ({
    key: `${item.type}-${item.ref ?? item.data.name ?? Math.random()}`,
    label: proposalItemLabel(item.type, item.data),
  })),
)

async function onApply(): Promise<void> {
  applying.value = true
  lastError.value = null
  try {
    const result = await apply(props.bundle)
    if (result.created.length) {
      message.success(`${result.created.length} kayıt eklendi.`)
      applied.value = true
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
        :disabled="applied || applying"
        @confirm="onApply"
      >
        <Button type="primary" size="small" :loading="applying" :disabled="applied">
          {{ applied ? 'Eklendi' : 'Kayıtları ekle' }}
        </Button>
      </Popconfirm>
      <Typography.Text v-if="applied" type="secondary" class="kp-ai-proposals__done">
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
