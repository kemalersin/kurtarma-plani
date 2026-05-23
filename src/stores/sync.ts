import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getAppMeta, updateAppMeta } from '@/core/db/meta'
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
import { decideAutoPull, buildConflictContext, type SyncConflictContext } from '@/core/services/sync/sync-conflict'
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
import type { SyncFileEnvelope } from '@/core/types/sync'
import {
  createDefaultSyncConfig,
  normalizeSyncConfig,
  syncFileNameForProfile,
  type SyncConfig,
} from '@/core/types/sync'
import { useProfileStore } from '@/stores/profile'
import type { StoredSyncHandle } from '@/core/services/sync/sync-handle-store'

export type SyncRuntimeStatus =
  | 'disabled'
  | 'idle'
  | 'pending_file'
  | 'pending_push'
  | 'remote_pending'
  | 'profile_mismatch'
  | 'conflict'
  | 'error'

const SESSION_PWD_KEY = 'kp-sync-session-pwd'

export interface SyncProfileMismatchInfo {
  fileProfileId: string
  fileProfileName: string
}

export const useSyncStore = defineStore('sync', () => {
  const deviceId = ref('')
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
        await onActiveProfileChanged()
        if (enabled.value && hasHandle.value && !profileMismatch.value) {
          const profileStore = useProfileStore()
          if (profileStore.unlocked) {
            const pulled = await pullIfEnabled()
            if (pulled) bumpPullRevision('bootstrap')
          }
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
  const filePickerSupported = computed(() => supportsSyncFilePicker())
  const isManualMode = computed(() => config.value.syncMode === 'manual')

  const canAutoPush = computed(() => {
    if (!enabled.value || !config.value.autoPush || !hasHandle.value) return false
    if (isManualMode.value || !filePickerSupported.value || syncing.value) return false
    const profileStore = useProfileStore()
    return profileStore.unlocked && Boolean(profileStore.activeProfileId)
  })

  const canAutoPull = computed(() => {
    if (!enabled.value || !hasHandle.value) return false
    if (isManualMode.value || !filePickerSupported.value || syncing.value) return false
    const profileStore = useProfileStore()
    return profileStore.unlocked && Boolean(profileStore.activeProfileId)
  })

  const remoteUpdatePending = ref(false)

  const runtimeStatus = computed<SyncRuntimeStatus>(() => {
    if (!config.value.enabled) return 'disabled'
    if (profileMismatch.value) return 'profile_mismatch'
    if (config.value.lastError) return 'error'
    if (!hasHandle.value) return 'pending_file'
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
    const meta = await getAppMeta()
    const persisted = meta.sync ? normalizeSyncConfig(meta.sync) : createDefaultSyncConfig()
    if (persisted.syncMode !== effective) {
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
    if (!config.value.encryptFile) return true
    const pwd = resolveAutoPushPassword()
    const err = resolveSyncFilePasswordError(config.value, profileHasPassword, pwd)
    return !err
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
        dataKey: profileStore.dataKey,
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
        dataKey: profileStore.dataKey,
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

  async function onActiveProfileChanged(): Promise<void> {
    if (!loaded.value) return
    pendingPush.value = false
    lastLocalMutationAt.value = null
    lastPushAt.value = null
    clearProfileMismatch()
    clearConflictState()
    remoteUpdatePending.value = false
    manualRemoteEnvelope.value = null
    await refreshHandleState()
    await refreshProfileBinding()
  }

  async function load(): Promise<void> {
    const meta = await getAppMeta()
    deviceId.value = meta.deviceId ?? ''
    config.value = meta.sync ? normalizeSyncConfig(meta.sync) : createDefaultSyncConfig()
    applyEffectiveSyncMode()
    lastPushAt.value = config.value.lastSyncAt ?? null
    loadSessionPassword()
    loaded.value = true
    await persistEffectiveSyncMode()
    await refreshHandleState()
    await refreshProfileBinding()
  }

  async function saveConfig(patch: Partial<SyncConfig>): Promise<void> {
    saving.value = true
    try {
      const meta = await getAppMeta()
      const persisted = meta.sync ? normalizeSyncConfig(meta.sync) : createDefaultSyncConfig()
      const base = loaded.value ? config.value : persisted
      const next = normalizeSyncConfig({ ...base, ...patch })
      config.value = next
      loaded.value = true
      const updated = await updateAppMeta({ sync: next })
      deviceId.value = updated.deviceId ?? deviceId.value
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
      await saveConfig({
        enabled: false,
        lastError: undefined,
      })
      return
    }
    await saveConfig({ enabled: true })
    await refreshHandleState()
    await refreshProfileBinding()
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

  async function runManualSyncAction(options: {
    filePassword?: string
    pullRemote: boolean
  }): Promise<{ pulled: boolean }> {
    const profileStore = useProfileStore()
    const profile = profileStore.activeProfile
    if (!profile || !profileStore.unlocked) {
      throw new Error('Senkron için oturum açık bir profil gerekli.')
    }

    const pwdError = resolveSyncFilePasswordError(
      config.value,
      profile.password.enabled,
      options.filePassword,
    )
    if (pwdError) throw new Error(pwdError)

    if (profileMismatch.value) {
      throw new Error('Önce senkron dosyasını bu profile bağlayın.')
    }

    syncing.value = true
    try {
      if (isManualMode.value) {
        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModeSync({
          profile,
          dataKey: profileStore.dataKey,
          deviceId: deviceId.value,
          config: config.value,
          fileName,
          filePassword: options.filePassword,
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
        dataKey: profileStore.dataKey,
        deviceId: deviceId.value,
        config: config.value,
        filePassword: options.filePassword,
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
        dataKey: profileStore.dataKey,
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
        dataKey: profileStore.dataKey,
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
          dataKey: profileStore.dataKey,
          filePassword,
          allowProfileAdopt: true,
        })

        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModePush({
          profile,
          dataKey: profileStore.dataKey,
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
        dataKey: profileStore.dataKey,
        config: config.value,
        filePassword,
        allowProfileAdopt: true,
      })

      const result = await runPushSync({
        handle: stored.handle,
        profile,
        dataKey: profileStore.dataKey,
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
          dataKey: profileStore.dataKey,
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
        dataKey: profileStore.dataKey,
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

    syncing.value = true
    try {
      if (isManualMode.value) {
        const fileName = syncFileNameForActiveProfile()
        const result = await runManualModePush({
          profile,
          dataKey: profileStore.dataKey,
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
        dataKey: profileStore.dataKey,
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

  return {
    deviceId,
    config,
    loaded,
    saving,
    syncing,
    hasHandle,
    pendingPush,
    profileMismatch,
    conflictPending,
    conflictContext,
    conflictModalOpen,
    remoteUpdatePending,
    activeFileName,
    enabled,
    filePickerSupported,
    isManualMode,
    canAutoPush,
    canAutoPull,
    runtimeStatus,
    load,
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
    pullRevision,
    bootstrapDone,
    bumpPullRevision,
    ensureBootstrapPull,
    pushOnly,
    pullIfEnabled,
    refreshProfileBinding,
    onActiveProfileChanged,
    adoptSyncFileForCurrentProfile,
    openConflictModal,
    resolveConflictUseRemote,
    resolveConflictKeepLocal,
  }
})
