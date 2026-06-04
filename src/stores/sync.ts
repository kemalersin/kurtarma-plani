import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import type { ConflictContext, EsrSync, EsrSyncStatus } from '@senkronla/client'
import { getAppMeta, getProfile, updateAppMeta } from '@/core/db/meta'
import {
  createSyncFileHandle,
  defaultSyncFileName,
  getStoredSyncHandle,
  pickSyncFileHandle,
  readSyncEnvelopeFromFile,
  resolveSyncFilePasswordError,
  resolveSyncMode,
  supportsSyncFilePicker,
} from '@/core/services/sync/sync-file'
import { clearStoredSyncHandle } from '@/core/services/sync/sync-handle-store'
import { decideAutoPull, buildConflictContext, buildRelayConflictContext, type SyncConflictContext } from '@/core/services/sync/sync-conflict'
import {
  envelopeProfileMismatch,
  readSyncEnvelopeFromHandle,
  remoteRevisionChanged,
  runManualModePull,
  runManualModePush,
  runManualModeSync,
  runManualSync,
  runPullFromEnvelope,
  runPullSync,
  runPushSync,
} from '@/core/services/sync/sync-engine'
import {
  connectRelaySession,
  createRelayPasswordResolver,
  disconnectRelaySession,
  ensureRelayNamespace,
  activateRelaySession,
  flushRelayPush,
  markRelayLocalChange,
  cancelRelayDebouncedPush,
  runRelaySync,
  runRelayManualSync,
  validateRelayConfig,
  type RelaySessionCallbacks,
} from '@/core/services/sync/relay-session'
import {
  createRelayConflictChoiceGate,
  createRelayStoreCallbacks,
  type RelayConflictChoice,
} from '@/core/services/sync/sync-relay-bridge'
import {
  isRelayDeviceTokenInvalidError,
  relayErrorMessageFromUnknown,
  toRelayUserError,
  translateRelayErrorMessage,
} from '@/core/services/sync/relay-errors'
import { parseEsrPairingInput } from '@/core/services/sync/relay-pairing'
import {
  ensureSetupProfileStub,
  isEmptySetupProfileStub,
  isRemovableSetupProfileStub,
} from '@/core/services/sync/setup-profile-stub'
import {
  clearRelayDeviceToken,
  clearRelayNamespaceStorage,
  hasRelayDeviceToken,
  readRelayDeviceToken,
} from '@/core/services/sync/relay-device-token'
import type { SyncFileEnvelope } from '@/core/types/sync'
import {
  applySyncConfigPatch,
  createDefaultSyncConfig,
  isRelayTransport,
  isRelayConnectedForProfile,
  normalizePersistedSyncConfig,
  omitProfileSyncState,
  pickProfileSyncPreferences,
  resolveSyncConfigForProfile,
  relaySessionConfigKey as buildRelaySessionConfigKey,
  syncConfigForPersist,
  syncFileNameForProfile,
  type SyncConfig,
} from '@/core/types/sync'
import { useProfileStore } from '@/stores/profile'
import type { RelayPairingHostState, RelayPairingMode } from '@/core/types/relay-pairing'
import type {
  RelayDeviceLimitContext,
  RelayDevicesSnapshot,
  RelayNamespaceLimits,
} from '@/core/types/relay-devices'
import type { StoredSyncHandle } from '@/core/services/sync/sync-handle-store'

export type SyncRuntimeStatus =
  | 'disabled'
  | 'idle'
  | 'pending_file'
  | 'pending_relay'
  | 'pending_push'
  | 'remote_pending'
  | 'profile_mismatch'
  | 'conflict'
  | 'error'
  | 'offline'
  | 'ws_connected'

const SESSION_PWD_KEY = 'kp-sync-session-pwd'

export interface SyncProfileMismatchInfo {
  fileProfileId: string
  fileProfileName: string
}

export interface EnsureRelayConnectionOptions {
  /** Yapılandırma/parola eksikliği lastError yazmaz (sayfa yükleme, arka plan). */
  silent?: boolean
}

export interface ManualSyncActionOptions {
  filePassword?: string
  pullRemote: boolean
  /** UI taslağındaki şifreleme bayrakları (doğrulama ve gerekirse kayıt). */
  passwordConfig?: Pick<SyncConfig, 'encryptFile' | 'useProfilePassword'>
}

/** Kurulum → Senkronla sekmesinde misafir eşleştirme; profil relay pull ile oluşturulur. */
export interface SetupRelayJoinOptions {
  /** 6 haneli kod veya host `esr://pair/v1/…` QR bağlantısı. */
  pairingInput: string
  /** Yalnızca 6 haneli kod girildiğinde host profil kimliği (UUID). */
  namespaceId?: string
  profilePassword?: string
  relayUrl: string
  appId: string
  encryptFile?: boolean
  useProfilePassword?: boolean
  syncPassword?: string
  rememberSyncPassword?: boolean
}

export interface JoinRelayPairingOptions {
  /** Kurulum Senkronla: çift redeem ve kısmi başarı toleransı; drawer kapatılmaz. */
  fromSetup?: boolean
}

export interface SaveConfigOptions {
  /** `true` ise relay bağlantısı kurulmaz (kurulumda eşleştirmeden önce). */
  skipRelayConnect?: boolean
}

