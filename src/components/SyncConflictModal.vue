<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Typography,
  message,
} from 'ant-design-vue'
import type { SyncConflictContext } from '@/core/services/sync/sync-conflict'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateTimeLong } = useLocaleFormatters()

const password = ref('')
const passwordError = ref<string | null>(null)
const rememberPassword = ref(true)
const resolving = ref<'remote' | 'local' | null>(null)
const visibleContext = ref<SyncConflictContext | null>(null)

const open = computed({
  get: () => syncStore.conflictModalOpen,
  set: (value: boolean) => {
    syncStore.conflictModalOpen = value
  },
})

const isRelay = computed(() => syncStore.isRelayMode)

const needsPassword = computed(() => syncStore.config.encryptFile)

const passwordLabel = computed(() => {
  if (syncStore.config.useProfilePassword && profileStore.activeProfile?.password?.enabled) {
    return 'Profil parolası'
  }
  return isRelay.value ? 'Senkron parolası' : 'Senkron dosyası parolası'
})

const introText = computed(() =>
  isRelay.value
    ? 'Bu cihazda ve relay üzerindeki kopyada eşzamanlı değişiklik var. Otomatik birleştirme yapılmaz; hangi sürümün geçerli olacağını seçin.'
    : 'Bu cihazda ve senkron dosyasında eşzamanlı değişiklik var. Otomatik birleştirme yapılmaz; hangi sürümün geçerli olacağını seçin.',
)

const remoteDeviceLabel = computed(() => {
  const id = visibleContext.value?.remoteDeviceId?.trim()
  if (!id) return '—'
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
})

watch(
  () => syncStore.conflictContext,
  (ctx) => {
    if (ctx) {
      visibleContext.value = { ...ctx }
    }
  },
  { immediate: true },
)

watch(open, (visible) => {
  if (visible) {
    password.value = ''
    passwordError.value = null
    resolving.value = null
    if (syncStore.conflictContext) {
      visibleContext.value = { ...syncStore.conflictContext }
    }
  }
})

function onAfterClose(): void {
  visibleContext.value = null
  resolving.value = null
}

function validatePassword(): string | undefined {
  passwordError.value = null
  if (!needsPassword.value) return undefined
  const pwd = password.value
  if (syncStore.config.useProfilePassword && profileStore.activeProfile?.password?.enabled) {
    if (!pwd.trim()) {
      passwordError.value = 'Profil parolası gerekli.'
      return undefined
    }
    return pwd
  }
  if (pwd.length < 6) {
    passwordError.value = 'Parola en az 6 karakter olmalı.'
    return undefined
  }
  return pwd
}

async function onUseRemote(): Promise<void> {
  const pwd = validatePassword()
  if (needsPassword.value && !pwd) return
  resolving.value = 'remote'
  try {
    await syncStore.resolveConflictUseRemote(pwd)
    if (pwd) syncStore.rememberSessionPassword(pwd, rememberPassword.value)
    message.success('Uzak sürüm uygulandı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Uzak sürüm alınamadı.')
  } finally {
    resolving.value = null
  }
}

async function onKeepLocal(): Promise<void> {
  const pwd = validatePassword()
  if (needsPassword.value && !pwd) return
  resolving.value = 'local'
  try {
    await syncStore.resolveConflictKeepLocal(pwd)
    if (pwd) syncStore.rememberSessionPassword(pwd, rememberPassword.value)
    message.success(
      isRelay.value ? 'Yerel sürüm relay\'e yazıldı.' : 'Yerel sürüm senkron dosyasına yazıldı.',
    )
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Yerel sürüm gönderilemedi.')
  } finally {
    resolving.value = null
  }
}

function onCancel(): void {
  open.value = false
}
</script>

<template>
  <Modal
    v-model:open="open"
    title="Senkron çakışması"
    :mask-closable="false"
    :footer="null"
    wrap-class-name="kp-sync-conflict-modal"
    :body-style="{ overflow: 'hidden' }"
    @after-close="onAfterClose"
  >
    <div class="kp-sync-conflict">
      <Typography.Paragraph class="kp-sync-conflict__intro">
        {{ introText }}
      </Typography.Paragraph>

      <Descriptions
        v-if="visibleContext"
        :column="1"
        size="small"
        bordered
        class="kp-sync-conflict__meta"
      >
        <DescriptionsItem :label="isRelay ? 'Uzak kopya' : 'Uzak dosya'">
          {{ formatDateTimeLong(visibleContext.remoteWrittenAt) }}
        </DescriptionsItem>
        <DescriptionsItem label="Uzak cihaz">
          {{ remoteDeviceLabel }}
        </DescriptionsItem>
        <DescriptionsItem v-if="visibleContext.localMutationAt" label="Son yerel değişiklik">
          {{ formatDateTimeLong(visibleContext.localMutationAt) }}
        </DescriptionsItem>
        <DescriptionsItem v-if="visibleContext.lastKnownPushAt" label="Son başarılı yazma">
          {{ formatDateTimeLong(visibleContext.lastKnownPushAt) }}
        </DescriptionsItem>
      </Descriptions>

      <Alert
        type="warning"
        show-icon
        class="kp-sync-conflict__hint"
        message="Uzak sürümü seçerseniz bu cihazdaki kaydedilmemiş yerel değişiklikler kaybolur."
      />

      <Form v-if="needsPassword" layout="vertical" :colon="false" class="kp-sync-conflict__form">
        <FormItem
          :label="passwordLabel"
          :validate-status="passwordError ? 'error' : ''"
          :help="passwordError"
        >
          <InputPassword
            v-model:value="password"
            autocomplete="current-password"
            @press-enter="onKeepLocal"
          />
        </FormItem>
        <Checkbox v-model:checked="rememberPassword">Bu oturumda parolayı hatırla</Checkbox>
      </Form>

      <div class="kp-sync-conflict__actions">
        <Button
          type="text"
          class="kp-sync-conflict__cancel kp-sync-conflict__action-btn"
          :disabled="!!resolving"
          @click="onCancel"
        >
          Vazgeç
        </Button>
        <Button
          danger
          class="kp-sync-conflict__action-btn"
          :loading="resolving === 'remote'"
          :disabled="!!resolving"
          @click="onUseRemote"
        >
          Uzak sürümü kullan
        </Button>
        <Button
          type="primary"
          class="kp-sync-conflict__action-btn"
          :loading="resolving === 'local'"
          :disabled="!!resolving"
          @click="onKeepLocal"
        >
          Yerel sürümü koru
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.kp-sync-conflict {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kp-sync-conflict__intro {
  margin-bottom: 0;
  color: var(--ant-color-text-secondary);
}

.kp-sync-conflict__meta :deep(.ant-descriptions-item-label) {
  width: 36%;
  min-width: 8.5rem;
  white-space: nowrap;
}

.kp-sync-conflict__meta :deep(.ant-descriptions-item-content) {
  word-break: break-word;
}

.kp-sync-conflict__hint {
  margin-bottom: 0;
}

.kp-sync-conflict__form {
  margin-bottom: 0;
}

.kp-sync-conflict__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kp-sync-conflict__action-btn {
  width: 100%;
}

.kp-sync-conflict__cancel {
  color: var(--ant-color-text-secondary);
}

@media (min-width: 641px) {
  .kp-sync-conflict__actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .kp-sync-conflict__action-btn {
    width: auto;
  }

  .kp-sync-conflict__cancel {
    margin-right: auto;
  }
}

:global(.kp-sync-conflict-modal .ant-modal) {
  width: min(480px, calc(100vw - 32px)) !important;
}
</style>
