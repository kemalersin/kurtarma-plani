import type { SyncRunResult } from '@senkronla/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import { createDefaultSyncConfig } from '@/core/types/sync'
import type { ProfileMeta } from '@/core/types/profile'

const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440000'

const mockProfile: ProfileMeta = {
  id: PROFILE_ID,
  name: 'Ev',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  localeSettings: { ...DEFAULT_LOCALE_SETTINGS },
  password: { enabled: false },
}

const mockAdapter = {
  namespaceId: () => PROFILE_ID,
  namespaceLabel: () => 'Ev',
  contentType: () => 'application/vnd.kurtarma-plani.snapshot+json',
  buildDocument: vi.fn(),
  importDocument: vi.fn(),
  encryption: () => ({ enabled: true, resolvePassword: async () => 'pw' }),
}

const connectMock = vi.fn()
const createLocalStorageAdapterMock = vi.fn(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}))

const createKpDocumentAdapterMock = vi.fn((_ctx?: unknown) => mockAdapter)
const reloadStoresAfterSyncPullMock = vi.fn()

vi.mock('@senkronla/client', () => ({
  EsrSync: { connect: (...args: unknown[]) => connectMock(...args) },
  createLocalStorageAdapter: () => createLocalStorageAdapterMock(),
}))

vi.mock('@/core/services/sync/kp-document-adapter', () => ({
  createKpDocumentAdapter: (args: unknown) => createKpDocumentAdapterMock(args),
  pickKpSyncSnapshotOptions: (config: { includeSensitive: boolean; includeSecrets: boolean }) => ({
    includeSensitive: config.includeSensitive,
    includeSecrets: config.includeSecrets,
  }),
}))

vi.mock('@/core/services/sync/sync-file', () => ({
  reloadStoresAfterSyncPull: () => reloadStoresAfterSyncPullMock(),
}))

import {
  activateRelaySession,
  connectRelaySession,
  createRelayPasswordResolver,
  destroyRelaySession,
  disconnectRelaySession,
  ensureRelayNamespace,
  flushRelayPush,
  markRelayLocalChange,
  cancelRelayDebouncedPush,
  notifyRelayLocalChange,
  runRelaySync,
  runRelayManualSync,
  validateRelayConfig,
} from '@/core/services/sync/relay-session'

function relayConfig() {
  return {
    ...createDefaultSyncConfig(),
    transport: 'relay' as const,
    relayUrl: 'https://sync.example.com/v1',
    appId: 'esr_app_test',
  }
}

function mockSession() {
  return {
    ensureNamespace: vi.fn(async () => ({ namespaceId: PROFILE_ID, created: false })),
    sync: vi.fn(async (): Promise<SyncRunResult> => ({ status: 'ok' })),
    notifyLocalChange: vi.fn(),
    markLocalChange: vi.fn(),
    cancelDebouncedPush: vi.fn(),
    flushPush: vi.fn(async () => {}),
    enable: vi.fn(),
    disable: vi.fn(),
    destroy: vi.fn(),
    getStatus: vi.fn(() => 'idle' as const),
  }
}

describe('validateRelayConfig', () => {
  it('geçerli relay yapılandırmasını kabul eder', () => {
    expect(validateRelayConfig(relayConfig())).toEqual({
      ok: true,
      relayUrl: 'https://sync.example.com/v1',
    })
  })

  it('file transport reddeder', () => {
    const result = validateRelayConfig(createDefaultSyncConfig())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/relay değil/)
  })

  it('eksik relayUrl reddeder', () => {
    const config = { ...relayConfig(), relayUrl: undefined }
    const result = validateRelayConfig(config)
    expect(result.ok).toBe(false)
  })
})

describe('createRelayPasswordResolver', () => {
  it('encryptFile kapalıyken undefined döner', async () => {
    const resolve = createRelayPasswordResolver({ encryptFile: false }, () => 'secret')
    await expect(resolve()).resolves.toBeUndefined()
  })

  it('encryptFile açıkken parola döner', async () => {
    const resolve = createRelayPasswordResolver({ encryptFile: true }, () => '  sync-pw  ')
    await expect(resolve()).resolves.toBe('sync-pw')
  })
})

describe('connectRelaySession', () => {
  beforeEach(() => {
    connectMock.mockReset()
    createKpDocumentAdapterMock.mockClear()
    createLocalStorageAdapterMock.mockClear()
    connectMock.mockResolvedValue(mockSession())
  })

  it('EsrSync.connect doğru seçeneklerle çağrılır', async () => {
    const onRecoveryPhrase = vi.fn()
    const onConflict = vi.fn(async () => 'local' as const)
    const resolveSyncPassword = vi.fn(async () => 'pw')

    await connectRelaySession({
      profile: mockProfile,
      dataKey: null,
      config: relayConfig(),
      resolveSyncPassword,
      callbacks: { onRecoveryPhrase, onConflict },
      storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    })

    expect(createKpDocumentAdapterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: mockProfile,
        encrypt: false,
        resolveSyncPassword,
      }),
    )

    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        relayUrl: 'https://sync.example.com/v1',
        appId: 'esr_app_test',
        document: mockAdapter,
        pushDebounceMs: 2000,
        enabled: false,
        fetch: undefined,
        onRecoveryPhrase,
        onConflict,
      }),
    )
    expect(createLocalStorageAdapterMock).not.toHaveBeenCalled()
  })

  it('geçersiz config ile hata fırlatır', async () => {
    await expect(
      connectRelaySession({
        profile: mockProfile,
        dataKey: null,
        config: createDefaultSyncConfig(),
        resolveSyncPassword: async () => undefined,
        callbacks: {
          onRecoveryPhrase: vi.fn(),
          onConflict: vi.fn(async () => 'cancel' as const),
        },
      }),
    ).rejects.toThrow(/relay değil/)
  })
})

