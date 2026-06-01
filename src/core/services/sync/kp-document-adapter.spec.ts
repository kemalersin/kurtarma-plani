import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXPORT_FILE_TYPE, SCHEMA_VERSION } from '@/core/constants'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import {
  KP_CONTENT_TYPE,
  createKpDocumentAdapter,
  pickKpSyncSnapshotOptions,
} from '@/core/services/sync/kp-document-adapter'
import type { ExportSnapshot } from '@/core/types/export'
import type { ProfileMeta } from '@/core/types/profile'
import { createDefaultSyncConfig } from '@/core/types/sync'

const PROFILE_ID = '550e8400-e29b-41d4-a716-446655440000'

const mockProfile: ProfileMeta = {
  id: PROFILE_ID,
  name: 'Ev',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  localeSettings: { ...DEFAULT_LOCALE_SETTINGS },
  password: { enabled: false },
}

const mockSnapshot: ExportSnapshot = {
  type: EXPORT_FILE_TYPE,
  schemaVersion: SCHEMA_VERSION,
  exportedAt: '2026-05-22T12:00:00.000Z',
  appVersion: '0.1.41',
  options: { includeSensitive: false, includeSecrets: false },
  profiles: [
    {
      profile: {
        id: PROFILE_ID,
        name: 'Ev',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        localeSettings: { ...DEFAULT_LOCALE_SETTINGS },
      },
      entities: [{ id: 'e1', type: 'bank', updatedAt: '2026-01-01T00:00:00.000Z', data: {} }],
    },
  ],
}

const buildSnapshotMock = vi.fn()
const importSnapshotMock = vi.fn()

vi.mock('@/core/services/snapshot', () => ({
  buildSnapshot: (...args: unknown[]) => buildSnapshotMock(...args),
  importSnapshot: (...args: unknown[]) => importSnapshotMock(...args),
}))

function createAdapter(
  overrides: Partial<Parameters<typeof createKpDocumentAdapter>[0]> = {},
) {
  return createKpDocumentAdapter({
    profile: mockProfile,
    dataKey: null,
    syncOptions: { includeSensitive: false, includeSecrets: false },
    resolveSyncPassword: async () => 'sync-secret',
    ...overrides,
  })
}

describe('kp-document-adapter', () => {
  beforeEach(() => {
    buildSnapshotMock.mockReset()
    importSnapshotMock.mockReset()
    buildSnapshotMock.mockResolvedValue(mockSnapshot)
    importSnapshotMock.mockResolvedValue({
      importedProfiles: 1,
      importedEntities: 1,
      skippedProfiles: 0,
      overwritten: true,
    })
  })

  it('namespace ve contentType profil meta ile eşleşir', () => {
    const adapter = createAdapter()
    expect(adapter.namespaceId()).toBe(PROFILE_ID)
    expect(adapter.namespaceLabel()).toBe('Ev')
    expect(adapter.contentType()).toBe(KP_CONTENT_TYPE)
  })

  it('buildDocument buildSnapshot çağırır — inner snapshot şifresiz', async () => {
    const adapter = createAdapter({
      syncOptions: { includeSensitive: true, includeSecrets: false },
    })
    const json = await adapter.buildDocument()
    expect(buildSnapshotMock).toHaveBeenCalledWith(
      {
        includeSensitive: true,
        includeSecrets: false,
        encryptFile: false,
      },
      { profile: mockProfile, key: null },
    )
    expect(JSON.parse(json)).toEqual(mockSnapshot)
  })

  it('importDocument snapshot doğrular ve overwriteProfileId ile içe aktarır', async () => {
    const adapter = createAdapter()
    await adapter.importDocument(JSON.stringify(mockSnapshot))
    expect(importSnapshotMock).toHaveBeenCalledWith(mockSnapshot, {
      overwriteProfileId: PROFILE_ID,
      dataKey: null,
    })
  })

  it('importDocument sonrası onAfterImport çağrılır', async () => {
    const onAfterImport = vi.fn()
    const adapter = createAdapter({ onAfterImport })
    await adapter.importDocument(JSON.stringify(mockSnapshot))
    expect(onAfterImport).toHaveBeenCalledOnce()
  })

  it('geçersiz snapshot onAfterImport tetiklemez', async () => {
    const onAfterImport = vi.fn()
    const adapter = createAdapter({ onAfterImport })
    await expect(adapter.importDocument(JSON.stringify({ type: 'wrong' }))).rejects.toThrow()
    expect(onAfterImport).not.toHaveBeenCalled()
  })

  it('geçersiz snapshot şemasını reddeder', async () => {
    const adapter = createAdapter()
    await expect(adapter.importDocument(JSON.stringify({ type: 'wrong' }))).rejects.toThrow()
    expect(importSnapshotMock).not.toHaveBeenCalled()
  })

  it('encryption ayarlarını iletir', async () => {
    const resolveSyncPassword = vi.fn(async () => 'pw-123')
    const adapter = createAdapter({ encrypt: true, resolveSyncPassword })
    expect(adapter.encryption()).toEqual({
      enabled: true,
      resolvePassword: resolveSyncPassword,
    })
    await expect(adapter.encryption().resolvePassword()).resolves.toBe('pw-123')
  })

  it('encrypt false ile şifreleme kapalı', () => {
    const adapter = createAdapter({ encrypt: false })
    expect(adapter.encryption().enabled).toBe(false)
  })

  it('geçersiz namespaceId ile hata fırlatır', () => {
    expect(() =>
      createKpDocumentAdapter({
        profile: { ...mockProfile, id: 'not-a-uuid' },
        dataKey: null,
        syncOptions: { includeSensitive: false, includeSecrets: false },
        resolveSyncPassword: async () => undefined,
      }),
    ).toThrow(/namespaceId/)
  })
})

describe('pickKpSyncSnapshotOptions', () => {
  it('includeSensitive ve includeSecrets alanlarını seçer', () => {
    const config = { ...createDefaultSyncConfig(), includeSensitive: true }
    expect(pickKpSyncSnapshotOptions(config)).toEqual({
      includeSensitive: true,
      includeSecrets: false,
    })
  })
})
