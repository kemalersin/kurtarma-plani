import { useSyncStore } from '@/stores/sync'

export const SYNC_PUSH_DEBOUNCE_MS = 2000
/** Açık sekmede uzak dosya değişikliği kontrolü (iCloud gecikmesi için). */
export const SYNC_PULL_INTERVAL_MS = 45_000

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pullIntervalId: ReturnType<typeof setInterval> | null = null
let schedulerStarted = false

function clearDebounceTimer(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

/** Uzak import sonrası bekleyen otomatik yazmayı iptal eder. */
export function cancelPendingSyncPush(): void {
  clearDebounceTimer()
}

function scheduleDebouncedPush(): void {
  clearDebounceTimer()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void flushSyncPushNow()
  }, SYNC_PUSH_DEBOUNCE_MS)
}

/** Entity kayıt/silme sonrası debounced push kuyruğu. */
export function notifySyncLocalChange(): void {
  const sync = useSyncStore()
  if (sync.isApplyingRemote || sync.syncing) return

  sync.markLocalMutation()
  if (!sync.canAutoPush) return

  if (sync.isRelayMode) {
    sync.relayMarkLocalChange()
    scheduleDebouncedPush()
    return
  }

  sync.setPendingPush(true)
  scheduleDebouncedPush()
}

/** Bekleyen debounce'u atlayıp anında push (profil kilidi vb.). */
export async function flushSyncPushNow(): Promise<void> {
  cancelPendingSyncPush()
  const sync = useSyncStore()
  sync.setPendingPush(false)
  if (!sync.canAutoPush) return
  await sync.pushOnly()
}

/** Profil açıldıktan sonra handle durumunu güncelle (pull router bootstrap'ta). */
export async function onProfileUnlocked(): Promise<void> {
  const sync = useSyncStore()
  if (!sync.loaded) await sync.load()
  await sync.onActiveProfileChanged()
}

/** Relay modunda uzak güncelleme SDK WS/poll ile; dosyada focus/zamanlayıcı. */
function shouldSchedulePollPull(): boolean {
  return !useSyncStore().isRelayMode
}

async function pullIfStale(reason: 'bootstrap' | 'focus' | 'visibility' | 'interval'): Promise<void> {
  const sync = useSyncStore()
  if (!sync.canAutoPull || sync.profileMismatch) return
  const pulled = await sync.pullIfEnabled()
  if (pulled) sync.bumpPullRevision(reason)
}

/** İlk sayfa yüklemesinde entity'lerden önce uzak pull. */
export async function ensureSyncBootstrap(): Promise<void> {
  const sync = useSyncStore()
  await sync.ensureBootstrapPull()
}

async function pullOnVisibility(): Promise<void> {
  if (document.visibilityState === 'hidden') {
    const sync = useSyncStore()
    if (sync.isRelayMode && sync.canAutoPush && sync.pendingPush) {
      await flushSyncPushNow()
    }
    return
  }
  if (!shouldSchedulePollPull()) return
  await pullIfStale('visibility')
}

async function pullOnFocus(): Promise<void> {
  if (!shouldSchedulePollPull()) return
  await pullIfStale('focus')
}

async function pullOnInterval(): Promise<void> {
  if (!shouldSchedulePollPull()) return
  if (document.visibilityState !== 'visible') return
  await pullIfStale('interval')
}

/** visibilitychange dinleyicisi; App mount'ta bir kez çağrılır. */
export function initSyncScheduler(): () => void {
  if (schedulerStarted) {
    return () => {}
  }
  schedulerStarted = true

  const onVisibility = (): void => {
    void pullOnVisibility()
  }
  const onFocus = (): void => {
    void pullOnFocus()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', onFocus)
  pullIntervalId = setInterval(() => {
    void pullOnInterval()
  }, SYNC_PULL_INTERVAL_MS)

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('focus', onFocus)
    if (pullIntervalId) {
      clearInterval(pullIntervalId)
      pullIntervalId = null
    }
    clearDebounceTimer()
    schedulerStarted = false
  }
}
