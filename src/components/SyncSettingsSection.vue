<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Form,
  FormItem,
  Input,
  InputPassword,
  Modal,
  Radio,
  Space,
  Switch,
  Typography,
  message,
} from 'ant-design-vue'
import { CloudSyncOutlined, DownloadOutlined, FileAddOutlined, FolderOpenOutlined, LinkOutlined, MobileOutlined, UploadOutlined } from '@ant-design/icons-vue'
import SyncPairingDrawer from '@/components/SyncPairingDrawer.vue'
import SyncDeviceDrawer from '@/components/SyncDeviceDrawer.vue'
import SyncUnlockModal from '@/components/SyncUnlockModal.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { envelopeProfileMismatch } from '@/core/services/sync/sync-engine'
import { createDefaultSyncConfig, relayUrlFromEnv, appIdFromEnv, type SyncConfig, type SyncTransport } from '@/core/types/sync'

const props = defineProps<{
  syncNowVisitArmed?: boolean
}>()

const emit = defineEmits<{
  consumeSyncNowVisit: []
}>()

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const { formatDateTimeLong } = useLocaleFormatters()

function draftFromConfig(config: SyncConfig) {
  return {
    transport: config.transport,
    relayUrl: config.relayUrl ?? relayUrlFromEnv() ?? '',
    appId: config.appId ?? appIdFromEnv() ?? '',
    encryptFile: config.encryptFile,
    useProfilePassword: config.useProfilePassword,
    includeSensitive: config.includeSensitive,
    includeSecrets: config.includeSecrets,
    autoPush: config.autoPush,
  }
}

type SyncSettingsDraft = ReturnType<typeof draftFromConfig>

const draft = reactive(
  draftFromConfig(syncStore.loaded ? syncStore.config : createDefaultSyncConfig()),
)

const passwordModalOpen = ref(false)
const syncPassword = ref('')
const syncPasswordError = ref<string | null>(null)
const rememberPassword = ref(true)
const passwordModalMode = ref<
  'sync' | 'adopt' | 'manual-pull' | 'manual-push' | 'save-config'
>('sync')
const manualFileInput = ref<HTMLInputElement | null>(null)
const pendingManualFile = ref<File | null>(null)

function shortProfileId(id: string | undefined): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

const profileHasPassword = computed(
  () => Boolean(profileStore.activeProfile?.password?.enabled),
)

function normalizeDraftSnapshot(source: SyncSettingsDraft): SyncSettingsDraft {
  return {
    ...source,
    relayUrl: source.relayUrl.trim(),
    appId: source.appId.trim(),
    autoPush: syncStore.isManualMode && source.transport === 'file' ? false : source.autoPush,
    useProfilePassword:
      profileHasPassword.value && source.encryptFile ? source.useProfilePassword : false,
  }
}

function mergeDraftOntoConfig(): SyncConfig {
  return {
    ...syncStore.config,
    transport: draft.transport,
    relayUrl: draft.relayUrl.trim() || undefined,
    appId: draft.appId.trim() || undefined,
    encryptFile: draft.encryptFile,
    useProfilePassword: draft.useProfilePassword,
    includeSensitive: draft.includeSensitive,
    includeSecrets: draft.includeSecrets,
    autoPush: draft.autoPush,
  }
}

const hasDraftChanges = computed(() => {
  if (!syncStore.loaded) return false
  const saved = normalizeDraftSnapshot(draftFromConfig(syncStore.config))
  const current = normalizeDraftSnapshot(draftFromConfig(mergeDraftOntoConfig()))
  return (Object.keys(saved) as (keyof SyncSettingsDraft)[]).some(
    (key) => saved[key] !== current[key],
  )
})

const syncNowActionAllowed = computed(
  () => Boolean(props.syncNowVisitArmed) || hasDraftChanges.value,
)

function disarmSyncNowVisit(): void {
  emit('consumeSyncNowVisit')
}

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

const isRelayDraft = computed(() => draft.transport === 'relay')
const isFileDraft = computed(() => draft.transport === 'file')

const wantsRelaySync = computed(() => syncStore.isRelayMode || isRelayDraft.value)

const relaySyncReady = computed(
  () => syncStore.isRelayMode && syncStore.relaySettingsSaved,
)

