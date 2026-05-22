<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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
  encryptFile: false,
  password: '',
  passwordConfirm: '',
})

const exporting = ref(false)
const importing = ref(false)
const importOverwrite = ref(false)

const canExport = computed(
  () => profileStore.unlocked && Boolean(profileStore.activeProfileId),
)

const canImportOverwrite = computed(
  () => profileStore.unlocked && Boolean(profileStore.activeProfileId),
)

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
    if (!active || !profileStore.unlocked) {
      message.error('Yedek almak için oturum açık bir profil gerekli.')
      return
    }

    const snapshot = await buildSnapshot(
      {
        includeSensitive: exportForm.includeSensitive,
        includeSecrets: exportForm.includeSecrets,
        encryptFile: exportForm.encryptFile,
        password: exportForm.encryptFile ? exportForm.password : undefined,
      },
      { profile: active, key: profileStore.dataKey },
    )
    const text = await encodeSnapshotFile(snapshot, {
      encryptFile: exportForm.encryptFile,
      password: exportForm.encryptFile ? exportForm.password : undefined,
    })
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = snapshot.exportedAt.replace(/[:.]/g, '-')
    const slug = active.name.replace(/[^\w\u0080-\uFFFF]+/gu, '-').replace(/^-+|-+$/g, '') || 'profil'
    a.href = url
    a.download = `kurtarma-plani-${slug}-${stamp}${exportForm.encryptFile ? '.enc' : ''}.json`
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
  const summary = await importSnapshot(decoded.snapshot, {
    overwriteProfileId:
      importOverwrite.value && profileStore.activeProfileId
        ? profileStore.activeProfileId
        : undefined,
    dataKey: importOverwrite.value ? profileStore.dataKey : undefined,
  })

  if (summary.overwritten) {
    const { useEntitiesStore } = await import('@/stores/entities')
    useEntitiesStore().reset()
    const { useAiStore } = await import('@/stores/ai')
    useAiStore().reset()
    if (profileStore.activeProfileId) {
      await useAiStore().load()
    }
  }

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
      description="Yedek yalnızca şu an açık olan profili içerir. Dosya isteğe bağlı parolayla şifrelenebilir."
    />

    <div>
      <Typography.Title :level="5" class="kp-section-title">Yedek al</Typography.Title>
      <Typography.Paragraph v-if="profileStore.activeProfile" class="kp-text-muted">
        Profil: <strong>{{ profileStore.activeProfile.name }}</strong>
      </Typography.Paragraph>
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
        <Button type="primary" :loading="exporting" :disabled="!canExport" @click="doExport">
          <template #icon><DownloadOutlined /></template>
          Yedek dosyasını indir
        </Button>
      </div>
    </div>

    <div>
      <Typography.Title :level="5" class="kp-section-title">İçe aktar</Typography.Title>
      <Typography.Paragraph class="kp-text-muted">
        Yedek dosyasından profil ve kayıtları içe aktarın. Varsayılan olarak
        <strong>yeni profil</strong> oluşturulur; aynı isimde profil varsa
        <strong>Ad 2</strong>, <strong>Ad 3</strong> … adlandırılır.
      </Typography.Paragraph>
      <Form layout="vertical" :colon="false" class="kp-import-form">
        <FormItem class="kp-import-form__overwrite">
          <Checkbox
            v-model:checked="importOverwrite"
            :disabled="!canImportOverwrite"
          >
            Aktif profilin üzerine yaz
          </Checkbox>
          <Typography.Paragraph
            v-if="importOverwrite && profileStore.activeProfile"
            class="kp-text-muted kp-import-form__overwrite-hint"
          >
            <strong>{{ profileStore.activeProfile.name }}</strong> profilindeki tüm kayıtlar
            silinip yedekteki verilerle değiştirilir. Geri alınamaz.
          </Typography.Paragraph>
        </FormItem>
      </Form>
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

.kp-import-form {
  margin-bottom: 12px;
}

.kp-import-form__overwrite {
  margin-bottom: 0;
}

.kp-import-form__overwrite :deep(.ant-form-item-control-input) {
  min-height: auto;
}

.kp-import-form__overwrite-hint {
  margin: 6px 0 0 24px;
  font-size: 13px;
}
</style>
