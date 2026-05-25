<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Space,
  Typography,
  message,
} from 'ant-design-vue'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateLong } = useLocaleFormatters()

const password = ref('')
const passwordError = ref<string | null>(null)
const rememberPassword = ref(true)

const open = computed({
  get: () => syncStore.conflictModalOpen,
  set: (value: boolean) => {
    syncStore.conflictModalOpen = value
  },
})

const needsPassword = computed(() => syncStore.config.encryptFile)

const passwordLabel = computed(() =>
  syncStore.config.useProfilePassword && profileStore.activeProfile?.password?.enabled
    ? 'Profil parolası'
    : 'Senkron dosyası parolası',
)

const context = computed(() => syncStore.conflictContext)

watch(open, (visible) => {
  if (visible) {
    password.value = ''
    passwordError.value = null
  }
})

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
  try {
    await syncStore.resolveConflictUseRemote(pwd)
    if (pwd) syncStore.rememberSessionPassword(pwd, rememberPassword.value)
    message.success('Uzak sürüm uygulandı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Uzak sürüm alınamadı.')
  }
}

async function onKeepLocal(): Promise<void> {
  const pwd = validatePassword()
  if (needsPassword.value && !pwd) return
  try {
    await syncStore.resolveConflictKeepLocal(pwd)
    if (pwd) syncStore.rememberSessionPassword(pwd, rememberPassword.value)
    message.success('Yerel sürüm senkron dosyasına yazıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Yerel sürüm gönderilemedi.')
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
    :footer="null"
    :mask-closable="false"
    width="520"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <Alert
        type="warning"
        show-icon
        message="Hem bu cihazda hem senkron dosyasında değişiklik var"
        description="Otomatik birleştirme yapılmaz. Hangi sürümün geçerli olacağını seçin."
      />

      <div v-if="context" class="kp-sync-conflict__meta">
        <Typography.Paragraph class="kp-sync-conflict__row">
          <Typography.Text strong>Uzak dosya:</Typography.Text>
          {{ formatDateLong(context.remoteWrittenAt) }}
          <Typography.Text type="secondary">({{ context.remoteDeviceId.slice(0, 8) }}…)</Typography.Text>
        </Typography.Paragraph>
        <Typography.Paragraph v-if="context.localMutationAt" class="kp-sync-conflict__row">
          <Typography.Text strong>Son yerel değişiklik:</Typography.Text>
          {{ formatDateLong(context.localMutationAt) }}
        </Typography.Paragraph>
        <Typography.Paragraph v-if="context.lastKnownPushAt" class="kp-sync-conflict__row kp-text-muted">
          Son başarılı yazma: {{ formatDateLong(context.lastKnownPushAt) }}
        </Typography.Paragraph>
      </div>

      <Alert
        type="error"
        show-icon
        message="Uzak sürümü seçerseniz"
        description="Bu cihazdaki kaydedilmemiş yerel değişiklikler kaybolur."
      />

      <Form v-if="needsPassword" layout="vertical" :colon="false">
        <FormItem
          :label="passwordLabel"
          :validate-status="passwordError ? 'error' : ''"
          :help="passwordError"
        >
          <InputPassword
            v-model:value="password"
            autocomplete="current-password"
            @press-enter="onUseRemote"
          />
        </FormItem>
        <Checkbox v-model:checked="rememberPassword">Bu oturumda parolayı hatırla</Checkbox>
      </Form>

      <Space wrap class="kp-sync-conflict__actions">
        <Button danger :loading="syncStore.syncing" @click="onUseRemote">
          Uzak sürümü kullan
        </Button>
        <Button type="primary" :loading="syncStore.syncing" @click="onKeepLocal">
          Yerel sürümü koru
        </Button>
        <Button :disabled="syncStore.syncing" @click="onCancel">Vazgeç</Button>
      </Space>
    </Space>
  </Modal>
</template>

<style scoped>
.kp-sync-conflict__meta {
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

[data-theme='dark'] .kp-sync-conflict__meta {
  background: rgba(255, 255, 255, 0.04);
}

.kp-sync-conflict__row {
  margin-bottom: 4px;
}

.kp-sync-conflict__row:last-child {
  margin-bottom: 0;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}

.kp-sync-conflict__actions {
  width: 100%;
  justify-content: flex-end;
}
</style>
