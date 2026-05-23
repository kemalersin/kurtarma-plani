<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Space,
  Switch,
  Typography,
  message,
} from 'ant-design-vue'
import { CloudSyncOutlined, FileAddOutlined, FolderOpenOutlined } from '@ant-design/icons-vue'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { envelopeProfileMismatch } from '@/core/services/sync/sync-engine'
import { createDefaultSyncConfig, type SyncConfig } from '@/core/types/sync'

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateLong } = useLocaleFormatters()

function draftFromConfig(config: SyncConfig) {
  return {
    encryptFile: config.encryptFile,
    useProfilePassword: config.useProfilePassword,
    includeSensitive: config.includeSensitive,
    includeSecrets: config.includeSecrets,
    autoPush: config.autoPush,
  }
}

const draft = reactive(
  draftFromConfig(syncStore.loaded ? syncStore.config : createDefaultSyncConfig()),
)

const passwordModalOpen = ref(false)
const syncPassword = ref('')
const syncPasswordError = ref<string | null>(null)
const rememberPassword = ref(true)
const passwordModalMode = ref<'sync' | 'adopt'>('sync')

function shortProfileId(id: string | undefined): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

const profileHasPassword = computed(
  () => Boolean(profileStore.activeProfile?.password?.enabled),
)

const useProfilePasswordApplicable = computed(
  () => profileHasPassword.value && draft.encryptFile,
)

const useProfilePasswordChecked = computed({
  get: () => useProfilePasswordApplicable.value && draft.useProfilePassword,
  set: (checked: boolean) => {
    draft.useProfilePassword = checked
  },
})

const canConfigure = computed(
  () => profileStore.unlocked && Boolean(profileStore.activeProfileId),
)

const passwordModalLabel = computed(() =>
  draft.useProfilePassword && profileHasPassword.value
    ? 'Profil parolası'
    : 'Senkron dosyası parolası',
)

const statusMessage = computed(() => {
  switch (syncStore.runtimeStatus) {
    case 'disabled':
      return 'Senkron kapalı.'
    case 'pending_file':
      return 'Bu profil için senkron dosyası henüz seçilmedi.'
    case 'pending_push':
      return 'Yerel değişiklikler dosyaya yazılmayı bekliyor…'
    case 'remote_pending':
      return 'Uzak dosyada güncelleme var; «Şimdi senkronize et» ile alın.'
    case 'conflict':
      return 'Yerel ve uzak sürüm birbirinden ayrıldı; «Çakışmayı çöz» ile seçim yapın.'
    case 'profile_mismatch':
      return syncStore.profileMismatch
        ? `Dosya «${syncStore.profileMismatch.fileProfileName}» profiline bağlı; bu profile aktarın veya başka dosya seçin.`
        : 'Senkron dosyası farklı bir profile ait.'
    case 'error':
      return syncStore.config.lastError ?? 'Senkron hatası.'
    default:
      return syncStore.activeFileName
        ? `Güncel — ${syncStore.activeFileName}`
        : 'Bu profil için dosya seçimi bekleniyor.'
  }
})

function syncDraftFromStore(): void {
  Object.assign(draft, draftFromConfig(syncStore.config))
  if (!useProfilePasswordApplicable.value) {
    draft.useProfilePassword = false
  }
}

if (syncStore.loaded) {
  syncDraftFromStore()
}

onMounted(async () => {
  if (!syncStore.loaded) await syncStore.load()
  syncDraftFromStore()
  await syncStore.refreshProfileBinding()
})

watch(
  () => syncStore.config,
  () => syncDraftFromStore(),
  { deep: true },
)

watch(useProfilePasswordApplicable, (applicable) => {
  if (!applicable) draft.useProfilePassword = false
})

