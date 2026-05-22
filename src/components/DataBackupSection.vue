<script setup lang="ts">
import { reactive, ref } from 'vue'
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
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useProfileStore } from '@/stores/profile'
import {
  buildSnapshot,
  decodeSnapshotFile,
  encodeSnapshotFile,
  formatImportSummaryMessage,
  importSnapshot,
} from '@/core/services/snapshot'

const profileStore = useProfileStore()

interface ExportForm {
  includeSensitive: boolean
  includeSecrets: boolean
  encryptFile: boolean
  password: string
  passwordConfirm: string
}

const exportForm = reactive<ExportForm>({
  includeSensitive: false,
  includeSecrets: false,
  encryptFile: true,
  password: '',
  passwordConfirm: '',
})

const exporting = ref(false)
const importing = ref(false)

async function doExport(): Promise<void> {
  if (exportForm.encryptFile) {
    if (exportForm.password.length < 6) {
      message.error('Şifreleme için parola en az 6 karakter olmalı.')
      return
    }
    if (exportForm.password !== exportForm.passwordConfirm) {
      message.error('Parola doğrulaması eşleşmiyor.')
      return
    }
  }

  exporting.value = true
  try {
    const active = profileStore.activeProfile
    const ctx =
      active && profileStore.dataKey
        ? { profile: active, key: profileStore.dataKey }
        : null

    const snapshot = await buildSnapshot(
      {
        includeSensitive: exportForm.includeSensitive,
        includeSecrets: exportForm.includeSecrets,
        encryptFile: exportForm.encryptFile,
        password: exportForm.encryptFile ? exportForm.password : undefined,
      },
      ctx,
    )
    const text = await encodeSnapshotFile(snapshot, {
      encryptFile: exportForm.encryptFile,
      password: exportForm.encryptFile ? exportForm.password : undefined,
    })
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = snapshot.exportedAt.replace(/[:.]/g, '-')
    a.href = url
    a.download = `kurtarma-plani-${stamp}${exportForm.encryptFile ? '.enc' : ''}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    message.success('Yedek indirildi.')
    exportForm.password = ''
    exportForm.passwordConfirm = ''
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'Yedek alınamadı.')
  } finally {
    exporting.value = false
  }
}

const importInput = ref<HTMLInputElement | null>(null)
const pendingText = ref<string | null>(null)
const passwordModalOpen = ref(false)
const importPassword = ref('')
const importPasswordError = ref<string | null>(null)
const passwordModalBusy = ref(false)

function chooseImport(): void {
  importInput.value?.click()
}

async function applyDecoded(text: string, password?: string): Promise<boolean> {
  const decoded = await decodeSnapshotFile(text, password)
  if (!decoded.ok) {
    if (decoded.reason === 'needs-password') {
      pendingText.value = text
      passwordModalOpen.value = true
      return false
    }
    if (decoded.reason === 'wrong-password') {
      importPasswordError.value = decoded.message
      return false
    }
    message.error(decoded.message)
    return false
  }
  const summary = await importSnapshot(decoded.snapshot)
  await profileStore.load()
  message.success(formatImportSummaryMessage(summary))
  return true
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    await applyDecoded(text)
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : 'İçe aktarma başarısız.')
  } finally {
    importing.value = false
  }
}

async function submitPasswordModal(): Promise<void> {
  if (!pendingText.value) return
  passwordModalBusy.value = true
  importPasswordError.value = null
  try {
    const ok = await applyDecoded(pendingText.value, importPassword.value)
    if (ok) {
      passwordModalOpen.value = false
    }
  } finally {
    passwordModalBusy.value = false
  }
}

function cancelPasswordModal(): void {
  passwordModalOpen.value = false
}

function resetPasswordModal(): void {
  pendingText.value = null
  importPassword.value = ''
  importPasswordError.value = null
}
</script>

<template>
  <Space direction="vertical" :size="20" style="width: 100%">
    <Alert
      type="info"
      show-icon
      message="Yedekleme ve içe aktarma"
      description="Yedek dosyaları opsiyonel olarak parolayla şifrelenir. Şifrelenmemiş yedekler hassas verilerinizi açık metin olarak içerir."
    />

    <div>
      <Typography.Title :level="5" class="kp-section-title">Yedek al</Typography.Title>
      <Form layout="vertical" :colon="false" class="kp-export-form">
        <FormItem class="kp-export-form__checks">
          <Space direction="vertical" :size="4" style="width: 100%">
            <Checkbox v-model:checked="exportForm.includeSensitive">
              Hassas işaretli kayıtları dahil et
            </Checkbox>
            <Checkbox v-model:checked="exportForm.includeSecrets">
              AI API anahtarları ve base URL'leri dahil et
            </Checkbox>
            <Checkbox v-model:checked="exportForm.encryptFile">
              Dosyayı parolayla şifrele
            </Checkbox>
          </Space>
        </FormItem>
        <div v-if="exportForm.encryptFile" class="kp-export-form__passwords">
          <FormItem label="Yedek parolası" required>
            <InputPassword
              v-model:value="exportForm.password"
              placeholder="En az 6 karakter"
            />
          </FormItem>
          <FormItem label="Yedek parolası (tekrar)" required>
            <InputPassword v-model:value="exportForm.passwordConfirm" />
          </FormItem>
        </div>
      </Form>
      <div class="kp-export-form__download-wrap">
        <Button type="primary" :loading="exporting" @click="doExport">
          <template #icon><DownloadOutlined /></template>
          Yedek dosyasını indir
        </Button>
      </div>
    </div>

    <div>
      <Typography.Title :level="5" class="kp-section-title">İçe aktar</Typography.Title>
      <Typography.Paragraph class="kp-text-muted">
        Daha önce alınmış bir yedek dosyasından profil ve kayıtları içe aktarın. İçe aktarılan
        profiller <strong>yeni profil</strong> olarak eklenir; mevcut veriler silinmez.
      </Typography.Paragraph>
      <input
        ref="importInput"
        type="file"
        accept="application/json,.json"
        hidden
        @change="onImportFile"
      />
      <Button :loading="importing" @click="chooseImport">
        <template #icon><UploadOutlined /></template>
        Yedek dosyası seç
      </Button>
    </div>
  </Space>

  <Modal
    :open="passwordModalOpen"
    title="Şifreli yedek dosyası"
    :confirm-loading="passwordModalBusy"
    ok-text="İçe aktar"
    cancel-text="Vazgeç"
    :mask-closable="!passwordModalBusy"
    @ok="submitPasswordModal"
    @cancel="cancelPasswordModal"
    @after-close="resetPasswordModal"
  >
    <Form layout="vertical" :colon="false" @submit.prevent="submitPasswordModal">
      <FormItem label="Yedek parolası" required>
        <InputPassword v-model:value="importPassword" autofocus />
      </FormItem>
      <Alert
        v-if="importPasswordError"
        type="error"
        show-icon
        :message="importPasswordError"
      />
    </Form>
  </Modal>
</template>

<style scoped>
.kp-section-title {
  margin-top: 0 !important;
  margin-bottom: 8px !important;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 8px;
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}

.kp-export-form__checks {
  margin-bottom: 0;
}

.kp-export-form__checks :deep(.ant-form-item-control-input) {
  min-height: auto;
}

.kp-export-form__passwords {
  margin-top: 16px;
}

.kp-export-form__passwords,
.kp-export-form__download-wrap {
  transition: none;
}

.kp-export-form__download-wrap {
  margin-top: 20px;
}
</style>