describe('relay session operations', () => {
  it('ensureRelayNamespace delegasyonu', async () => {
    const session = mockSession()
    await ensureRelayNamespace(session as never, { namespaceLabel: 'Ev' })
    expect(session.ensureNamespace).toHaveBeenCalledWith({ namespaceLabel: 'Ev' })
  })

  it('runRelaySync import yoksa reloaded false', async () => {
    const session = mockSession()
    const outcome = await runRelaySync(session as never)
    expect(session.sync).toHaveBeenCalledWith('primary')
    expect(outcome).toEqual({ status: 'ok', reloaded: false })
  })

  it('runRelaySync import sonrası reloaded true', async () => {
    const session = mockSession()
    connectMock.mockResolvedValue(session)
    await connectRelaySession({
      profile: mockProfile,
      dataKey: null,
      config: relayConfig(),
      resolveSyncPassword: async () => undefined,
      callbacks: {
        onRecoveryPhrase: vi.fn(),
        onConflict: vi.fn(async () => 'cancel' as const),
      },
      storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    })

    const calls = createKpDocumentAdapterMock.mock.calls
    const adapterCtx = calls[calls.length - 1]?.[0] as {
      onAfterImport?: () => Promise<void>
    }
    session.sync.mockImplementation(async () => {
      await adapterCtx.onAfterImport?.()
      return { status: 'ok' }
    })

    const outcome = await runRelaySync(session as never)
    expect(outcome.reloaded).toBe(true)
  })

  it('connectRelaySession onAfterImport ile store reload ve onRemotePull bağlar', async () => {
    const onRemotePull = vi.fn()
    const onBeforeRemoteApply = vi.fn()
    const onAfterRemoteApply = vi.fn()
    reloadStoresAfterSyncPullMock.mockClear()

    await connectRelaySession({
      profile: mockProfile,
      dataKey: null,
      config: relayConfig(),
      resolveSyncPassword: async () => undefined,
      callbacks: {
        onRecoveryPhrase: vi.fn(),
        onConflict: vi.fn(async () => 'cancel' as const),
        onRemotePull,
        onBeforeRemoteApply,
        onAfterRemoteApply,
      },
      storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
    })

    const calls = createKpDocumentAdapterMock.mock.calls
    const adapterCtx = calls[calls.length - 1]?.[0] as {
      onAfterImport?: () => Promise<void>
    }
    expect(adapterCtx?.onAfterImport).toBeTypeOf('function')
    await adapterCtx.onAfterImport?.()
    expect(onBeforeRemoteApply).toHaveBeenCalled()
    expect(reloadStoresAfterSyncPullMock).toHaveBeenCalled()
    expect(onRemotePull).toHaveBeenCalled()
    expect(onAfterRemoteApply).toHaveBeenCalled()
  })

  it('runRelaySync hata durumunda reloaded false', async () => {
    const session = mockSession()
    session.sync.mockResolvedValueOnce({ status: 'offline' } as SyncRunResult)

    const outcome = await runRelaySync(session as never)
    expect(outcome).toEqual({ status: 'offline', reloaded: false })
  })

  it('notifyRelayLocalChange ve flushRelayPush', async () => {
    const session = mockSession()
    notifyRelayLocalChange(session as never)
    expect(session.notifyLocalChange).toHaveBeenCalledWith('primary')

    await flushRelayPush(session as never)
    expect(session.flushPush).toHaveBeenCalledWith('primary')
  })

  it('markRelayLocalChange ve cancelRelayDebouncedPush', () => {
    const session = mockSession()
    markRelayLocalChange(session as never)
    expect(session.markLocalChange).toHaveBeenCalledWith('primary')

    cancelRelayDebouncedPush(session as never)
    expect(session.cancelDebouncedPush).toHaveBeenCalledWith('primary')
  })

  it('runRelayManualSync önce mark+flush sonra sync', async () => {
    const session = mockSession()
    session.sync.mockResolvedValueOnce({ status: 'ok' } as SyncRunResult)

    await runRelayManualSync(session as never)

    expect(session.cancelDebouncedPush).toHaveBeenCalledWith('primary')
    expect(session.markLocalChange).toHaveBeenCalledWith('primary')
    expect(session.flushPush).toHaveBeenCalledWith('primary')
    expect(session.sync).toHaveBeenCalledWith('primary')
  })

  it('runRelayManualSync pullAfterPush false ise yalnızca flush', async () => {
    const session = mockSession()

    const outcome = await runRelayManualSync(session as never, { pullAfterPush: false })

    expect(session.flushPush).toHaveBeenCalled()
    expect(session.sync).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'ok', reloaded: false })
  })

  it('activateRelaySession enable çağırır', () => {
    const session = mockSession()
    activateRelaySession(session as never)
    expect(session.enable).toHaveBeenCalled()
  })

  it('disconnect ve destroy', () => {
    const session = mockSession()
    disconnectRelaySession(session as never)
    destroyRelaySession(session as never)
    expect(session.disable).toHaveBeenCalled()
    expect(session.destroy).toHaveBeenCalled()
  })
})