async function onEnabledChange(checked: boolean | string | number): Promise<void> {
  if (!syncStore.loaded) return
  const next = checked === true || checked === 'true' || checked === 1
  if (!canConfigure.value) return
  try {
    await syncStore.setEnabled(next)
    message.success(next ? 'Otomatik senkron açıldı.' : 'Otomatik senkron kapatıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  }
}

async function saveOptions(): Promise<void> {
  if (!canConfigure.value) return
  const useProfilePassword = useProfilePasswordApplicable.value && draft.useProfilePassword
  try {
    await syncStore.saveConfig({
      encryptFile: draft.encryptFile,
      useProfilePassword,
      includeSensitive: draft.includeSensitive,
      includeSecrets: draft.includeSecrets,
      autoPush: draft.autoPush,
    })
    message.success('Senkron ayarları kaydedildi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  }
}

async function onPickFile(): Promise<void> {
  if (!canConfigure.value) return
  try {
    await syncStore.pickFile()
    if (syncStore.profileMismatch) {
      message.warning('Seçilen dosya farklı bir profile ait; aşağıdan bu profile bağlayabilirsiniz.')
    } else {
      message.success('Senkron dosyası seçildi.')
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    message.error(error instanceof Error ? error.message : 'Dosya seçilemedi.')
  }
}

async function onCreateFile(): Promise<void> {
  if (!canConfigure.value) return
  try {
    await syncStore.createFile()
    message.success('Senkron dosyası oluşturuldu.')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    message.error(error instanceof Error ? error.message : 'Dosya oluşturulamadı.')
  }
}

function needsPasswordForSync(): boolean {
  return draft.encryptFile
}

async function executeManualSync(password?: string): Promise<void> {
  const profileId = profileStore.activeProfileId
  if (!profileId) return

  if (syncStore.profileMismatch) {
    await executeAdopt(password)
    return
  }

  if (syncStore.conflictPending) {
    syncStore.openConflictModal()
    return
  }

  try {
    const remote = await syncStore.readRemoteEnvelope()
    if (envelopeProfileMismatch(remote, profileId)) {
      await syncStore.refreshProfileBinding()
      await executeAdopt(password)
      return
    }

    let pullRemote = false
    if (syncStore.needsPullConfirm(remote, profileId)) {
      await new Promise<void>((resolve) => {
        Modal.confirm({
          title: 'Uzak değişiklikler',
          content:
            'Senkron dosyasında bu cihazdan farklı bir sürüm var. Önce uzaktan veri alınsın mı?',
          okText: 'Önce al',
          cancelText: 'Atla, yalnızca gönder',
          onOk: () => {
            pullRemote = true
            resolve()
          },
          onCancel: () => resolve(),
        })
      })
    }

    const result = await syncStore.runManualSync({
      filePassword: password,
      pullRemote,
    })
    if (password) {
      syncStore.rememberSessionPassword(password, rememberPassword.value)
    }
    message.success(
      result.pulled
        ? 'Uzak veri alındı ve güncel sürüm dosyaya yazıldı.'
        : 'Güncel sürüm senkron dosyasına yazıldı.',
    )
    syncPassword.value = ''
    passwordModalOpen.value = false
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Senkron başarısız.')
  }
}

async function executeAdopt(password?: string): Promise<void> {
  try {
    await syncStore.adoptSyncFileForCurrentProfile(password)
    if (password) {
      syncStore.rememberSessionPassword(password, rememberPassword.value)
    }
    message.success('Senkron dosyası bu profile bağlandı; veri içe aktarıldı.')
    syncPassword.value = ''
    passwordModalOpen.value = false
    passwordModalMode.value = 'sync'
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Dosya bu profile bağlanamadı.')
  }
}

async function onAdoptFile(): Promise<void> {
  if (!canConfigure.value) return
  if (needsPasswordForSync()) {
    passwordModalMode.value = 'adopt'
    syncPassword.value = ''
    syncPasswordError.value = null
    passwordModalOpen.value = true
    return
  }
  await executeAdopt()
}

async function onSyncNow(): Promise<void> {
  if (!canConfigure.value) return
  if (!syncStore.hasHandle) {
    message.warning('Önce senkron dosyası seçin veya oluşturun.')
    return
  }
  if (syncStore.profileMismatch) {
    await onAdoptFile()
    return
  }
  if (syncStore.conflictPending) {
    syncStore.openConflictModal()
    return
  }
  if (needsPasswordForSync()) {
    syncPassword.value = ''
    syncPasswordError.value = null
    passwordModalOpen.value = true
    return
  }
  await executeManualSync()
}

async function confirmPasswordAndSync(): Promise<void> {
  syncPasswordError.value = null
  const pwd = syncPassword.value
  if (draft.encryptFile) {
    if (draft.useProfilePassword && profileHasPassword.value) {
      if (!pwd.trim()) {
        syncPasswordError.value = 'Profil parolası gerekli.'
        return
      }
    } else if (pwd.length < 6) {
      syncPasswordError.value = 'Parola en az 6 karakter olmalı.'
      return
    }
  }
  if (passwordModalMode.value === 'adopt') {
    await executeAdopt(pwd || undefined)
    return
  }
  await executeManualSync(pwd || undefined)
}
</script>

<template>
  <Space direction="vertical" :size="16" style="width: 100%">
    <Alert
      type="info"
      show-icon
      message="Otomatik senkron dosyası"
      description="Her profilin kendi senkron dosyası vardır; profiller arası veri otomatik taşınmaz. Profil değiştirdiğinizde o profile ait dosyayı seçmeniz veya oluşturmanız gerekir."
    />

    <Alert
      v-if="!syncStore.filePickerSupported"
      type="warning"
      show-icon
      message="Dosya erişimi sınırlı"
      description="Bu tarayıcı dosya seçiciyi desteklemiyor. Manuel senkron için ileride alternatif yöntem eklenecek (S5)."
    />

    <div class="kp-sync-enable">
      <Switch
        :checked="syncStore.loaded && syncStore.enabled"
        :disabled="!canConfigure || syncStore.saving || !syncStore.loaded"
        @change="onEnabledChange"
      />
      <div>
        <Typography.Text strong>Otomatik senkronu etkinleştir</Typography.Text>
        <Typography.Paragraph class="kp-text-muted kp-sync-enable__hint">
          {{ statusMessage }}
        </Typography.Paragraph>
      </div>
    </div>

    <template v-if="syncStore.enabled">
      <Alert
        v-if="syncStore.profileMismatch"
        type="warning"
        show-icon
        message="Senkron dosyası farklı profile ait"
      >
        <template #description>
          <Space direction="vertical" :size="8" style="width: 100%">
            <Typography.Text>
              Dosyadaki profil: <strong>{{ syncStore.profileMismatch.fileProfileName }}</strong>
              (<code>{{ shortProfileId(syncStore.profileMismatch.fileProfileId) }}</code>)
              · Açık profil: <strong>{{ profileStore.activeProfile?.name }}</strong>
              (<code>{{ shortProfileId(profileStore.activeProfileId ?? undefined) }}</code>)
            </Typography.Text>
            <Typography.Text type="secondary">
              Kimlikler farklıysa «Bu profile aktar ve bağla» ile devam edin. Yedekten içe aktardıysanız
              «Aktif profilin üzerine yaz» seçeneğinin kapalı olduğundan ve içe aktarılan profilin
              açık olduğundan emin olun.
            </Typography.Text>
            <Space wrap>
              <Button type="primary" :loading="syncStore.syncing" @click="onAdoptFile">
                Bu profile aktar ve bağla
              </Button>
              <Button :disabled="syncStore.syncing" @click="onPickFile">Başka dosya seç</Button>
            </Space>
          </Space>
        </template>
      </Alert>

      <Alert
        v-if="syncStore.conflictPending"
        type="error"
        show-icon
        message="Senkron çakışması"
        description="Bu cihazdaki değişiklikler ile senkron dosyasındaki sürüm birbirinden farklı. Hangisinin geçerli olacağını seçmeniz gerekir."
      />

      <Form layout="vertical" :colon="false" class="kp-sync-form">
        <FormItem label="Senkron dosyası">
          <Space wrap>
            <Typography.Text type="secondary">
              {{ syncStore.activeFileName ?? 'Henüz seçilmedi' }}
            </Typography.Text>
            <Button
              v-if="syncStore.filePickerSupported"
              size="small"
              :disabled="!canConfigure || syncStore.syncing"
              @click="onPickFile"
            >
              <template #icon><FolderOpenOutlined /></template>
              Dosya seç
            </Button>
            <Button
              v-if="syncStore.filePickerSupported"
              size="small"
              :disabled="!canConfigure || syncStore.syncing"
              @click="onCreateFile"
            >
              <template #icon><FileAddOutlined /></template>
              Yeni dosya
            </Button>
          </Space>
        </FormItem>

        <FormItem v-if="syncStore.loaded" class="kp-sync-form__checks">
          <Space direction="vertical" :size="4" style="width: 100%">
            <Checkbox v-model:checked="draft.encryptFile">Dosyayı parolayla şifrele</Checkbox>
            <Checkbox
              v-model:checked="useProfilePasswordChecked"
              :disabled="!useProfilePasswordApplicable"
            >
              Profil parolasını kullan (parolalı profil)
            </Checkbox>
            <Checkbox v-model:checked="draft.includeSensitive">
              Hassas işaretli kayıtları dahil et
            </Checkbox>
            <Checkbox v-model:checked="draft.includeSecrets">
              AI API anahtarları ve base URL'leri dahil et
            </Checkbox>
            <Checkbox v-model:checked="draft.autoPush">
              Değişikliklerden sonra otomatik yaz (2 sn gecikme)
            </Checkbox>
          </Space>
        </FormItem>

        <Typography.Paragraph v-if="syncStore.config.lastSyncAt" class="kp-text-muted">
          Son senkron: {{ formatDateLong(syncStore.config.lastSyncAt) }}
        </Typography.Paragraph>
      </Form>

      <Space v-if="syncStore.loaded" wrap>
        <Button type="primary" :loading="syncStore.saving" :disabled="!canConfigure" @click="saveOptions">
          Senkron ayarlarını kaydet
        </Button>
        <Button
          v-if="syncStore.conflictPending"
          type="primary"
          danger
          :loading="syncStore.syncing"
          :disabled="!canConfigure"
          @click="syncStore.openConflictModal()"
        >
          Çakışmayı çöz
        </Button>
        <Button
          type="default"
          :loading="syncStore.syncing"
          :disabled="!canConfigure || !syncStore.hasHandle || !syncStore.filePickerSupported"
          @click="onSyncNow"
        >
          <template #icon><CloudSyncOutlined /></template>
          Şimdi senkronize et
        </Button>
      </Space>
    </template>

    <Typography.Paragraph v-if="syncStore.deviceId" class="kp-text-muted kp-sync-device">
      Cihaz kimliği: <code>{{ syncStore.deviceId }}</code>
    </Typography.Paragraph>

    <Modal
      v-model:open="passwordModalOpen"
      :title="passwordModalMode === 'adopt' ? 'Profile aktarma parolası' : 'Senkron parolası'"
      :confirm-loading="syncStore.syncing"
      :ok-text="passwordModalMode === 'adopt' ? 'Aktar ve bağla' : 'Senkronize et'"
      cancel-text="İptal"
      @ok="confirmPasswordAndSync"
    >
      <Form layout="vertical" :colon="false">
        <FormItem :label="passwordModalLabel" :validate-status="syncPasswordError ? 'error' : ''" :help="syncPasswordError">
          <InputPassword v-model:value="syncPassword" autocomplete="current-password" @press-enter="confirmPasswordAndSync" />
        </FormItem>
        <Checkbox v-model:checked="rememberPassword">Bu oturumda parolayı hatırla</Checkbox>
      </Form>
    </Modal>
  </Space>
</template>

<style scoped>
.kp-sync-enable {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.kp-sync-enable__hint {
  margin: 4px 0 0;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}

.kp-sync-form__checks :deep(.ant-form-item-control-input) {
  min-height: auto;
}

.kp-sync-device {
  margin-bottom: 0;
  font-size: 12px;
}

.kp-sync-device code {
  font-size: 11px;
}
</style>
