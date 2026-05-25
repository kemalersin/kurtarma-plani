<script setup lang="ts">
import { ref } from 'vue'
import {
  Alert,
  Button,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Radio,
  RadioGroup,
  Space,
  Typography,
  message,
} from 'ant-design-vue'
import { FolderOpenOutlined, UploadOutlined } from '@ant-design/icons-vue'
import {
  readFileAsText,
  restoreProfileFromText,
  type ProfileRestoreKind,
  type ProfileRestoreOutcome,
} from '@/core/services/profile-restore'
import { saveSyncHandle } from '@/core/services/sync/sync-handle-store'
import { supportsSyncFilePicker } from '@/core/services/sync/sync-file'
import { formatImportSummaryMessage } from '@/core/services/snapshot'

const emit = defineEmits<{
  restored: [outcome: ProfileRestoreOutcome]
}>()

const kind = ref<ProfileRestoreKind>('backup')
const busy = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const pendingText = ref<string | null>(null)
const pendingSyncHandle = ref<FileSystemFileHandle | null>(null)
const passwordModalOpen = ref(false)
const password = ref('')
const passwordError = ref<string | null>(null)

function openFilePicker(): void {
  fileInput.value?.click()
}

async function pickSyncWithHandle(): Promise<void> {
  const openPicker = window.showOpenFilePicker
  if (!openPicker) {
    openFilePicker()
    return
  }
  busy.value = true
  try {
    const [handle] = await openPicker({
      types: [
        {
          description: 'Kurtarma Planı senkron',
          accept: { 'application/json': ['.sync', '.json'] },
        },
      ],
      multiple: false,
    })
    const text = await (await handle.getFile()).text()
    pendingSyncHandle.value = handle
    await applyText(text)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    message.error(error instanceof Error ? error.message : 'Dosya okunamadı.')
  } finally {
    busy.value = false
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  pendingSyncHandle.value = null
  try {
    const text = await readFileAsText(file)
    await applyText(text)
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Dosya okunamadı.')
  } finally {
    busy.value = false
  }
}

async function applyText(text: string, pwd?: string): Promise<void> {
  passwordError.value = null
  try {
    const outcome = await restoreProfileFromText(text, kind.value, pwd)
    await finishRestore(outcome)
  } catch (error) {
    if (error instanceof Error && error.message === 'NEEDS_PASSWORD') {
      pendingText.value = text
      password.value = ''
      passwordModalOpen.value = true
      return
    }
    throw error
  }
}

async function finishRestore(outcome: ProfileRestoreOutcome): Promise<void> {
  const profileId = outcome.summary.targetProfileId
  if (!profileId) {
    throw new Error('Profil kimliği alınamadı.')
  }

  if (kind.value === 'sync' && pendingSyncHandle.value) {
    await saveSyncHandle(profileId, pendingSyncHandle.value, pendingSyncHandle.value.name)
  }

  passwordModalOpen.value = false
  pendingText.value = null
  password.value = ''
  message.success(formatImportSummaryMessage(outcome.summary))
  emit('restored', outcome)
}

async function submitPassword(): Promise<void> {
  if (!pendingText.value) return
  busy.value = true
  passwordError.value = null
  try {
    await applyText(pendingText.value, password.value || undefined)
  } catch (error) {
    passwordError.value = error instanceof Error ? error.message : 'İçe aktarılamadı.'
  } finally {
    busy.value = false
  }
}

async function onPrimaryClick(): Promise<void> {
  if (kind.value === 'sync' && supportsSyncFilePicker()) {
    await pickSyncWithHandle()
  } else {
    openFilePicker()
  }
}
</script>

<template>
  <Space direction="vertical" :size="16" style="width: 100%">
    <Alert
      type="info"
      show-icon
      message="Profil kimliği korunur"
      description="Yedek veya senkron dosyasındaki profil kimliği (UUID) aynen içe aktarılır. Cihazlar arası senkron için bu yolu kullanın."
    />

    <FormItem label="Dosya türü" :colon="false" class="kp-restore-kind">
      <RadioGroup v-model:value="kind">
        <Radio value="backup">Yedek dosyası (.json)</Radio>
        <Radio value="sync">Senkron dosyası (.sync)</Radio>
      </RadioGroup>
    </FormItem>

    <Typography.Paragraph class="kp-text-muted">
      <template v-if="kind === 'backup'">
        Başka cihazdan indirdiğiniz yedek dosyasını seçin.
      </template>
      <template v-else>
        iCloud / Dropbox klasörünüzdeki senkron dosyasını seçin. Tarayıcı izin verirse dosya
        bağlantısı otomatik kaydedilir.
      </template>
    </Typography.Paragraph>

    <input
      ref="fileInput"
      type="file"
      hidden
      :accept="kind === 'sync' ? '.sync,.json,application/json' : '.json,application/json'"
      @change="onFileChange"
    />

    <Button type="primary" :loading="busy" block @click="onPrimaryClick">
      <template #icon>
        <FolderOpenOutlined v-if="kind === 'sync' && supportsSyncFilePicker()" />
        <UploadOutlined v-else />
      </template>
      {{ kind === 'sync' ? 'Senkron dosyası seç' : 'Yedek dosyası seç' }}
    </Button>
  </Space>

  <Modal
    v-model:open="passwordModalOpen"
    :title="kind === 'sync' ? 'Şifreli senkron dosyası' : 'Şifreli yedek dosyası'"
    :confirm-loading="busy"
    ok-text="İçe aktar"
    cancel-text="Vazgeç"
    @ok="submitPassword"
  >
    <Form layout="vertical" :colon="false">
      <FormItem label="Dosya parolası" required :help="passwordError" :validate-status="passwordError ? 'error' : ''">
        <InputPassword v-model:value="password" autocomplete="current-password" @press-enter="submitPassword" />
      </FormItem>
    </Form>
  </Modal>
</template>

<style scoped>
.kp-restore-kind {
  margin-bottom: 0;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 0;
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}
</style>