export const useSyncStore = defineStore('sync', () => {
  const deviceId = ref('')
  const persistedSync = ref<SyncConfig>(normalizePersistedSyncConfig(null))
  const config = ref<SyncConfig>(createDefaultSyncConfig())
  const loaded = ref(false)
  const saving = ref(false)
  const syncing = ref(false)
  const hasHandle = ref(false)
  const pendingPush = ref(false)
  const lastLocalMutationAt = ref<string | null>(null)
  const lastPushAt = ref<string | null>(null)
  const sessionFilePassword = ref<string | undefined>(undefined)
  const conflictPending = ref(false)
  const conflictContext = ref<SyncConflictContext | null>(null)
  const conflictModalOpen = ref(false)
  const profileMismatch = ref<SyncProfileMismatchInfo | null>(null)
  /** Manuel modda son seçilen uzak zarf (handle yok). */
  const manualRemoteEnvelope = ref<SyncFileEnvelope | null>(null)
  const relaySession = shallowRef<EsrSync | null>(null)
  const relayEsrStatus = ref<EsrSyncStatus | null>(null)
  const relayPendingRecovery = ref<{ phrase: string; namespaceId: string } | null>(null)
  const relayRecoveryModalOpen = ref(false)
  const relayPairingDrawerOpen = ref(false)
  const relayPairingMode = ref<RelayPairingMode>('host')
  const relayPairingHost = ref<RelayPairingHostState | null>(null)
  const relayPairingLoading = ref(false)
  const relayDevices = ref<RelayDevicesSnapshot | null>(null)
  const relayDevicesLoading = ref(false)
  const relayDeviceLimitContext = ref<RelayDeviceLimitContext | null>(null)
  const relayUnlockModalOpen = ref(false)
  const relayConflictGate = createRelayConflictChoiceGate()
  /** Aktif relay oturumunun bağlı olduğu profil — gereksiz teardown/connect önler. */
  const relayBoundProfileId = ref<string | null>(null)
  /** Oturum oluşturulurken kullanılan adapter ayarları (encryptFile vb.). */
  const relaySessionConfigKey = ref<string | null>(null)
  let relayConnectPromise: Promise<boolean> | null = null
  let relayDevicesRefreshPromise: Promise<void> | null = null
  let setupRelayJoinInFlight: Promise<string> | null = null
  let relayRejectionHookInstalled = false
  /** Otomatik relay bağlantısı devam ediyor (sayfa açılışı). */
  const relayConnecting = ref(false)
  /** Uzak import / store reload sırasında yerel push bildirimlerini bastırır. */
  const remoteApplyDepth = ref(0)
  const isApplyingRemote = computed(() => remoteApplyDepth.value > 0)
  /** Sessiz otomatik bağlantı başarısız — rozet ipucu (ör. parola gerekli). */
  const relayStatusHint = ref<string | null>(null)

  let lastSyncErrorToastAt = 0
  let lastSyncErrorToastMessage = ''

  function showSyncErrorToast(text: string): void {
    const normalized = text.trim()
    if (!normalized) return
    const now = Date.now()
    if (normalized === lastSyncErrorToastMessage && now - lastSyncErrorToastAt < 2500) return
    lastSyncErrorToastMessage = normalized
    lastSyncErrorToastAt = now
    antMessage.error(normalized)
  }

  /** Eşleştirme drawer / kurulum join — toast bileşen catch'te; store çift göstermesin. */
  function shouldDeferRelayPairingUserToast(): boolean {
    return Boolean(relayPairingLoading.value || setupRelayJoinInFlight)
  }

  /** Relay kullanıcı/API hataları — toast + navbar ipucu; relay modunda lastError ile kalıcı. */
  function reportRelayUserError(messageOrError: string | unknown, silent = false): void {
    const localized = relayErrorMessageFromUnknown(messageOrError)
    relayStatusHint.value = localized
    if (!silent && !shouldDeferRelayPairingUserToast()) {
      showSyncErrorToast(localized)
    }
    if (loaded.value && isRelayMode.value) {
      void persistRelayLastError(localized)
    }
  }

  function clearRelayUserError(): void {
    relayStatusHint.value = null
    if (loaded.value && isRelayMode.value && config.value.lastError) {
      void persistRelayLastError(undefined)
    }
  }

  async function persistRelayLastError(message: string | undefined): Promise<void> {
    if (message === config.value.lastError) return
    await saveConfig({ lastError: message })
  }

  function syncRelayStatusHintFromConfig(): void {
    if (!isRelayMode.value) {
      relayStatusHint.value = null
      return
    }
    const err = config.value.lastError
    if (err && !isRelayDeferredSetupError(err)) {
      relayStatusHint.value = err
      return
    }
    if (!err) {
      relayStatusHint.value = null
    }
  }

  /** Uzak pull sonrası sayfa bileşenlerini yeniden yüklemek için artar. */
  const pullRevision = ref(0)
  const bootstrapDone = ref(false)
  let bootstrapPromise: Promise<void> | null = null

  function bumpPullRevision(_reason?: string): void {
    pullRevision.value += 1
  }

  async function ensureBootstrapPull(): Promise<void> {
    if (bootstrapDone.value) return
    if (!bootstrapPromise) {
      bootstrapPromise = (async () => {
        const profileStore = useProfileStore()
        if (!profileStore.unlocked) return

        // Profil açıldıktan veya sayfa yenilendikten sonra otomatik relay bağlantısı.
        if (isRelayMode.value && enabled.value && relaySettingsSaved.value) {
          await ensureRelayConnection({ silent: true })
        } else if (!isRelayMode.value) {
          await refreshHandleState()
          if (!hasHandle.value) {
            await refreshProfileBinding()
          }
        }

        if (enabled.value && syncTransportReady.value && !profileMismatch.value) {
          if (!isRelayMode.value) {
            const pulled = await pullIfEnabled()
            if (pulled) bumpPullRevision('bootstrap')
          }
          // Relay: ilk durum NotificationClient head kontrolü ile gelir (bootstrap syncFull tekrarı yok).
        }
      })().finally(() => {
        bootstrapDone.value = true
        bootstrapPromise = null
      })
    }
    await bootstrapPromise
  }

  function activeProfileId(): string | null {
    return useProfileStore().activeProfileId
  }

  async function getHandleForActiveProfile(): Promise<{
    profileId: string
    stored: StoredSyncHandle
  } | null> {
    const profileId = activeProfileId()
    if (!profileId) return null
    const stored = await getStoredSyncHandle(profileId)
    if (!stored) return null
    return { profileId, stored }
  }

  const activeFileName = computed(() =>
    syncFileNameForProfile(config.value, activeProfileId()),
  )

  const enabled = computed(() => config.value.enabled)
  const isRelayMode = computed(() => isRelayTransport(config.value))
  /** Kullanıcı «Senkron ayarlarını kaydet» ile relay uç noktasını onayladı mı? */
  const relaySettingsSaved = computed(() => config.value.relayEndpointLocked === true)
  const relayConfigValidation = computed(() => validateRelayConfig(config.value))
  /** Navbar / badge — relay yapılandırma veya bağlantı hatası (toast'tan bağımsız kalıcı ipucu). */
  const relayUserErrorMessage = computed(() => {
    let message: string | null | undefined = relayStatusHint.value
    if (!message && isRelayMode.value && config.value.lastError) {
      message = config.value.lastError
    }
    if (!message && isRelayMode.value && !relayConfigValidation.value.ok) {
      message = relayConfigValidation.value.message
    }
    return message ? translateRelayErrorMessage(undefined, message) : null
  })
  const filePickerSupported = computed(() => supportsSyncFilePicker())
  const isManualMode = computed(() => config.value.syncMode === 'manual')

  const syncTransportReady = computed(() => {
    if (isRelayMode.value) {
      return relayConfigValidation.value.ok && relaySession.value !== null
    }
    return hasHandle.value
  })

  const canAutoPush = computed(() => {
    if (!enabled.value || !config.value.autoPush || syncing.value) return false
    const profileStore = useProfileStore()
    if (!profileStore.unlocked || !profileStore.activeProfileId) return false

    if (isRelayMode.value) {
      return syncTransportReady.value && !conflictPending.value
    }

    if (!hasHandle.value) return false
    if (isManualMode.value || !filePickerSupported.value) return false
    return true
  })

  const canAutoPull = computed(() => {
    if (!enabled.value || syncing.value) return false
    const profileStore = useProfileStore()
    if (!profileStore.unlocked || !profileStore.activeProfileId) return false

    if (isRelayMode.value) {
      return syncTransportReady.value
    }

    if (!hasHandle.value) return false
    if (isManualMode.value || !filePickerSupported.value) return false
    return true
  })

  const remoteUpdatePending = ref(false)

  const runtimeStatus = computed<SyncRuntimeStatus>(() => {
    if (!config.value.enabled) return 'disabled'
    if (profileMismatch.value) return 'profile_mismatch'
    if (relayUserErrorMessage.value || (!isRelayMode.value && config.value.lastError)) return 'error'

    if (isRelayMode.value) {
      if (!relayConfigValidation.value.ok) return 'error'
      if (relayConnecting.value) return 'pending_push'
      if (!relaySession.value) return 'pending_relay'
      if (relayEsrStatus.value === 'offline') return 'offline'
      if (relayEsrStatus.value === 'ws_connected') return 'ws_connected'
    } else if (!hasHandle.value) {
      return 'pending_file'
    }

    if (conflictPending.value) return 'conflict'
    if (remoteUpdatePending.value) return 'remote_pending'
    if (pendingPush.value) return 'pending_push'
    return 'idle'
  })

  function loadSessionPassword(): void {
    try {
      sessionFilePassword.value = sessionStorage.getItem(SESSION_PWD_KEY) ?? undefined
    } catch {
      sessionFilePassword.value = undefined
    }
  }

  function rememberSessionPassword(password: string | undefined, remember: boolean): void {
    sessionFilePassword.value = password
    try {
      if (remember && password) {
        sessionStorage.setItem(SESSION_PWD_KEY, password)
      } else {
        sessionStorage.removeItem(SESSION_PWD_KEY)
      }
    } catch {
      // sessionStorage erişilemezse yalnızca bellekte tutulur
    }
  }

  function clearSessionPassword(): void {
    sessionFilePassword.value = undefined
    try {
      sessionStorage.removeItem(SESSION_PWD_KEY)
    } catch {
      // ignore
    }
  }

  function markLocalMutation(): void {
    lastLocalMutationAt.value = new Date().toISOString()
    if (!conflictPending.value) {
      remoteUpdatePending.value = false
    }
  }

  function beginRemoteApply(): void {
    remoteApplyDepth.value += 1
  }

  async function finishRemoteApply(): Promise<void> {
    remoteApplyDepth.value = Math.max(0, remoteApplyDepth.value - 1)
    if (remoteApplyDepth.value > 0) return

    const { cancelPendingSyncPush } = await import('@/core/services/sync/sync-scheduler')
    cancelPendingSyncPush()
    pendingPush.value = false
    lastLocalMutationAt.value = null

    if (isRelayMode.value && relaySession.value) {
      try {
        cancelRelayDebouncedPush(relaySession.value)
        await flushRelayPush(relaySession.value)
      } catch {
        // Debounce iptali; gerçek yazma hatası bir sonraki sync'te raporlanır.
      }
    }
  }

  function clearProfileMismatch(): void {
    profileMismatch.value = null
  }

  function applyEffectiveSyncMode(): void {
    const effective = resolveSyncMode(config.value.syncMode)
    if (config.value.syncMode !== effective) {
      config.value = { ...config.value, syncMode: effective }
    }
  }

  async function persistEffectiveSyncMode(): Promise<void> {
    applyEffectiveSyncMode()
    const effective = config.value.syncMode
    const profileId = activeProfileId()
    if (!profileId) return
    const stored = persistedSync.value.preferencesByProfile?.[profileId]?.syncMode
    if (stored !== effective) {
      await saveConfig({ syncMode: effective })
    }
  }

  function syncFileNameForActiveProfile(): string {
    const profileStore = useProfileStore()
    return (
      syncFileNameForProfile(config.value, activeProfileId()) ??
      defaultSyncFileName(profileStore.activeProfile?.name ?? 'profil')
    )
  }

  async function registerManualFileName(fileName: string): Promise<void> {
    const profileId = activeProfileId()
    if (!profileId) return
    hasHandle.value = true
    await saveConfig({
      fileNameByProfile: {
        ...config.value.fileNameByProfile,
        [profileId]: fileName,
      },
      lastError: undefined,
    })
  }

  async function ingestManualFile(file: File): Promise<SyncFileEnvelope | null> {
    const envelope = await readSyncEnvelopeFromFile(file)
    await registerManualFileName(file.name)
    manualRemoteEnvelope.value = envelope
    await refreshProfileBinding()
    return envelope
  }

  async function refreshProfileBinding(): Promise<void> {
    if (isRelayMode.value) {
      clearProfileMismatch()
      return
    }

    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !enabled.value || !hasHandle.value) {
      clearProfileMismatch()
      return
    }

    try {
      const remote = await readRemoteEnvelope()
      if (envelopeProfileMismatch(remote, profile.id) && remote) {
        profileMismatch.value = {
          fileProfileId: remote.profileId,
          fileProfileName: remote.profileName,
        }
        if (
          config.value.lastError?.includes('farklı bir profile ait') ||
          config.value.lastError?.includes('profile uymuyor')
        ) {
          await saveConfig({ lastError: undefined })
        }
      } else {
        clearProfileMismatch()
      }
    } catch {
      // Dosya okunamazsa mevcut durumu koru
    }
  }

  function openConflictModal(): void {
    conflictModalOpen.value = true
  }

  function setConflictState(envelope: SyncFileEnvelope): void {
    conflictPending.value = true
    remoteUpdatePending.value = true
    conflictContext.value = buildConflictContext(
      envelope,
      lastLocalMutationAt.value,
      lastPushAt.value ?? config.value.lastSyncAt,
    )
  }

  function clearConflictState(): void {
    conflictPending.value = false
    conflictContext.value = null
    remoteUpdatePending.value = false
    conflictModalOpen.value = false
  }

  function setPendingPush(value: boolean): void {
    pendingPush.value = value
  }

  function resolveAutoPushPassword(): string | undefined {
    if (!config.value.encryptFile) return undefined
    return sessionFilePassword.value
  }

  function canPushWithCurrentPassword(profileHasPassword: boolean): boolean {
    return getSyncPasswordRequirementError(profileHasPassword) === null
  }

  function resolveSyncPasswordForAction(
    filePassword?: string,
    cfg?: Pick<SyncConfig, 'encryptFile' | 'useProfilePassword'>,
    explicitPassword?: string,
  ): string | undefined {
    const trimmed = explicitPassword?.trim() || filePassword?.trim()
    if (trimmed) return trimmed

    const session = resolveAutoPushPassword()
    const flagsMatch =
      !cfg ||
      (cfg.encryptFile === config.value.encryptFile &&
        cfg.useProfilePassword === config.value.useProfilePassword)
    if (flagsMatch) return session
    // Kurulum / taslak: encryptFile henüz IndexedDB'ye yazılmadan oturum parolası
    if (cfg?.encryptFile && session) return session
    return undefined
  }

  function getSyncPasswordRequirementError(
    profileHasPassword?: boolean,
    cfg?: Pick<SyncConfig, 'encryptFile' | 'useProfilePassword'>,
    explicitPassword?: string,
  ): string | null {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (profileHasPassword === undefined && !profile) {
      return 'Aktif profil yok.'
    }
    const hasPassword = profileHasPassword ?? profile?.password.enabled ?? false
    const effective = cfg ? { ...config.value, ...cfg } : config.value
    const password = resolveSyncPasswordForAction(undefined, cfg, explicitPassword)
    return resolveSyncFilePasswordError(effective, hasPassword, password)
  }

  function relayErrorCode(error: unknown): string | undefined {
    if (error instanceof Error) {
      const coded = error as Error & { code?: string }
      if (coded.code) return String(coded.code)
    }
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as { code: string }).code)
    }
    return undefined
  }

  function relayErrorMessage(error: unknown): string {
    return relayErrorMessageFromUnknown(error)
  }

  function isRelayReconnectRequiredError(code: string | undefined): boolean {
    return (
      code === 'ESR_CLIENT_NAMESPACE_EXISTS' ||
      code === 'ESR_CLIENT_NEEDS_PAIRING' ||
      code === 'ESR_CLIENT_NO_TOKEN' ||
      code === 'DEVICE_TOKEN_INVALID' ||
      code === 'UNAUTHORIZED'
    )
  }

  function promptRelayReconnect(
    silent: boolean,
    mode: RelayPairingMode = 'guest',
    messageCode: 'DEVICE_TOKEN_INVALID' | 'ESR_CLIENT_NEEDS_PAIRING' | 'ESR_CLIENT_NAMESPACE_EXISTS' = 'DEVICE_TOKEN_INVALID',
  ): void {
    relayPairingMode.value = mode
    relayPairingDrawerOpen.value = true
    const fallback =
      messageCode === 'ESR_CLIENT_NAMESPACE_EXISTS'
        ? 'This namespace was created on another device; use pairing or recovery'
        : messageCode === 'ESR_CLIENT_NEEDS_PAIRING'
          ? 'Device token missing; call ensureNamespace, joinPairing, or recover'
          : 'Device token is invalid or revoked'
    const msg = translateRelayErrorMessage(messageCode, fallback)
    if (silent) {
      relayStatusHint.value = msg
    } else {
      reportRelayUserError(msg)
    }
  }

  function isRelayDeferredSetupError(message: string | undefined): boolean {
    if (!message) return false
    return (
      message.includes('parolası') ||
      message.includes('parola gerekli') ||
      message === 'Otomatik senkron kapalı; önce etkinleştirin.' ||
      message === 'Senkron için oturum açık bir profil gerekli.'
    )
  }

  function resolveRelaySyncPassword(): () => Promise<string | undefined> {
    return createRelayPasswordResolver(config.value, () => resolveAutoPushPassword() ?? '')
  }

  function setRelayConflictState(ctx: ConflictContext): void {
    conflictPending.value = true
    remoteUpdatePending.value = true
    conflictContext.value = buildRelayConflictContext(
      {
        remoteRevision: ctx.remoteRevision,
        remoteWrittenAt: ctx.remoteMeta.writtenAt,
      },
      lastLocalMutationAt.value,
      lastPushAt.value ?? config.value.lastSyncAt,
    )
  }

  function teardownRelaySession(): void {
    if (relaySession.value) {
      disconnectRelaySession(relaySession.value)
      relaySession.value = null
    }
    relayBoundProfileId.value = null
    relaySessionConfigKey.value = null
    relayEsrStatus.value = null
    relayConflictGate.cancelPending()
    relayDevices.value = null
    relayDeviceLimitContext.value = null
    relayUnlockModalOpen.value = false
  }

  function handleRelayDeviceLimit(ctx: RelayDeviceLimitContext): void {
    relayDeviceLimitContext.value = ctx
    if (ctx.code === 'DEVICE_LIMIT_PAYMENT_REQUIRED') {
      relayUnlockModalOpen.value = true
    }
  }

  async function refreshRelayDevices(): Promise<void> {
    if (!isRelayMode.value || !enabled.value) {
      relayDevices.value = null
      return
    }

    if (relayDevicesRefreshPromise) {
      return relayDevicesRefreshPromise
    }

    relayDevicesRefreshPromise = refreshRelayDevicesInner().finally(() => {
      relayDevicesRefreshPromise = null
    })
    return relayDevicesRefreshPromise
  }

  async function refreshRelayDevicesInner(): Promise<void> {
    if (!relaySession.value || relayEsrStatus.value === 'disabled') {
      const connected = await ensureRelayConnection({ silent: true })
      if (!connected || !relaySession.value) return
    }

    relayDevicesLoading.value = true
    try {
      const result = await relaySession.value.listDevices()
      relayDevices.value = {
        devices: result.devices,
        limits: result.limits,
      }
    } catch (error) {
      if (isRelayDeviceTokenInvalidError(error)) {
        await handleRelayAuthFailure(error, { silent: false })
        return
      }
      reportRelayUserError(relayErrorMessage(error), true)
      throw error
    } finally {
      relayDevicesLoading.value = false
    }
  }

  async function revokeRelayDevice(deviceId: string): Promise<void> {
    if (!relaySession.value) {
      throw new Error('Relay bağlantısı yok.')
    }
    relayDevicesLoading.value = true
    try {
      await relaySession.value.revokeDevice(deviceId)
      await refreshRelayDevices()
      await saveConfig({ lastError: undefined })
    } finally {
      relayDevicesLoading.value = false
    }
  }

  async function redeemRelayUnlockCode(unlockCode: string): Promise<void> {
    const normalized = unlockCode.trim()
    if (!normalized) {
      throw new Error('Unlock kodu gerekli.')
    }
    if (!relaySession.value) {
      throw new Error('Relay bağlantısı yok.')
    }

    relayDevicesLoading.value = true
    try {
      await relaySession.value.redeemUnlockCode(normalized)
      relayUnlockModalOpen.value = false
      relayDeviceLimitContext.value = null
      await refreshRelayDevices()
      await saveConfig({ lastError: undefined })
    } finally {
      relayDevicesLoading.value = false
    }
  }

  function dismissRelayDeviceLimitAlert(): void {
    if (relayDeviceLimitContext.value?.code === 'DEVICE_LIMIT_BLOCKED') {
      relayDeviceLimitContext.value = null
    }
  }

  async function markRelayProfileConnected(profileId: string): Promise<void> {
    clearRelayUserError()
    await saveConfig({
      relayConnectedByProfile: {
        ...config.value.relayConnectedByProfile,
        [profileId]: true,
      },
      lastError: undefined,
    })
  }

  async function markRelayProfileDisconnected(profileId: string): Promise<void> {
    const map = { ...config.value.relayConnectedByProfile }
    delete map[profileId]
    await saveConfig({ relayConnectedByProfile: map }, { skipRelayConnect: true })
  }

  async function handleRelayAuthFailure(
    error: unknown,
    opts?: { silent?: boolean },
  ): Promise<void> {
    const silent = opts?.silent ?? false
    const code = relayErrorCode(error)
    const message = relayErrorMessage(error)
    const profile = useProfileStore().activeProfile
    const authFailure =
      isRelayDeviceTokenInvalidError(error) ||
      (code !== undefined && isRelayReconnectRequiredError(code))

    if (profile && authFailure) {
      clearRelayDeviceToken(profile.id)
      await markRelayProfileDisconnected(profile.id)
    }
    teardownRelaySession()

    if (!authFailure) {
      if (silent) relayStatusHint.value = message
      else reportRelayUserError(message)
      return
    }

    const mode: RelayPairingMode =
      code === 'ESR_CLIENT_NAMESPACE_EXISTS' ? 'recover' : 'guest'
    const messageCode =
      code === 'ESR_CLIENT_NAMESPACE_EXISTS'
        ? 'ESR_CLIENT_NAMESPACE_EXISTS'
        : code === 'ESR_CLIENT_NEEDS_PAIRING'
          ? 'ESR_CLIENT_NEEDS_PAIRING'
          : 'DEVICE_TOKEN_INVALID'
    promptRelayReconnect(silent, mode, messageCode)
  }

  function installRelayUnhandledRejectionHandler(): void {
    if (relayRejectionHookInstalled || typeof window === 'undefined') return
    relayRejectionHookInstalled = true
    window.addEventListener('unhandledrejection', (event) => {
      if (!isRelayDeviceTokenInvalidError(event.reason)) return
      event.preventDefault()
      void handleRelayAuthFailure(event.reason, { silent: false })
    })
  }

  function createSilentRelaySessionCallbacks(): RelaySessionCallbacks {
    const gate = createRelayConflictChoiceGate()
    return createRelayStoreCallbacks(
      {
        onRecoveryPhrase: async () => {},
        onConflictDetected: () => {},
        onStatusChange: () => {},
        onError: () => {},
      },
      gate,
    )
  }

  async function revokeCurrentRelayDevice(session: EsrSync): Promise<void> {
    const { devices } = await session.listDevices()
    const current = devices.find((d) => d.isCurrent)
    if (current) {
      await session.revokeDevice(current.deviceId)
    }
  }

  /** Profil silinmeden önce: bu cihazın ESR kaydını kaldır (en iyi çaba). */
  async function revokeRelayDeviceForDeletedProfile(profileId: string): Promise<void> {
    const wasRelayBound =
      isRelayConnectedForProfile(persistedSync.value, profileId) ||
      hasRelayDeviceToken(profileId)
    if (!wasRelayBound) return

    const profileConfig = resolveSyncConfigForProfile(persistedSync.value, profileId)
    if (!isRelayTransport(profileConfig)) {
      clearRelayNamespaceStorage(profileId)
      return
    }

    try {
      if (
        relaySession.value &&
        relayBoundProfileId.value === profileId &&
        relayEsrStatus.value !== 'disabled' &&
        relayEsrStatus.value !== null
      ) {
        await revokeCurrentRelayDevice(relaySession.value)
        return
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) return

      const validation = validateRelayConfig(profileConfig)
      if (!validation.ok) return

      const profile = await getProfile(profileId)
      if (!profile) return

      const session = await connectRelaySession({
        profile,
        dataKey: null,
        config: profileConfig,
        resolveSyncPassword: createRelayPasswordResolver(profileConfig, () =>
          resolveAutoPushPassword() ?? '',
        ),
        callbacks: createSilentRelaySessionCallbacks(),
      })
      try {
        await revokeCurrentRelayDevice(session)
      } finally {
        disconnectRelaySession(session)
      }
    } catch {
      // Çevrimdışı / süresi dolmuş token — yerel temizlik yine uygulanır
    } finally {
      clearRelayNamespaceStorage(profileId)
    }
  }

  /** Profil silindiğinde: ESR cihaz iptali + senkron meta temizliği. */
  async function onProfileDeleted(profileId: string): Promise<void> {
    if (!loaded.value) await load()

    await revokeRelayDeviceForDeletedProfile(profileId)

    if (relayBoundProfileId.value === profileId) {
      teardownRelaySession()
    }

    persistedSync.value = omitProfileSyncState(persistedSync.value, profileId)
    const updated = await updateAppMeta({ sync: syncConfigForPersist(persistedSync.value) })
    deviceId.value = updated.deviceId ?? deviceId.value

    if (activeProfileId() === profileId) {
      applyResolvedConfig(null)
      hasHandle.value = false
    }
  }

  function createRelaySessionCallbacks(profile: { id: string; name: string }) {
    return createRelayStoreCallbacks(
      {
        onRecoveryPhrase: async (ctx) => {
          if (isRelayConnectedForProfile(config.value, profile.id)) {
            clearRelayDeviceToken(profile.id)
            relayPendingRecovery.value = null
            relayRecoveryModalOpen.value = false
            throw Object.assign(new Error('ESR_CLIENT_NAMESPACE_EXISTS'), {
              code: 'ESR_CLIENT_NAMESPACE_EXISTS',
            })
          }
          relayPendingRecovery.value = ctx
          relayRecoveryModalOpen.value = true
          await markRelayProfileConnected(profile.id)
        },
        onConflictDetected: (ctx) => {
          setRelayConflictState(ctx)
          openConflictModal()
        },
        onStatusChange: (status) => {
          relayEsrStatus.value = status
          if (status === 'pending_push') {
            pendingPush.value = true
          } else if (status === 'idle' || status === 'ws_connected') {
            pendingPush.value = false
            if (!relayConflictGate.hasPending() && !conflictPending.value) {
              remoteUpdatePending.value = false
            }
          } else if (status === 'conflict') {
            conflictPending.value = true
          } else if (status === 'offline') {
            relayEsrStatus.value = 'offline'
          }
        },
        onError: (message) => {
          if (isRelayDeviceTokenInvalidError(message)) {
            void handleRelayAuthFailure(message, { silent: false })
            return
          }
          reportRelayUserError(message)
        },
        onRemotePull: async () => {
          lastLocalMutationAt.value = null
          clearConflictState()
          remoteUpdatePending.value = false
          bumpPullRevision('ws')
          await saveConfig({
            lastSyncAt: new Date().toISOString(),
            lastError: undefined,
          })
        },
        onBeforeRemoteApply: () => {
          beginRemoteApply()
        },
        onAfterRemoteApply: async () => {
          await finishRemoteApply()
        },
        onDeviceLimit: async (ctx) => {
          handleRelayDeviceLimit({
            namespaceId: ctx.namespaceId,
            code: ctx.code,
            limits: ctx.limits as RelayNamespaceLimits,
            slotPackages: ctx.slotPackages,
          })
        },
      },
      relayConflictGate,
    )
  }

  async function validateRelaySessionPrerequisites(
    silent: boolean,
  ): Promise<{ profile: NonNullable<ReturnType<typeof useProfileStore>['activeProfile']> } | null> {
    async function reportSetupError(message: string): Promise<void> {
      reportRelayUserError(message, silent)
    }

    if (!isRelayMode.value) return null
    if (!enabled.value) {
      await reportSetupError('Otomatik senkron kapalı; önce etkinleştirin.')
      return null
    }

    const validation = relayConfigValidation.value
    if (!validation.ok) {
      await reportSetupError(validation.message)
      return null
    }

    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      await reportSetupError('Senkron için oturum açık bir profil gerekli.')
      return null
    }

    const pwdError = getSyncPasswordRequirementError(profile.password.enabled)
    if (pwdError) {
      await reportSetupError(pwdError)
      return null
    }

    return { profile }
  }

  async function getOrCreateRelaySession(silent = false): Promise<EsrSync | null> {
    if (relaySession.value) {
      const expectedKey = buildRelaySessionConfigKey(config.value)
      if (relaySessionConfigKey.value === expectedKey) {
        return relaySession.value
      }
      teardownRelaySession()
    }

    const ctx = await validateRelaySessionPrerequisites(silent)
    if (!ctx) return null

    const profileStore = useProfileStore()
    try {
      const session = await connectRelaySession({
        profile: ctx.profile,
        dataKey: profileStore.encryptionKey,
        config: config.value,
        resolveSyncPassword: resolveRelaySyncPassword(),
        callbacks: createRelaySessionCallbacks(ctx.profile)
      })
      relaySession.value = session
      relayBoundProfileId.value = ctx.profile.id
      relayEsrStatus.value = session.getStatus()
      return session
    } catch (error) {
      reportRelayUserError(error, silent)
      teardownRelaySession()
      return null
    }
  }

  async function rollbackFailedSetupRelayJoin(namespaceId: string): Promise<void> {
    teardownRelaySession()
    clearRelayDeviceToken(namespaceId)
    if (!(await isRemovableSetupProfileStub(namespaceId))) return
    try {
      const profileStore = useProfileStore()
      await profileStore.removeProfile(namespaceId)
      await profileStore.load()
      if (activeProfileId() === namespaceId) {
        applyResolvedConfig(null)
        hasHandle.value = false
      }
    } catch {
      /* iskelet temizliği başarısız olsa da asıl hatayı ilet */
    }
  }

  async function ensureRelayConnection(
    options: EnsureRelayConnectionOptions = {},
  ): Promise<boolean> {
    const silent = options.silent ?? false
    if (isRelayMode.value && !relaySettingsSaved.value) return false
    if (relaySession.value && relayEsrStatus.value !== 'disabled') return true

    if (relayConnectPromise) return relayConnectPromise

    relayConnectPromise = (async () => {
      await reconcileSyncEncryptForActiveProfile()
      return ensureRelayConnectionInner(silent)
    })().finally(() => {
      relayConnectPromise = null
    })
    return relayConnectPromise
  }

  async function reconcileSyncEncryptForActiveProfile(): Promise<void> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile?.password.enabled && config.value.encryptFile && !resolveAutoPushPassword()?.trim()) {
      await saveConfig({ encryptFile: false, useProfilePassword: false })
      relayStatusHint.value = null
    }
  }

  async function ensureRelayBootReconnect(): Promise<void> {
    if (!loaded.value || !enabled.value || !isRelayMode.value || !relaySettingsSaved.value) return
    const profileStore = useProfileStore()
    if (!profileStore.unlocked) return
    await ensureRelayConnection({ silent: true })
  }

  async function ensureRelayConnectionInner(silent: boolean): Promise<boolean> {
    relayConnecting.value = true
    if (!silent) relayStatusHint.value = null
    try {
      const session = await getOrCreateRelaySession(silent)
      if (!session) {
        if (silent) {
          const pwdErr = getSyncPasswordRequirementError()
          relayStatusHint.value = pwdErr
        }
        return false
      }

      try {
        const profileStore = useProfileStore()
        const profile = profileStore.activeProfile
        if (!profile) return false

        const wasConnected = isRelayConnectedForProfile(config.value, profile.id)
        if (wasConnected && !readRelayDeviceToken(profile.id)) {
          promptRelayReconnect(silent, 'guest', 'ESR_CLIENT_NEEDS_PAIRING')
          teardownRelaySession()
          return false
        }

        const result = await ensureRelayNamespace(session, {
          namespaceLabel: profile.name,
        })

        if (result.created && wasConnected) {
          clearRelayDeviceToken(profile.id)
          promptRelayReconnect(silent, 'recover', 'ESR_CLIENT_NAMESPACE_EXISTS')
          teardownRelaySession()
          return false
        }

        activateRelaySession(session)
        relayEsrStatus.value = session.getStatus()
        await session.listDevices()

        if (profile) {
          relayBoundProfileId.value = profile.id
          await markRelayProfileConnected(profile.id)
        }
        relaySessionConfigKey.value = buildRelaySessionConfigKey(config.value)
        clearRelayUserError()
        return true
      } catch (error) {
        await handleRelayAuthFailure(error, { silent })
        return false
      }
    } finally {
      relayConnecting.value = false
    }
  }

  function openRelayPairingDrawer(mode: RelayPairingMode = 'host'): void {
    relayPairingMode.value = mode
    relayPairingDrawerOpen.value = true
  }

  function closeRelayPairingDrawer(): void {
    relayPairingDrawerOpen.value = false
    relayPairingHost.value = null
  }

  function acknowledgeRecoveryPhrase(): void {
    relayPendingRecovery.value = null
    relayRecoveryModalOpen.value = false
  }

  async function startRelayPairingHost(): Promise<void> {
    relayPairingLoading.value = true
    try {
      if (!relaySession.value || relayEsrStatus.value === 'disabled') {
        const connected = await ensureRelayConnection()
        if (!connected || !relaySession.value) {
          throw new Error(relayStatusHint.value ?? 'Relay bağlantısı gerekli.')
        }
      }
      const result = await relaySession.value.startPairing()
      relayPairingHost.value = {
        code: result.code,
        qrPayload: result.qrPayload,
        expiresAt: result.expiresAt,
        allowedAppIds: result.allowedAppIds,
      }
    } finally {
      relayPairingLoading.value = false
    }
  }

  async function completeRelayJoinAfterPairing(
    session: EsrSync,
    opts?: { closeDrawer?: boolean },
  ): Promise<void> {
    const result = await runRelaySync(session)
    if (result.status === 'error') {
      throw new Error(relayErrorMessageFromUnknown(result.error))
    }
    if (result.status === 'conflict') {
      throw new Error('Uzak veri ile çakışma var; açılan pencereden seçim yapın.')
    }
    await saveConfig({ lastError: undefined })
    if (opts?.closeDrawer !== false) {
      closeRelayPairingDrawer()
    }
  }

  async function configureAndJoinRelayFromSetupInner(
    options: SetupRelayJoinOptions,
  ): Promise<string> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Senkronla için çevrimiçi bağlantı gerekli.')
    }

    const parsed = parseEsrPairingInput(options.pairingInput, options.namespaceId)
    if (!parsed.ok) {
      throw new Error(parsed.message)
    }

    const appId = options.appId.trim()
    if (!appId) {
      throw new Error('Uygulama kimliği gerekli.')
    }

    const profileStore = useProfileStore()
    if (!loaded.value) await load()
    if (!profileStore.loaded) await profileStore.load()

    if (await isEmptySetupProfileStub(parsed.namespaceId)) {
      await profileStore.removeProfile(parsed.namespaceId)
      await profileStore.load()
    }

    const encryptFile = options.encryptFile ?? false
    const existingMeta = await getProfile(parsed.namespaceId)
    const useProfilePassword =
      options.useProfilePassword ??
      (existingMeta?.password.enabled === true && encryptFile)

    const sessionPwd = useProfilePassword
      ? options.profilePassword?.trim()
      : options.syncPassword?.trim()

    const relayUrl = options.relayUrl.trim()
    const validation = validateRelayConfig({
      ...config.value,
      transport: 'relay',
      relayUrl,
    })
    if (!validation.ok) {
      throw new Error(validation.message)
    }

    const pwdError = getSyncPasswordRequirementError(
      existingMeta?.password.enabled ?? false,
      { encryptFile, useProfilePassword },
      sessionPwd,
    )
    if (pwdError) {
      throw new Error(pwdError)
    }

    const stub = await ensureSetupProfileStub(parsed.namespaceId)
    await prepareNewProfileSync(stub.id)

    const opened = await profileStore.selectProfile(
      stub.id,
      options.profilePassword,
    )
    if (!opened) {
      throw new Error(
        stub.password.enabled
          ? 'Profil açılamadı; parolayı kontrol edin.'
          : 'Profil açılamadı.',
      )
    }

    if (sessionPwd) {
      rememberSessionPassword(sessionPwd, options.rememberSyncPassword ?? true)
    }

    try {
      await saveConfig(
        {
          enabled: true,
          transport: 'relay',
          relayUrl: validation.relayUrl,
          appId,
          relayEndpointLocked: true,
          encryptFile,
          useProfilePassword,
          autoPush: true,
          lastError: undefined,
        },
        { skipRelayConnect: true },
      )

      teardownRelaySession()
      await joinRelayPairing(parsed.code, { fromSetup: true })
      await profileStore.load()
      return profileStore.activeProfile?.id ?? stub.id
    } catch (error) {
      await rollbackFailedSetupRelayJoin(parsed.namespaceId)
      throw toRelayUserError(error)
    }
  }

  async function configureAndJoinRelayFromSetup(
    options: SetupRelayJoinOptions,
  ): Promise<string> {
    if (setupRelayJoinInFlight) return setupRelayJoinInFlight
    const flight = configureAndJoinRelayFromSetupInner(options)
    setupRelayJoinInFlight = flight
    try {
      return await flight
    } finally {
      if (setupRelayJoinInFlight === flight) {
        setupRelayJoinInFlight = null
      }
    }
  }

  async function joinRelayPairing(
    pairingCode: string,
    opts?: JoinRelayPairingOptions,
  ): Promise<void> {
    const normalized = pairingCode.replace(/\D/g, '')
    if (normalized.length !== 6) {
      throw new Error('Eşleştirme kodu 6 haneli olmalı.')
    }

    relayPairingLoading.value = true
    try {
      const profileStore = useProfileStore()
      const profile = profileStore.activeProfile
      const session = await getOrCreateRelaySession(false)
      if (!session) {
        throw new Error(relayStatusHint.value ?? 'Relay bağlantısı gerekli.')
      }

      if (profile && !hasRelayDeviceToken(profile.id)) {
        clearRelayDeviceToken(profile.id)
      }

      await session.joinPairing(normalized)

      activateRelaySession(session)
      relayEsrStatus.value = session.getStatus()
      if (profile) {
        await markRelayProfileConnected(profile.id)
      }
      await completeRelayJoinAfterPairing(session, {
        closeDrawer: !opts?.fromSetup,
      })
    } catch (error) {
      throw toRelayUserError(error)
    } finally {
      relayPairingLoading.value = false
    }
  }

  async function recoverRelayWithPhrase(recoveryPhrase: string): Promise<void> {
    const phrase = recoveryPhrase.trim()
    if (!phrase) {
      throw new Error('Recovery anahtarı gerekli.')
    }

    relayPairingLoading.value = true
    try {
      const session = await getOrCreateRelaySession(false)
      if (!session) {
        throw new Error(relayStatusHint.value ?? 'Relay bağlantısı gerekli.')
      }
      await session.recover(phrase)
      activateRelaySession(session)
      relayEsrStatus.value = session.getStatus()
      const profile = useProfileStore().activeProfile
      if (profile) {
        await markRelayProfileConnected(profile.id)
      }
      await runRelaySync(session)
      await saveConfig({ lastError: undefined })
      closeRelayPairingDrawer()
    } finally {
      relayPairingLoading.value = false
    }
  }

  function resolveRelayConflictChoice(choice: RelayConflictChoice): void {
    relayConflictGate.resolveChoice(choice)
    conflictModalOpen.value = false
    if (choice === 'cancel') {
      conflictPending.value = true
    }
  }

  async function relayPushOnly(): Promise<boolean> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !canAutoPush.value) return false
    if (!canPushWithCurrentPassword(profile.password.enabled)) return false

    if (!relaySession.value) {
      const connected = await ensureRelayConnection({ silent: true })
      if (!connected || !relaySession.value) return false
    }

    syncing.value = true
    try {
      if (relaySession.value) {
        cancelRelayDebouncedPush(relaySession.value)
      }
      await flushRelayPush(relaySession.value!)
      const now = new Date().toISOString()
      lastPushAt.value = now
      lastLocalMutationAt.value = null
      clearConflictState()
      pendingPush.value = false
      await saveConfig({ lastSyncAt: now, lastError: undefined })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Relay yazması başarısız.'
      reportRelayUserError(message, true)
      return false
    } finally {
      syncing.value = false
    }
  }

  async function relayPullOnly(): Promise<boolean> {
    if (!relaySession.value || relayEsrStatus.value === 'disabled' || relayEsrStatus.value === null) {
      const connected = await ensureRelayConnection({ silent: true })
      if (!connected || !relaySession.value) return false
    }

    syncing.value = true
    try {
      const result = await runRelaySync(relaySession.value)
      if (result.status === 'ok' && result.reloaded) {
        lastLocalMutationAt.value = null
        clearConflictState()
        await saveConfig({
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })
        return true
      }
      if (result.status === 'conflict') {
        return false
      }
      if (result.status === 'offline') {
        relayEsrStatus.value = 'offline'
        return false
      }
      if (result.status === 'error') {
        reportRelayUserError(result.error.message, true)
      }
      return false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Relay okuması başarısız.'
      reportRelayUserError(message, true)
      return false
    } finally {
      syncing.value = false
    }
  }

  function relayMarkLocalChange(): void {
    if (isApplyingRemote.value) return
    if (!canAutoPush.value) return

    pendingPush.value = true
    const session = relaySession.value
    const sessionDisabled =
      !session || relayEsrStatus.value === 'disabled' || relayEsrStatus.value === null
    if (sessionDisabled) {
      void ensureRelayConnection({ silent: true }).then((connected) => {
        if (connected && relaySession.value) {
          markRelayLocalChange(relaySession.value)
        }
      })
      return
    }
    markRelayLocalChange(session)
  }

  async function applyPushResult(profileId: string, revision: string, fileName: string): Promise<void> {
    const now = new Date().toISOString()
    lastPushAt.value = now
    lastLocalMutationAt.value = null
    clearConflictState()
    pendingPush.value = false

    const remoteRevisionByProfile = {
      ...config.value.remoteRevisionByProfile,
      [profileId]: revision,
    }

    await saveConfig({
      fileNameByProfile: {
        ...config.value.fileNameByProfile,
        [profileId]: fileName,
      },
      remoteRevisionByProfile,
      lastSyncAt: now,
      lastError: undefined,
    })
  }

  async function pushOnly(): Promise<boolean> {
    if (isRelayMode.value) {
      return relayPushOnly()
    }

    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked || !canAutoPush.value) return false
    if (profileMismatch.value) return false

    if (!canPushWithCurrentPassword(profile.password.enabled)) {
      return false
    }

    const handleCtx = await getHandleForActiveProfile()
    if (!handleCtx) return false
    const { stored } = handleCtx

    syncing.value = true
    try {
      const result = await runPushSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        deviceId: deviceId.value,
        config: config.value,
        filePassword: resolveAutoPushPassword(),
      })
      await applyPushResult(profile.id, result.revision, result.fileName)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Otomatik yazma başarısız.'
      await saveConfig({ lastError: message })
      return false
    } finally {
      syncing.value = false
    }
  }

  async function pullIfEnabled(): Promise<boolean> {
    if (isRelayMode.value) {
      return relayPullOnly()
    }

    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked || !canAutoPull.value) return false

    const handleCtx = await getHandleForActiveProfile()
    if (!handleCtx) return false
    const { stored } = handleCtx

    syncing.value = true
    try {
      const remote = await readSyncEnvelopeFromHandle(stored.handle)
      if (envelopeProfileMismatch(remote, profile.id)) {
        if (remote) {
          profileMismatch.value = {
            fileProfileId: remote.profileId,
            fileProfileName: remote.profileName,
          }
        }
        return false
      }

      const decision = decideAutoPull(
        remote,
        profile.id,
        config.value.remoteRevisionByProfile[profile.id],
        lastLocalMutationAt.value,
        lastPushAt.value ?? config.value.lastSyncAt,
      )

      if (decision === 'none') {
        conflictPending.value = false
        remoteUpdatePending.value = false
        return false
      }

      if (decision === 'conflict' && remote) {
        setConflictState(remote)
        return false
      }

      if (!canPushWithCurrentPassword(profile.password.enabled)) {
        remoteUpdatePending.value = true
        return false
      }

      const pulled = await runPullSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        config: config.value,
        filePassword: resolveAutoPushPassword(),
      })

      if (pulled && remote) {
        lastLocalMutationAt.value = null
        clearConflictState()
        await saveConfig({
          remoteRevisionByProfile: {
            ...config.value.remoteRevisionByProfile,
            [profile.id]: remote.revision,
          },
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })
      }
      return pulled
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Otomatik okuma başarısız.'
      await saveConfig({ lastError: message })
      return false
    } finally {
      syncing.value = false
    }
  }

  async function refreshHandleState(): Promise<void> {
    const profileId = activeProfileId()
    if (!profileId) {
      hasHandle.value = false
      return
    }

    if (isManualMode.value) {
      hasHandle.value = Boolean(syncFileNameForProfile(config.value, profileId))
      return
    }

    const stored = await getStoredSyncHandle(profileId)
    hasHandle.value = !!stored
    if (stored) {
      const known = config.value.fileNameByProfile?.[profileId]
      if (known !== stored.fileName) {
        await saveConfig({
          fileNameByProfile: {
            ...config.value.fileNameByProfile,
            [profileId]: stored.fileName,
          },
          lastError: undefined,
        })
      }
    }
  }

  function applyResolvedConfig(profileId: string | null = activeProfileId()): void {
    config.value = resolveSyncConfigForProfile(persistedSync.value, profileId)
    syncRelayStatusHintFromConfig()
  }

  async function onActiveProfileChanged(): Promise<void> {
    if (!loaded.value) return
    const profileId = activeProfileId()

    applyResolvedConfig(profileId)
    lastPushAt.value = config.value.lastSyncAt ?? null

    pendingPush.value = false
    lastLocalMutationAt.value = null
    clearProfileMismatch()
    clearConflictState()
    remoteUpdatePending.value = false
    manualRemoteEnvelope.value = null
    const recoveryForActiveProfile =
      relayRecoveryModalOpen.value &&
      profileId !== null &&
      relayPendingRecovery.value?.namespaceId === profileId
    if (!recoveryForActiveProfile) {
      relayPendingRecovery.value = null
      relayRecoveryModalOpen.value = false
    }

    const keepRelaySession =
      isRelayMode.value &&
      enabled.value &&
      profileId !== null &&
      relaySession.value !== null &&
      relayBoundProfileId.value === profileId &&
      relaySessionConfigKey.value === buildRelaySessionConfigKey(config.value)

    if (!keepRelaySession) {
      teardownRelaySession()
    }

    await refreshHandleState()
    if (isRelayMode.value && enabled.value && relaySettingsSaved.value) {
      await reconcileSyncEncryptForActiveProfile()
      await ensureRelayConnection({ silent: true })
    } else {
      if (relaySession.value) teardownRelaySession()
      await refreshProfileBinding()
    }
  }

  /** Yeni profil — o profile ait senkron kaydı yok; diğer profiller etkilenmez. */
  async function prepareNewProfileSync(profileId: string): Promise<void> {
    if (!loaded.value) await load()

    persistedSync.value = omitProfileSyncState(persistedSync.value, profileId)
    await clearStoredSyncHandle(profileId)

    pendingPush.value = false
    lastLocalMutationAt.value = null
    lastPushAt.value = null
    clearProfileMismatch()
    clearConflictState()
    remoteUpdatePending.value = false
    manualRemoteEnvelope.value = null
    relayPendingRecovery.value = null
    teardownRelaySession()
    clearSessionPassword()
    hasHandle.value = false

    applyResolvedConfig(profileId)
    await updateAppMeta({ sync: syncConfigForPersist(persistedSync.value) })
    await refreshHandleState()
  }

  async function load(): Promise<void> {
    const meta = await getAppMeta()
    deviceId.value = meta.deviceId ?? ''
    persistedSync.value = meta.sync
      ? normalizePersistedSyncConfig(meta.sync)
      : normalizePersistedSyncConfig(null)
    applyResolvedConfig(activeProfileId())
    loadSessionPassword()
    loaded.value = true
    const clearDeferredError =
      isRelayTransport(config.value) && isRelayDeferredSetupError(config.value.lastError)
    if (clearDeferredError) {
      await saveConfig({ lastError: undefined })
    } else {
      syncRelayStatusHintFromConfig()
    }
    applyEffectiveSyncMode()
    lastPushAt.value = config.value.lastSyncAt ?? null
    await persistEffectiveSyncMode()
    await refreshHandleState()
    if (!isRelayMode.value) {
      await refreshProfileBinding()
    }
    installRelayUnhandledRejectionHandler()
  }

  async function saveConfig(
    patch: Partial<SyncConfig>,
    opts?: SaveConfigOptions,
  ): Promise<void> {
    saving.value = true
    try {
      const profileId = activeProfileId()
      const base = config.value
      const resolvedBaseline = profileId ? pickProfileSyncPreferences(base) : undefined
      const nextPersisted = applySyncConfigPatch(
        persistedSync.value,
        profileId,
        patch,
        resolvedBaseline,
      )
      const next = resolveSyncConfigForProfile(nextPersisted, profileId)
      const relaySessionConfigChanged =
        buildRelaySessionConfigKey(base) !== buildRelaySessionConfigKey(next)
      const relayEndpointChanged =
        isRelayTransport(next) &&
        (next.relayUrl?.trim() !== base.relayUrl?.trim() ||
          (next.appId ?? '').trim() !== (base.appId ?? '').trim())
      const transportChanged = next.transport !== base.transport

      if ((relaySessionConfigChanged || relayEndpointChanged || transportChanged) && relaySession.value) {
        teardownRelaySession()
      }
      if (relaySessionConfigChanged && !next.encryptFile) {
        clearSessionPassword()
      }

      persistedSync.value = nextPersisted
      config.value = next
      loaded.value = true
      const updated = await updateAppMeta({ sync: syncConfigForPersist(nextPersisted) })
      deviceId.value = updated.deviceId ?? deviceId.value

      if (
        !opts?.skipRelayConnect &&
        relaySessionConfigChanged &&
        isRelayTransport(next) &&
        next.relayEndpointLocked === true &&
        next.enabled &&
        useProfileStore().unlocked
      ) {
        await ensureRelayConnection({ silent: true })
      }
    } finally {
      saving.value = false
    }
  }

  async function setEnabled(value: boolean): Promise<void> {
    if (!value) {
      clearSessionPassword()
      pendingPush.value = false
      clearProfileMismatch()
      clearConflictState()
      teardownRelaySession()
      await saveConfig({
        enabled: false,
        lastError: undefined,
      })
      return
    }
    await saveConfig({ enabled: true })
    await refreshHandleState()
    if (isRelayMode.value && relaySettingsSaved.value) {
      await ensureRelayConnection({ silent: true })
    } else {
      await refreshProfileBinding()
    }
  }

  async function pickFile(): Promise<void> {
    const profileId = activeProfileId()
    if (!profileId) throw new Error('Aktif profil yok.')
    const stored = await pickSyncFileHandle(profileId)
    hasHandle.value = true
    await saveConfig({
      fileNameByProfile: {
        ...config.value.fileNameByProfile,
        [profileId]: stored.fileName,
      },
      lastError: undefined,
    })
    await refreshProfileBinding()
  }

  async function createFile(): Promise<void> {
    const profileStore = useProfileStore()
    const profileId = activeProfileId()
    if (!profileId) throw new Error('Aktif profil yok.')
    const name = defaultSyncFileName(profileStore.activeProfile?.name ?? 'profil')
    const stored = await createSyncFileHandle(profileId, name)
    hasHandle.value = true
    clearProfileMismatch()
    await saveConfig({
      fileNameByProfile: {
        ...config.value.fileNameByProfile,
        [profileId]: stored.fileName,
      },
      lastError: undefined,
    })
  }

  async function readRemoteEnvelope(): Promise<SyncFileEnvelope | null> {
    if (isManualMode.value) {
      return manualRemoteEnvelope.value
    }
    const handleCtx = await getHandleForActiveProfile()
    if (!handleCtx) return null
    return readSyncEnvelopeFromHandle(handleCtx.stored.handle)
  }

  function needsPullConfirm(envelope: SyncFileEnvelope | null, profileId: string): boolean {
    if (!envelope) return false
    if (envelopeProfileMismatch(envelope, profileId)) return false
    return remoteRevisionChanged(
      envelope,
      profileId,
      config.value.remoteRevisionByProfile[profileId],
    )
  }

  async function runManualSyncAction(options: ManualSyncActionOptions): Promise<{ pulled: boolean }> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    if (options.passwordConfig) {
      const patch = options.passwordConfig
      if (
        patch.encryptFile !== config.value.encryptFile ||
        patch.useProfilePassword !== config.value.useProfilePassword
      ) {
        await saveConfig(patch, { skipRelayConnect: true })
      }
    }

    const effectiveConfig = options.passwordConfig
      ? { ...config.value, ...options.passwordConfig }
      : config.value

    const syncPassword = resolveSyncPasswordForAction(
      options.filePassword,
      options.passwordConfig,
    )
    const pwdError = resolveSyncFilePasswordError(
      effectiveConfig,
      profile.password.enabled,
      syncPassword,
    )
    if (pwdError) throw new Error(pwdError)

    if (isRelayMode.value) {
      syncing.value = true
      try {
        if (!relaySession.value) {
          const connected = await ensureRelayConnection()
          if (!connected || !relaySession.value) {
            throw new Error(relayStatusHint.value ?? 'Relay bağlantısı kurulamadı.')
          }
        }

        const result = await runRelayManualSync(relaySession.value, {
          pullAfterPush: options.pullRemote || remoteUpdatePending.value,
        })
        if (result.status === 'error') {
          throw new Error(relayErrorMessageFromUnknown(result.error))
        }
        if (result.status === 'conflict') {
          throw new Error('Uzak veri ile çakışma var; «Çakışmayı çöz» ile seçim yapın.')
        }

        const pulled = result.status === 'ok' && result.reloaded
        const now = new Date().toISOString()
        lastPushAt.value = now
        if (pulled) {
          lastLocalMutationAt.value = null
          bumpPullRevision('manual-relay')
        } else {
          lastLocalMutationAt.value = null
        }
        pendingPush.value = false
        clearConflictState()
        await saveConfig({ lastSyncAt: now, lastError: undefined })
        return { pulled }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Senkron başarısız.'
        if (!relayStatusHint.value) {
          reportRelayUserError(message)
        }
        throw error
      } finally {
        syncing.value = false
      }
    }

    if (profileMismatch.value) {
      throw new Error('Önce senkron dosyasını bu profile bağlayın.')
    }

    syncing.value = true
    try {
      if (isManualMode.value) {
        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModeSync({
          profile,
          dataKey: profileStore.encryptionKey,
          deviceId: deviceId.value,
          config: config.value,
          fileName,
          filePassword: syncPassword,
          remoteEnvelope: manualRemoteEnvelope.value,
          pullRemote: options.pullRemote,
        })

        const remoteRevisionByProfile = {
          ...config.value.remoteRevisionByProfile,
          [profile.id]: result.revision,
        }

        await saveConfig({
          fileNameByProfile: {
            ...config.value.fileNameByProfile,
            [profile.id]: result.fileName,
          },
          remoteRevisionByProfile,
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })

        const now = new Date().toISOString()
        lastPushAt.value = now
        hasHandle.value = true
        if (result.pulled) {
          lastLocalMutationAt.value = null
          bumpPullRevision('manual')
        }
        clearConflictState()
        return { pulled: result.pulled }
      }

      const handleCtx = await getHandleForActiveProfile()
      if (!handleCtx) {
        throw new Error('Önce senkron dosyası seçin veya oluşturun.')
      }
      const { stored } = handleCtx

      const result = await runManualSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        deviceId: deviceId.value,
        config: config.value,
        filePassword: syncPassword,
        pullRemote: options.pullRemote,
      })

      const remoteRevisionByProfile = {
        ...config.value.remoteRevisionByProfile,
        [profile.id]: result.revision,
      }

      await saveConfig({
        fileNameByProfile: {
          ...config.value.fileNameByProfile,
          [profile.id]: result.fileName,
        },
        remoteRevisionByProfile,
        lastSyncAt: new Date().toISOString(),
        lastError: undefined,
      })

      const now = new Date().toISOString()
      lastPushAt.value = now
      if (result.pulled) {
        lastLocalMutationAt.value = null
        bumpPullRevision('manual')
      }
      clearConflictState()

      return { pulled: result.pulled }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Senkron başarısız.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  async function pullFromManualFile(
    file: File,
    filePassword?: string,
  ): Promise<{ pulled: boolean; envelope: SyncFileEnvelope | null }> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    syncing.value = true
    try {
      const envelope = await ingestManualFile(file)
      if (envelopeProfileMismatch(envelope, profile.id) && envelope) {
        profileMismatch.value = {
          fileProfileId: envelope.profileId,
          fileProfileName: envelope.profileName,
        }
        return { pulled: false, envelope }
      }

      const decision = decideAutoPull(
        envelope,
        profile.id,
        config.value.remoteRevisionByProfile[profile.id],
        lastLocalMutationAt.value,
        lastPushAt.value ?? config.value.lastSyncAt,
      )

      if (decision === 'conflict' && envelope) {
        setConflictState(envelope)
        return { pulled: false, envelope }
      }

      if (!envelope || decision === 'none') {
        clearConflictState()
        remoteUpdatePending.value = false
        return { pulled: false, envelope }
      }

      const pulled = await runManualModePull({
        envelope,
        profile,
        dataKey: profileStore.encryptionKey,
        config: config.value,
        filePassword,
      })

      if (pulled) {
        lastLocalMutationAt.value = null
        clearConflictState()
        await saveConfig({
          remoteRevisionByProfile: {
            ...config.value.remoteRevisionByProfile,
            [profile.id]: envelope.revision,
          },
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })
        bumpPullRevision('manual-file')
      }

      return { pulled, envelope }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dosya okunamadı.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  async function downloadManualPush(filePassword?: string): Promise<void> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    syncing.value = true
    try {
      const fileName = syncFileNameForActiveProfile()
      const result = await runManualModePush({
        profile,
        dataKey: profileStore.encryptionKey,
        deviceId: deviceId.value,
        config: config.value,
        fileName,
        filePassword,
      })
      await applyPushResult(profile.id, result.revision, result.fileName)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dosya indirilemedi.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  async function adoptSyncFileForCurrentProfile(filePassword?: string): Promise<void> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    syncing.value = true
    try {
      if (isManualMode.value) {
        const remote = manualRemoteEnvelope.value
        if (!remote) throw new Error('Önce senkron dosyasını seçin.')

        await runPullFromEnvelope({
          envelope: remote,
          profile,
          dataKey: profileStore.encryptionKey,
          filePassword,
          allowProfileAdopt: true,
        })

        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModePush({
          profile,
          dataKey: profileStore.encryptionKey,
          deviceId: deviceId.value,
          config: config.value,
          fileName,
          filePassword,
        })

        await applyPushResult(profile.id, result.revision, result.fileName)
        clearProfileMismatch()
        bumpPullRevision('adopt')
        return
      }

      const handleCtx = await getHandleForActiveProfile()
      if (!handleCtx) throw new Error('Senkron dosyası bulunamadı.')
      const { stored } = handleCtx

      await runPullSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        config: config.value,
        filePassword,
        allowProfileAdopt: true,
      })

      const result = await runPushSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        deviceId: deviceId.value,
        config: config.value,
        filePassword,
      })

      await applyPushResult(profile.id, result.revision, result.fileName)
      clearProfileMismatch()
      bumpPullRevision('adopt')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dosya bu profile bağlanamadı.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  async function resolveConflictUseRemote(filePassword?: string): Promise<void> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    if (relayConflictGate.hasPending()) {
      resolveRelayConflictChoice('remote')
      return
    }

    if (isRelayMode.value && relaySession.value) {
      syncing.value = true
      try {
        await relaySession.value.resolveConflict('remote')
        const result = await runRelaySync(relaySession.value)
        if (result.reloaded) {
          lastLocalMutationAt.value = null
          bumpPullRevision('conflict-remote-relay')
        }
        clearConflictState()
        await saveConfig({
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Uzak sürüm uygulanamadı.'
        reportRelayUserError(message)
        throw error
      } finally {
        syncing.value = false
      }
    }

    syncing.value = true
    try {
      if (isManualMode.value) {
        const remote = manualRemoteEnvelope.value
        if (!remote || envelopeProfileMismatch(remote, profile.id)) {
          throw new Error('Senkron dosyası okunamadı veya profile uymuyor.')
        }

        await runPullFromEnvelope({
          envelope: remote,
          profile,
          dataKey: profileStore.encryptionKey,
          filePassword,
        })

        lastLocalMutationAt.value = null
        lastPushAt.value = new Date().toISOString()
        clearConflictState()

        await saveConfig({
          remoteRevisionByProfile: {
            ...config.value.remoteRevisionByProfile,
            [profile.id]: remote.revision,
          },
          lastSyncAt: new Date().toISOString(),
          lastError: undefined,
        })
        bumpPullRevision('conflict-remote')
        return
      }

      const handleCtx = await getHandleForActiveProfile()
      if (!handleCtx) throw new Error('Senkron dosyası bulunamadı.')
      const { stored } = handleCtx

      const remote = await readSyncEnvelopeFromHandle(stored.handle)
      if (!remote || envelopeProfileMismatch(remote, profile.id)) {
        throw new Error('Senkron dosyası okunamadı veya profile uymuyor.')
      }

      await runPullSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        config: config.value,
        filePassword,
      })

      lastLocalMutationAt.value = null
      lastPushAt.value = new Date().toISOString()
      clearConflictState()

      await saveConfig({
        remoteRevisionByProfile: {
          ...config.value.remoteRevisionByProfile,
          [profile.id]: remote.revision,
        },
        lastSyncAt: new Date().toISOString(),
        lastError: undefined,
      })
      bumpPullRevision('conflict-remote')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uzak sürüm uygulanamadı.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  async function resolveConflictKeepLocal(filePassword?: string): Promise<void> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    if (relayConflictGate.hasPending()) {
      resolveRelayConflictChoice('local')
      return
    }

    if (isRelayMode.value && relaySession.value) {
      syncing.value = true
      try {
        await relaySession.value.resolveConflict('local')
        await flushRelayPush(relaySession.value)
        const now = new Date().toISOString()
        lastPushAt.value = now
        clearConflictState()
        await saveConfig({ lastSyncAt: now, lastError: undefined })
        conflictModalOpen.value = false
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Yerel sürüm gönderilemedi.'
        reportRelayUserError(message)
        throw error
      } finally {
        syncing.value = false
      }
    }

    syncing.value = true
    try {
      if (isManualMode.value) {
        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModePush({
          profile,
          dataKey: profileStore.encryptionKey,
          deviceId: deviceId.value,
          config: config.value,
          fileName,
          filePassword,
        })
        await applyPushResult(profile.id, result.revision, result.fileName)
        conflictModalOpen.value = false
        return
      }

      const handleCtx = await getHandleForActiveProfile()
      if (!handleCtx) throw new Error('Senkron dosyası bulunamadı.')
      const { stored } = handleCtx

      const result = await runPushSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.encryptionKey,
        deviceId: deviceId.value,
        config: config.value,
        filePassword,
      })
      await applyPushResult(profile.id, result.revision, result.fileName)
      conflictModalOpen.value = false
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Yerel sürüm gönderilemedi.'
      await saveConfig({ lastError: message })
      throw error
    } finally {
      syncing.value = false
    }
  }

  installRelayUnhandledRejectionHandler()

  return {
    deviceId,
    config,
    loaded,
    saving,
    syncing,
    isApplyingRemote,
    hasHandle,
    pendingPush,
    profileMismatch,
    conflictPending,
    conflictContext,
    conflictModalOpen,
    remoteUpdatePending,
    activeFileName,
    enabled,
    isRelayMode,
    relaySettingsSaved,
    syncTransportReady,
    relayEsrStatus,
    relayConnecting,
    relayStatusHint,
    relayUserErrorMessage,
    relayPendingRecovery,
    relayRecoveryModalOpen,
    relayPairingDrawerOpen,
    relayPairingMode,
    relayPairingHost,
    relayPairingLoading,
    relayDevices,
    relayDevicesLoading,
    relayDeviceLimitContext,
    relayUnlockModalOpen,
    filePickerSupported,
    isManualMode,
    canAutoPush,
    canAutoPull,
    runtimeStatus,
    load,
    prepareNewProfileSync,
    onProfileDeleted,
    saveConfig,
    setEnabled,
    pickFile,
    createFile,
    readRemoteEnvelope,
    needsPullConfirm,
    runManualSync: runManualSyncAction,
    pullFromManualFile,
    downloadManualPush,
    ingestManualFile,
    manualRemoteEnvelope,
    markLocalMutation,
    setPendingPush,
    rememberSessionPassword,
    getSyncPasswordRequirementError,
    pullRevision,
    bootstrapDone,
    bumpPullRevision,
    ensureBootstrapPull,
    pushOnly,
    pullIfEnabled,
    refreshProfileBinding,
    onActiveProfileChanged,
    ensureRelayConnection,
    ensureRelayBootReconnect,
    openRelayPairingDrawer,
    closeRelayPairingDrawer,
    acknowledgeRecoveryPhrase,
    startRelayPairingHost,
    configureAndJoinRelayFromSetup,
    joinRelayPairing,
    recoverRelayWithPhrase,
    refreshRelayDevices,
    revokeRelayDevice,
    redeemRelayUnlockCode,
    dismissRelayDeviceLimitAlert,
    relayMarkLocalChange,
    adoptSyncFileForCurrentProfile,
    openConflictModal,
    resolveConflictUseRemote,
    resolveConflictKeepLocal,
  }
})
