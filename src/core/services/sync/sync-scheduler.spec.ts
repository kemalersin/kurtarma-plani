import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cancelPendingSyncPush,
  initSyncScheduler,
  notifySyncLocalChange,
  SYNC_PUSH_DEBOUNCE_MS,
} from '@/core/services/sync/sync-scheduler'
import { useSyncStore } from '@/stores/sync'

describe('sync-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    cancelPendingSyncPush()
    vi.useRealTimers()
  })

  it('cancelPendingSyncPush bekleyen debounce yazmasını iptal eder', async () => {
    const sync = useSyncStore()
    sync.loaded = true
    sync.config = { ...sync.config, enabled: true, autoPush: true, transport: 'file' as const }
    vi.spyOn(sync, 'pushOnly').mockResolvedValue(true)

    notifySyncLocalChange()
    cancelPendingSyncPush()
    await vi.advanceTimersByTimeAsync(SYNC_PUSH_DEBOUNCE_MS + 100)

    expect(sync.pushOnly).not.toHaveBeenCalled()
  })

  it('syncing sırasında notifySyncLocalChange yok sayılır', () => {
    const sync = useSyncStore()
    sync.loaded = true
    sync.syncing = true
    sync.config = { ...sync.config, enabled: true, autoPush: true }
    const markSpy = vi.spyOn(sync, 'markLocalMutation')

    notifySyncLocalChange()

    expect(markSpy).not.toHaveBeenCalled()
  })

  it('relay modunda focus ve interval pull tetiklenmez', async () => {
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })

    const sync = useSyncStore()
    sync.loaded = true
    sync.config = {
      ...sync.config,
      enabled: true,
      transport: 'relay',
      relayUrl: 'https://sync.example.com/v1',
      appId: 'esr_app_test',
    }
    const pullSpy = vi.spyOn(sync, 'pullIfEnabled').mockResolvedValue(false)

    const stop = initSyncScheduler()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(45_000 + 100)

    expect(pullSpy).not.toHaveBeenCalled()
    stop()
  })
})
