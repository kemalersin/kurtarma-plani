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
import { CloudSyncOutlined, DownloadOutlined, FileAddOutlined, FolderOpenOutlined, UploadOutlined } from '@ant-design/icons-vue'
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
const passwordModalMode = ref<'sync' | 'adopt' | 'manual-pull' | 'manual-push'>('sync')
const manualFileInput = ref<HTMLInputElement | null>(null)
const pendingManualFile = ref<File | null>(null)

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

const passwordModalTitle = computed(() => {
  switch (passwordModalMode.value) {
    case 'adopt':
      return 'Profile aktarma parolası'
    case 'manual-pull':
      return 'Uzak dosya parolası'
    case 'manual-push':
      return 'İndirme parolası'
    default:
      return 'Senkron parolası'
  }
})

const passwordModalOkText = computed(() => {
  switch (passwordModalMode.value) {
    case 'adopt':
      return 'Aktar ve bağla'
    case 'manual-pull':
      return 'Dosyayı oku'
    case 'manual-push':
      return 'İndir'
    default:
      return 'Senkronize et'
  }
})

const statusMessage = computed(() => {
  if (syncStore.isManualMode) {
    switch (syncStore.runtimeStatus) {
      case 'disabled':
        return 'Senkron kapalı.'
      case 'pending_file':
        return 'İlk senkron için uzaktan dosya seçin veya yerel sürümü indirin.'
      case 'pending_push':
        return 'Yerel değişiklikler var; «Yerel sürümü indir» ile senkron klasörünüze kaydedin.'
      case 'remote_pending':
        return 'Uzak dosyada güncelleme olabilir; «Güncel dosyayı seç» ile kontrol edin.'
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
          ? `Manuel mod — ${syncStore.activeFileName}`
          : 'Manuel senkron: dosya seçin veya indirin.'
    }
  }

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
      autoPush: syncStore.isManualMode ? false : draft.autoPush,
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
  if (syncStore.isManualMode) {
    await onDownloadPush()
    return
  }
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

  if (syncStore.isManualMode && !syncStore.manualRemoteEnvelope && syncStore.hasHandle) {
    message.info('Uzak sürümü almak için önce «Güncel dosyayı seç» ile dosyayı işaretleyin.')
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
  if (!syncStore.hasHandle && !syncStore.isManualMode) {
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
    passwordModalMode.value = 'sync'
    passwordModalOpen.value = true
    return
  }
  await executeManualSync()
}

function chooseManualFile(): void {
  manualFileInput.value?.click()
}

async function onManualFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !canConfigure.value) return

  if (needsPasswordForSync()) {
    pendingManualFile.value = file
    syncPassword.value = ''
    syncPasswordError.value = null
    passwordModalMode.value = 'manual-pull'
    passwordModalOpen.value = true
    return
  }

  await executeManualPull(file)
}

async function executeManualPull(file: File, password?: string): Promise<void> {
  try {
    const result = await syncStore.pullFromManualFile(file, password)
    if (syncStore.profileMismatch) {
      message.warning('Seçilen dosya farklı bir profile ait; aşağıdan bu profile bağlayabilirsiniz.')
      return
    }
    if (syncStore.conflictPending) {
      syncStore.openConflictModal()
      return
    }
    if (result.pulled) {
      if (password) syncStore.rememberSessionPassword(password, rememberPassword.value)
      message.success('Uzak veri içe aktarıldı.')
    } else {
      message.info('Dosya kaydedildi; uzak sürüm zaten güncel veya boş.')
    }
    syncPassword.value = ''
    passwordModalOpen.value = false
    pendingManualFile.value = null
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Dosya okunamadı.')
  }
}

async function onDownloadPush(): Promise<void> {
  if (!canConfigure.value) return
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
    passwordModalMode.value = 'manual-push'
    passwordModalOpen.value = true
    return
  }
  await executeManualPushDownload()
}

