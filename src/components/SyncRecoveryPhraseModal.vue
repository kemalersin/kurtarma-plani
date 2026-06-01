<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Space,
  Typography,
  message,
} from 'ant-design-vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { useSyncStore } from '@/stores/sync'

const syncStore = useSyncStore()

const savedConfirmed = ref(false)
const visibleRecovery = ref<{ phrase: string; namespaceId: string } | null>(null)

const open = computed({
  get: () => syncStore.relayRecoveryModalOpen,
  set: (value: boolean) => {
    syncStore.relayRecoveryModalOpen = value
  },
})

const phrase = computed(() => visibleRecovery.value?.phrase ?? '')
const namespaceId = computed(() => visibleRecovery.value?.namespaceId ?? '')

const words = computed(() => phrase.value.split(/\s+/).filter(Boolean))

watch(
  () => syncStore.relayPendingRecovery,
  (pending) => {
    if (pending) {
      visibleRecovery.value = {
        phrase: pending.phrase,
        namespaceId: pending.namespaceId,
      }
    }
  },
  { immediate: true },
)

watch(open, (visible) => {
  if (visible) {
    savedConfirmed.value = false
  }
})

function onAfterClose(): void {
  visibleRecovery.value = null
}

async function copyPhrase(): Promise<void> {
  if (!phrase.value) return
  try {
    await navigator.clipboard.writeText(phrase.value)
    message.success('Recovery anahtarı panoya kopyalandı.')
  } catch {
    message.error('Panoya kopyalanamadı.')
  }
}

function onConfirm(): void {
  if (!savedConfirmed.value) return
  syncStore.acknowledgeRecoveryPhrase()
  message.success('Recovery anahtarı kaydedildi olarak işaretlendi.')
}
</script>

<template>
  <Modal
    v-model:open="open"
    title="Recovery anahtarı — güvenli saklayın"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    wrap-class-name="kp-recovery-modal"
    @after-close="onAfterClose"
  >
    <template #footer>
      <Button type="primary" :disabled="!savedConfirmed" @click="onConfirm">
        Kaydettim
      </Button>
    </template>

    <Space direction="vertical" :size="16" style="width: 100%">
      <Alert
        type="warning"
        show-icon
        message="Bu anahtar bir daha gösterilmez"
        description="24 kelimelik recovery anahtarı tüm cihazları iptal edip namespace'e yeniden erişim sağlar. Profil parolasından ayrıdır; kağıt veya parola yöneticisinde offline saklayın."
      />

      <Typography.Text type="secondary">
        Namespace:
        <Typography.Text code>{{ namespaceId }}</Typography.Text>
      </Typography.Text>

      <div class="kp-recovery-words" role="group" aria-label="Recovery kelimeleri">
        <Typography.Text
          v-for="(word, index) in words"
          :key="index"
          class="kp-recovery-words__item"
        >
          <span class="kp-recovery-words__index">{{ index + 1 }}.</span>
          {{ word }}
        </Typography.Text>
      </div>

      <Button block @click="copyPhrase">
        <template #icon><CopyOutlined /></template>
        Tüm anahtarı kopyala
      </Button>

      <Checkbox v-model:checked="savedConfirmed">
        Recovery anahtarını güvenli bir yere kaydettim
      </Checkbox>
    </Space>
  </Modal>
</template>

<style scoped>
.kp-recovery-words {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 8px 12px;
  padding: 12px;
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
}

.kp-recovery-words__item {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
}

.kp-recovery-words__index {
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  margin-right: 4px;
  user-select: none;
}
</style>
