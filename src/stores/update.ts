import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { APP_VERSION } from '@/core/constants'
import { getAppMeta, updateAppMeta } from '@/core/db/meta'
import {
  fetchRemoteAppVersion,
  isUpdateAvailable,
  remoteUpdateFingerprint,
  type RemoteVersionInfo,
} from '@/core/services/update-check'
import {
  createDefaultUpdateCheckConfig,
  normalizeUpdateCheckConfig,
  type UpdateCheckConfig,
} from '@/core/types/update-check'

export type UpdateCheckOutcome =
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | { status: 'update'; dismissed: boolean }
  | { status: 'current' }

export const useUpdateStore = defineStore('update', () => {
  const config = ref<UpdateCheckConfig>(createDefaultUpdateCheckConfig())
  const loaded = ref(false)
  const checking = ref(false)
  const hasRemoteUpdate = ref(false)
  const remoteVersion = ref<string | null>(null)
  const releaseUrl = ref<string | null>(null)
  const lastError = ref<string | null>(null)

  const enabled = computed(() => config.value.enabled)

  const showNotice = computed(() => hasRemoteUpdate.value && !isRemoteDismissed())

  /** @deprecated showNotice kullanın */
  const updateAvailable = computed(() => showNotice.value)

  function isRemoteDismissed(remote?: Pick<RemoteVersionInfo, 'version'>): boolean {
    const version = remote?.version ?? remoteVersion.value
    if (!version) return false
    const key = remoteUpdateFingerprint(version)
    if (config.value.dismissedRemoteKey === key) return true
    return config.value.dismissedVersion === version && !config.value.dismissedRemoteKey
  }

  async function load(): Promise<void> {
    const meta = await getAppMeta()
    config.value = normalizeUpdateCheckConfig(meta.updateCheck)
    loaded.value = true
  }

  async function saveConfig(patch: Partial<UpdateCheckConfig>): Promise<void> {
    const next = { ...config.value, ...patch }
    config.value = next
    await updateAppMeta({ updateCheck: next })
  }

  async function setEnabled(value: boolean): Promise<void> {
    await saveConfig({ enabled: value })
    if (!value) {
      hasRemoteUpdate.value = false
      remoteVersion.value = null
      releaseUrl.value = null
      lastError.value = null
    }
  }

  async function dismissNotice(): Promise<void> {
    if (!remoteVersion.value) return
    await saveConfig({
      dismissedRemoteKey: remoteUpdateFingerprint(remoteVersion.value),
      dismissedVersion: remoteVersion.value,
    })
  }

  async function checkForUpdates(options?: { force?: boolean }): Promise<UpdateCheckOutcome> {
    if (!loaded.value) await load()
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { status: 'offline' }
    }
    if (!config.value.enabled && !options?.force) {
      return { status: 'current' }
    }
    if (checking.value) {
      if (hasRemoteUpdate.value) {
        return { status: 'update', dismissed: isRemoteDismissed() }
      }
      return { status: 'current' }
    }

    checking.value = true
    lastError.value = null
    try {
      const remote = await fetchRemoteAppVersion()
      remoteVersion.value = remote.version
      releaseUrl.value = remote.releaseUrl

      hasRemoteUpdate.value = isUpdateAvailable(APP_VERSION, remote.version)

      await saveConfig({
        lastCheckedAt: new Date().toISOString(),
        lastRemoteVersion: remote.version,
      })

      if (hasRemoteUpdate.value) {
        if (options?.force) {
          await saveConfig({
            dismissedRemoteKey: undefined,
            dismissedVersion: undefined,
          })
          return { status: 'update', dismissed: false }
        }
        return { status: 'update', dismissed: isRemoteDismissed(remote) }
      }
      return { status: 'current' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sürüm kontrolü başarısız.'
      lastError.value = message
      return { status: 'error', message }
    } finally {
      checking.value = false
    }
  }

  async function checkOnLaunch(): Promise<void> {
    if (!loaded.value) await load()
    if (!config.value.enabled) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    await checkForUpdates()
  }

  return {
    config,
    loaded,
    checking,
    enabled,
    hasRemoteUpdate,
    updateAvailable,
    showNotice,
    remoteVersion,
    releaseUrl,
    lastError,
    load,
    saveConfig,
    setEnabled,
    dismissNotice,
    checkForUpdates,
    checkOnLaunch,
  }
})