async function executeManualPushDownload(password?: string): Promise<void> {
  try {
    await syncStore.downloadManualPush(password)
    if (password) syncStore.rememberSessionPassword(password, rememberPassword.value)
    message.success('Senkron dosyası indirildi. iCloud/Dropbox klasörünüze kaydedin ve eski dosyanın üzerine yazın.')
    syncPassword.value = ''
    passwordModalOpen.value = false
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Dosya indirilemedi.')
  }
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
  if (passwordModalMode.value === 'manual-pull') {
    if (pendingManualFile.value) {
      await executeManualPull(pendingManualFile.value, pwd || undefined)
    }
    return
  }
  if (passwordModalMode.value === 'manual-push') {
    await executeManualPushDownload(pwd || undefined)
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
      v-if="syncStore.isManualMode"
      type="warning"
      show-icon
      message="Manuel senkron modu"
      description="Bu tarayıcıda dosya otomatik yazılamaz (Safari veya sınırlı ortam). Uzak sürümü almak için iCloud/Dropbox klasörünüzdeki .sync dosyasını «Güncel dosyayı seç» ile işaretleyin; yerel değişiklikleri göndermek için «Yerel sürümü indir» ile dosyayı indirip aynı klasörde eski dosyanın üzerine kaydedin."
    />

    <Alert
      v-else-if="!syncStore.filePickerSupported"
      type="warning"
      show-icon
      message="Dosya erişimi sınırlı"
      description="Bu tarayıcı dosya seçiciyi desteklemiyor; manuel senkron modu kullanılacak."
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
              <Button
                :disabled="syncStore.syncing"
                @click="syncStore.isManualMode ? chooseManualFile() : onPickFile()"
              >
                Başka dosya seç
              </Button>
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
            <template v-if="syncStore.isManualMode">
              <Button
                size="small"
                :disabled="!canConfigure || syncStore.syncing"
                @click="chooseManualFile"
              >
                <template #icon><UploadOutlined /></template>
                Güncel dosyayı seç
              </Button>
              <Button
                size="small"
                :disabled="!canConfigure || syncStore.syncing"
                @click="onDownloadPush"
              >
                <template #icon><DownloadOutlined /></template>
                Yerel sürümü indir
              </Button>
            </template>
            <template v-else>
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
            </template>
          </Space>
        </FormItem>

        <FormItem v-if="syncStore.loaded" class="kp-sync-form__checks">
          <Space direction="vertical" :size="4" style="width: 100%">
            <Checkbox v-model:checked="draft.encryptFile">Dosyayı parolayla şifrele</Checkbox>
            <Checkbox
              v-if="profileHasPassword"
              v-model:checked="useProfilePasswordChecked"
              :disabled="!draft.encryptFile"
            >
              Profil parolasını kullan
            </Checkbox>
            <Checkbox v-model:checked="draft.includeSensitive">
              Hassas işaretli kayıtları dahil et
            </Checkbox>
            <Checkbox v-model:checked="draft.includeSecrets">
              AI API anahtarları ve base URL'leri dahil et
            </Checkbox>
            <Checkbox v-model:checked="draft.autoPush" :disabled="syncStore.isManualMode">
              Değişikliklerden sonra otomatik yaz (2 sn gecikme)
            </Checkbox>
            <Typography.Text v-if="syncStore.isManualMode" type="secondary" class="kp-sync-manual-hint">
              Manuel modda otomatik yazma kapalı; değişiklikleri «Yerel sürümü indir» ile gönderin.
            </Typography.Text>
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
          :disabled="!canConfigure || syncStore.syncing || (!syncStore.isManualMode && (!syncStore.hasHandle || !syncStore.filePickerSupported))"
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

    <input
      ref="manualFileInput"
      type="file"
      accept=".sync,.json,application/json"
      class="kp-sync-manual-input"
      @change="onManualFileSelected"
    />

    <Modal
      v-model:open="passwordModalOpen"
      :title="passwordModalTitle"
      :confirm-loading="syncStore.syncing"
      :ok-text="passwordModalOkText"
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

.kp-sync-manual-input {
  display: none;
}

.kp-sync-manual-hint {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}
</style>