const relayDevicesDrawerOpen = ref(false)

const passwordModalLabel = computed(() => {
  if (draft.useProfilePassword && profileHasPassword.value) {
    return 'Profil parolası'
  }
  return isRelayDraft.value ? 'Senkron servisi parolası' : 'Senkron dosyası parolası'
})

const passwordModalTitle = computed(() => {
  switch (passwordModalMode.value) {
    case 'adopt':
      return 'Profile aktarma parolası'
    case 'manual-pull':
      return 'Uzak dosya parolası'
    case 'manual-push':
      return 'İndirme parolası'
    case 'save-config':
      return 'Senkron parolası'
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
    case 'save-config':
      return 'Kaydet'
    default:
      return 'Senkronize et'
  }
})

const statusMessage = computed(() => {
  if (syncStore.isRelayMode || isRelayDraft.value) {
    if (isRelayDraft.value && !syncStore.relaySettingsSaved) {
      return 'Relay ayarlarını kaydedin; ilk bağlantı «Senkron ayarlarını kaydet» ile kurulur.'
    }
    switch (syncStore.runtimeStatus) {
      case 'disabled':
        return 'Senkron kapalı.'
      case 'pending_relay':
        return (
          syncStore.relayUserErrorMessage ??
          'Relay ayarlarını kaydedin; bağlantı otomatik kurulur.'
        )
      case 'pending_push':
        return syncStore.relayConnecting
          ? 'Relay bağlantısı kuruluyor…'
          : 'Yerel değişiklikler relay\'e gönderilmeyi bekliyor…'
      case 'remote_pending':
        return 'Uzak güncelleme var; «Şimdi senkronize et» ile alın.'
      case 'conflict':
        return 'Yerel ve uzak sürüm birbirinden ayrıldı; «Çakışmayı çöz» ile seçim yapın.'
      case 'offline':
        return 'Çevrimdışı — finans modülü çalışır; relay senkronu ağ gelince devam eder.'
      case 'ws_connected':
        return 'Relay bağlı — canlı bildirim aktif.'
      case 'error':
        return syncStore.relayUserErrorMessage ?? 'Relay bağlantı hatası.'
      default:
        return syncStore.config.relayUrl
          ? `Relay — ${syncStore.config.relayUrl}`
          : 'Relay bağlantısı hazır.'
    }
  }

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
  if (!syncStore.loaded || syncStore.saving) return
  const next = checked === true || checked === 'true' || checked === 1
  if (!canConfigure.value) return
  if (next === syncStore.enabled) return
  try {
    await syncStore.setEnabled(next)
    message.success(next ? 'Otomatik senkron açıldı.' : 'Otomatik senkron kapatıldı.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  }
}

async function onSaveOptionsClick(): Promise<void> {
  if (!canConfigure.value) return
  if (needsPasswordPromptForDraft()) {
    openPasswordModal('save-config')
    return
  }
  try {
    await saveOptions()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  }
}

async function saveOptions(showToast = true): Promise<void> {
  if (!canConfigure.value) return
  const useProfilePassword = useProfilePasswordApplicable.value && draft.useProfilePassword

  await syncStore.saveConfig({
    transport: draft.transport,
    relayUrl: draft.relayUrl.trim() || undefined,
    appId: draft.appId.trim() || undefined,
    relayEndpointLocked: true,
    encryptFile: draft.encryptFile,
    useProfilePassword,
    includeSensitive: draft.includeSensitive,
    includeSecrets: draft.includeSecrets,
    autoPush: syncStore.isManualMode && isFileDraft.value ? false : draft.autoPush,
  })

  const relayDraft = draft.transport === 'relay'
  if (relayDraft && syncStore.enabled && draft.relayUrl.trim()) {
    const connected = await syncStore.ensureRelayConnection({ silent: true })
    if (showToast) {
      if (connected) {
        message.success('Senkron ayarları kaydedildi.')
      } else {
        const hint =
          syncStore.relayUserErrorMessage ??
          syncStore.relayStatusHint ??
          'Relay bağlantısı kurulamadı; cihazı yeniden eşleştirin.'
        message.error(hint)
      }
    }
    disarmSyncNowVisit()
    return
  }

  if (showToast) {
    message.success('Senkron ayarları kaydedildi.')
  }
  disarmSyncNowVisit()
}

async function onTransportChange(next: SyncTransport): Promise<void> {
  draft.transport = next
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

function draftSyncPasswordConfig(): Pick<SyncConfig, 'encryptFile' | 'useProfilePassword'> {
  return {
    encryptFile: draft.encryptFile,
    useProfilePassword: useProfilePasswordApplicable.value && draft.useProfilePassword,
  }
}

/** Taslak ayarlara göre parola modalı gerekli mi (kaydedilmiş oturum parolası dahil). */
function needsPasswordPromptForDraft(): boolean {
  if (!draft.encryptFile) return false
  return (
    syncStore.getSyncPasswordRequirementError(
      profileHasPassword.value,
      draftSyncPasswordConfig(),
    ) !== null
  )
}

function openPasswordModal(mode: typeof passwordModalMode.value): void {
  passwordModalMode.value = mode
  syncPassword.value = ''
  syncPasswordError.value = null
  passwordModalOpen.value = true
}

async function executeRelaySyncNow(password?: string): Promise<void> {
  if (!relaySyncReady.value) {
    message.warning('Önce «Senkron ayarlarını kaydet» ile Senkron.la ayarlarını kaydedin.')
    return
  }

  if (password) {
    syncStore.rememberSessionPassword(password, rememberPassword.value)
  }

  try {
    const result = await syncStore.runManualSync({
      filePassword: password,
      pullRemote: true,
      passwordConfig: draftSyncPasswordConfig(),
    })
    message.success(
      result.pulled
        ? 'Uzak veri alındı; yerel veri güncellendi.'
        : 'Yerel veriler relay\'e gönderildi.',
    )
    syncPassword.value = ''
    passwordModalOpen.value = false
    disarmSyncNowVisit()
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Senkron başarısız.'
    if (!syncStore.relayUserErrorMessage) {
      message.error(msg)
    }
  }
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
    disarmSyncNowVisit()
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
  if (needsPasswordPromptForDraft()) {
    openPasswordModal('adopt')
    return
  }
  await executeAdopt()
}

async function onSyncNow(): Promise<void> {
  if (!canConfigure.value || !syncNowActionAllowed.value) return
  if (wantsRelaySync.value) {
    if (syncStore.conflictPending) {
      syncStore.openConflictModal()
      return
    }
    if (needsPasswordPromptForDraft()) {
      openPasswordModal('sync')
      return
    }
    await executeRelaySyncNow()
    return
  }
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
  if (needsPasswordPromptForDraft()) {
    openPasswordModal('sync')
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

  if (needsPasswordPromptForDraft()) {
    pendingManualFile.value = file
    openPasswordModal('manual-pull')
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
  if (needsPasswordPromptForDraft()) {
    openPasswordModal('manual-push')
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
    if (useProfilePasswordApplicable.value && draft.useProfilePassword) {
      if (!pwd.trim()) {
        syncPasswordError.value = 'Profil parolası gerekli.'
        return
      }
    } else if (pwd.length < 6) {
      syncPasswordError.value = 'Parola en az 6 karakter olmalı.'
      return
    }
  }
  if (passwordModalMode.value === 'save-config') {
    syncStore.rememberSessionPassword(pwd || undefined, rememberPassword.value)
    try {
      await saveOptions()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
    }
    syncPassword.value = ''
    passwordModalOpen.value = false
    return
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
  if (passwordModalMode.value === 'sync' && wantsRelaySync.value) {
    await executeRelaySyncNow(pwd || undefined)
    return
  }
  await executeManualSync(pwd || undefined)
}
</script>

<template>
  <div class="kp-sync-settings">
  <Space direction="vertical" :size="16" style="width: 100%">
    <DismissibleDrawerAlert
      v-if="isRelayDraft"
      hint-key="sync.settings.intro.relay"
      type="info"
      message="Senkronla"
    >
      <template #description>
        Veriniz
        <a href="https://senkron.la" target="_blank" rel="noopener noreferrer">Senkron.la</a>
       sunucusunda zarf olarak saklanır. Her profil ayrı bir namespace'tir, zarfın şifrelenmesi için mutlaka senkron parolası belirleyin.
       Sunucu verilerinizi kesinlikle okuyamaz.
      </template>
    </DismissibleDrawerAlert>

    <DismissibleDrawerAlert
      v-else
      hint-key="sync.settings.intro.file"
      type="info"
      message="Otomatik senkron dosyası"
      description="Her profilin kendi senkron dosyası vardır; profiller arası veri otomatik taşınmaz. Profil değiştirdiğinizde o profile ait dosyayı seçmeniz veya oluşturmanız gerekir."
    />

    <Alert
      v-if="isFileDraft && syncStore.isManualMode"
      type="warning"
      show-icon
      message="Manuel senkron modu"
      description="Bu tarayıcıda dosya otomatik yazılamaz (Safari veya sınırlı ortam). Uzak sürümü almak için iCloud/Dropbox klasörünüzdeki senkron dosyasını «Güncel dosyayı seç» ile işaretleyin; yerel değişiklikleri göndermek için «Yerel sürümü indir» ile dosyayı indirip aynı klasörde eski dosyanın üzerine kaydedin."
    />

    <Alert
      v-else-if="isFileDraft && !syncStore.filePickerSupported"
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
      <Form layout="vertical" :colon="false" class="kp-sync-form">
        <FormItem label="Senkron yöntemi">
          <Radio.Group
            :value="draft.transport"
            button-style="solid"
            :disabled="!canConfigure || syncStore.saving"
            @change="(e) => onTransportChange(e.target.value as SyncTransport)"
          >
            <Radio.Button value="file">Dosya</Radio.Button>
            <Radio.Button value="relay">Senkron.la</Radio.Button>
          </Radio.Group>
        </FormItem>
      </Form>

      <Alert
        v-if="syncStore.relayPendingRecovery && !syncStore.relayRecoveryModalOpen"
        type="warning"
        show-icon
        message="Recovery anahtarı bekliyor"
        description="Kaydedilmemiş recovery anahtarı var. Aşağıdaki düğme ile görüntüleyin."
      />

      <Alert
        v-if="syncStore.profileMismatch && isFileDraft"
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
        <template v-if="isRelayDraft">
          <FormItem label="Sunucu adresi" required>
            <Input
              v-model:value="draft.relayUrl"
              placeholder="https://sync.example.com/v1"
              :disabled="!canConfigure || syncStore.syncing"
            />
          </FormItem>
          <FormItem label="Uygulama kimliği">
            <Input
              v-model:value="draft.appId"
              placeholder="esr_app_kurtarma_plani"
              :disabled="!canConfigure || syncStore.syncing"
            />
            <Typography.Text type="secondary" class="kp-sync-relay-hint">
              App registry açık relay (ESR - Envelope Sync Relay) sunucularında zorunlu.
            </Typography.Text>
          </FormItem>
          <div class="kp-sync-relay-actions">
            <Space wrap>
            <Button
              :disabled="!canConfigure || syncStore.syncing"
              @click="syncStore.openRelayPairingDrawer('host')"
            >
              <template #icon><LinkOutlined /></template>
              Cihaz eşleştirme
            </Button>
            <Button
              :disabled="!canConfigure || syncStore.syncing"
              @click="relayDevicesDrawerOpen = true"
            >
              <template #icon><MobileOutlined /></template>
              Cihazlar
            </Button>
            <Button
              v-if="syncStore.relayPendingRecovery"
              :disabled="!canConfigure"
              @click="syncStore.relayRecoveryModalOpen = true"
            >
              Recovery anahtarı
            </Button>
            <Button
              v-if="syncStore.relayDeviceLimitContext?.code === 'DEVICE_LIMIT_PAYMENT_REQUIRED'"
              :disabled="!canConfigure"
              @click="syncStore.relayUnlockModalOpen = true"
            >
              Unlock kodu
            </Button>
            </Space>
          </div>
        </template>

        <FormItem v-else label="Senkron dosyası">
          <div class="kp-sync-file">
            <Typography.Text type="secondary" class="kp-sync-file__name">
              {{ syncStore.activeFileName ?? 'Henüz seçilmedi' }}
            </Typography.Text>
            <Space wrap size="small" class="kp-sync-file__actions">
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
          </div>
        </FormItem>

        <FormItem v-if="syncStore.loaded" class="kp-sync-form__checks">
          <Space direction="vertical" :size="4" style="width: 100%">
            <Checkbox v-model:checked="draft.encryptFile">
              {{ isRelayDraft ? 'Senkron verisini parolayla şifrele' : 'Dosyayı parolayla şifrele' }}
            </Checkbox>
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
            <Checkbox v-model:checked="draft.autoPush" :disabled="syncStore.isManualMode && isFileDraft">
              Değişikliklerden sonra otomatik yaz (2 sn gecikme)
            </Checkbox>
            <Typography.Text v-if="syncStore.isManualMode && isFileDraft" type="secondary" class="kp-sync-manual-hint">
              Manuel modda otomatik yazma kapalı; değişiklikleri «Yerel sürümü indir» ile gönderin.
            </Typography.Text>
          </Space>
        </FormItem>

        <Typography.Paragraph v-if="syncStore.config.lastSyncAt" class="kp-text-muted">
          Son senkron: {{ formatDateTimeLong(syncStore.config.lastSyncAt) }}
        </Typography.Paragraph>
      </Form>

      <Space v-if="syncStore.loaded" wrap class="kp-sync-actions">
        <Button type="primary" :loading="syncStore.saving" :disabled="!canConfigure" @click="onSaveOptionsClick">
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
          :disabled="
            !canConfigure ||
            !syncNowActionAllowed ||
            syncStore.syncing ||
            (wantsRelaySync
              ? !relaySyncReady
              : !syncStore.isManualMode && (!syncStore.hasHandle || !syncStore.filePickerSupported))
          "
          @click="onSyncNow"
        >
          <template #icon><CloudSyncOutlined /></template>
          Şimdi senkronize et
        </Button>
      </Space>
    </template>

    <Divider v-if="syncStore.deviceId" class="kp-sync-device-divider" />

    <Typography.Paragraph v-if="syncStore.deviceId" class="kp-text-muted kp-sync-device">
      <span class="kp-sync-device__label">Cihaz kimliği:</span>
      <code class="kp-sync-device__id">{{ syncStore.deviceId }}</code>
    </Typography.Paragraph>
  </Space>

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
    :body-style="{ overflow: 'hidden' }"
    @ok="confirmPasswordAndSync"
  >
    <Form layout="vertical" :colon="false">
      <FormItem :label="passwordModalLabel" :validate-status="syncPasswordError ? 'error' : ''" :help="syncPasswordError">
        <InputPassword v-model:value="syncPassword" autocomplete="current-password" @press-enter="confirmPasswordAndSync" />
      </FormItem>
      <Checkbox v-model:checked="rememberPassword">Bu oturumda parolayı hatırla</Checkbox>
    </Form>
  </Modal>

  <SyncPairingDrawer />
  <SyncDeviceDrawer v-model:open="relayDevicesDrawerOpen" />
  <SyncUnlockModal />
  </div>
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

.kp-sync-form__checks {
  margin-top: 8px;
}

.kp-sync-file {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.kp-sync-device-divider {
  margin: 12px 0 2px;
}

.kp-sync-device {
  margin-top: 0;
  margin-bottom: 0 !important;
  font-size: 12px;
}

.kp-sync-device__label {
  margin-inline-end: 6px;
}

.kp-sync-device__id {
  font-size: 11px;
}

@media (max-width: 768px) {
  .kp-sync-file {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .kp-sync-actions.ant-space {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 8px !important;
  }

  .kp-sync-actions > :deep(.ant-space-item) {
    width: 100%;
    max-width: 100%;
    margin: 0 !important;
  }

  .kp-sync-actions > :deep(.ant-space-item) > * {
    display: block;
    width: 100%;
  }

  .kp-sync-actions :deep(.ant-btn) {
    width: 100%;
  }

  .kp-sync-device {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .kp-sync-device__label {
    display: block;
    margin-inline-end: 0;
  }

  .kp-sync-device__id {
    display: block;
    max-width: 100%;
    word-break: break-all;
  }
}

.kp-sync-manual-input {
  display: none;
}

.kp-sync-manual-hint {
  display: block;
  font-size: 12px;
  line-height: 1.4;
}

.kp-sync-relay-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.kp-sync-relay-actions {
  display: block;
  margin-bottom: 24px;
}
</style>
