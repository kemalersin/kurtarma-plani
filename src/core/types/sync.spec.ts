import { describe, expect, it } from 'vitest'
import {
  SyncConfigSchema,
  SyncFileEnvelopeSchema,
  applyEnvRelayEndpoint,
  applySyncConfigPatch,
  createDefaultSyncConfig,
  defaultProfileSyncPreferences,
  isRelayTransport,
  isValidRelayBaseUrl,
  normalizePersistedSyncConfig,
  normalizeSyncConfig,
  omitProfileSyncState,
  relayAdapterConfigKey,
  resolveSyncConfigForProfile,
  syncConfigForPersist,
} from '@/core/types/sync'

describe('SyncConfigSchema', () => {
  it('varsayılan yapılandırmayı doğrular', () => {
    expect(SyncConfigSchema.parse(createDefaultSyncConfig())).toEqual(createDefaultSyncConfig())
  })

  it('varsayılan transport file', () => {
    expect(createDefaultSyncConfig().transport).toBe('file')
  })

  it('relay transport ve relayUrl kabul eder', () => {
    const config = SyncConfigSchema.parse({
      ...createDefaultSyncConfig(),
      transport: 'relay',
      relayUrl: 'https://sync.example.com/v1',
      appId: 'esr_app_kurtarma_plani',
    })
    expect(config.transport).toBe('relay')
    expect(config.relayUrl).toBe('https://sync.example.com/v1')
    expect(config.appId).toBe('esr_app_kurtarma_plani')
  })

  it('relayUrl /v1 ile bitmiyorsa reddeder', () => {
    expect(() =>
      SyncConfigSchema.parse({
        ...createDefaultSyncConfig(),
        relayUrl: 'https://sync.example.com/api',
      }),
    ).toThrow()
  })

  it('normalizeSyncConfig bozuk veride varsayılan döner', () => {
    expect(normalizeSyncConfig(null).enabled).toBe(false)
    expect(normalizeSyncConfig({ enabled: true }).enabled).toBe(true)
    expect(normalizeSyncConfig({ enabled: true }).encryptFile).toBe(false)
    expect(normalizeSyncConfig({ fileNameByProfile: { p1: 'a.sync' } }).fileNameByProfile?.p1).toBe(
      'a.sync',
    )
  })

  it('relayAdapterConfigKey adapter alanlarını ayırır', () => {
    const base = createDefaultSyncConfig()
    expect(relayAdapterConfigKey(base)).not.toBe(
      relayAdapterConfigKey({ ...base, encryptFile: true }),
    )
  })

  it('normalizeSyncConfig eski kayıtlara transport file ekler', () => {
    const legacy = {
      enabled: true,
      encryptFile: true,
      useProfilePassword: true,
      includeSensitive: false,
      includeSecrets: false,
      autoPush: true,
      syncMode: 'handle' as const,
      remoteRevisionByProfile: {},
    }
    expect(normalizeSyncConfig(legacy).transport).toBe('file')
  })

  it('normalizeSyncConfig relayConnectedByProfile birleştirir', () => {
    const normalized = normalizeSyncConfig({
      relayConnectedByProfile: { p1: true },
    })
    expect(normalized.relayConnectedByProfile?.p1).toBe(true)
  })

  it('boş relayUrl ve appId env varsayılanına düşer', () => {
    const normalized = normalizeSyncConfig({
      relayUrl: '   ',
      appId: '',
    })
    expect(normalized.relayUrl).toBe(createDefaultSyncConfig().relayUrl)
    expect(normalized.appId).toBe(createDefaultSyncConfig().appId)
  })

  it('kilitsiz kayıtta env uç noktası IndexedDB değerinin üzerine yazar', () => {
    const normalized = normalizeSyncConfig({
      appId: 'esr_app_eski',
      relayUrl: 'http://localhost:9999/v1',
    })
    expect(normalized.appId).toBe(createDefaultSyncConfig().appId)
    expect(normalized.relayUrl).toBe(createDefaultSyncConfig().relayUrl)
    expect(normalized.relayEndpointLocked).toBe(false)
  })

  it('relayEndpointLocked true ise kayıtlı uç nokta korunur', () => {
    const normalized = normalizeSyncConfig({
      relayEndpointLocked: true,
      appId: 'esr_app_ozel',
      relayUrl: 'http://localhost:9999/v1',
    })
    expect(normalized.appId).toBe('esr_app_ozel')
    expect(normalized.relayUrl).toBe('http://localhost:9999/v1')
  })

  it('syncConfigForPersist geçersiz relayUrl ile profil tercihlerini korur', () => {
    const persisted = syncConfigForPersist({
      ...createDefaultSyncConfig(),
      relayEndpointLocked: true,
      relayUrl: 'not-a-valid-url',
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), enabled: true, transport: 'relay' },
      },
    })
    expect(persisted.relayUrl).toBe('not-a-valid-url')
    expect(persisted.preferencesByProfile?.p1?.enabled).toBe(true)
  })

  it('syncConfigForPersist kilitsiz kayıtta appId ve relayUrl yazmaz', () => {
    const persisted = syncConfigForPersist({
      ...createDefaultSyncConfig(),
      appId: 'esr_app_eski',
      relayUrl: 'http://localhost:9999/v1',
    })
    expect(persisted.appId).toBeUndefined()
    expect(persisted.relayUrl).toBeUndefined()
    expect(persisted.relayEndpointLocked).toBeUndefined()
  })

  it('syncConfigForPersist kilitli kayıtta uç noktayı saklar', () => {
    const persisted = syncConfigForPersist({
      ...createDefaultSyncConfig(),
      relayEndpointLocked: true,
      appId: 'esr_app_ozel',
      relayUrl: 'http://localhost:9999/v1',
    })
    expect(persisted.appId).toBe('esr_app_ozel')
    expect(persisted.relayUrl).toBe('http://localhost:9999/v1')
    expect(persisted.relayEndpointLocked).toBe(true)
  })

  it('applyEnvRelayEndpoint kilitli yapılandırmayı değiştirmez', () => {
    const locked = applyEnvRelayEndpoint({
      ...createDefaultSyncConfig(),
      relayEndpointLocked: true,
      appId: 'esr_app_ozel',
      relayUrl: 'http://localhost:9999/v1',
    })
    expect(locked.appId).toBe('esr_app_ozel')
  })

  it('yeni profil kayıtlı tercihlerden etkilenmez', () => {
    const persisted = normalizePersistedSyncConfig({
      preferencesByProfile: {
        p1: {
          enabled: true,
          encryptFile: true,
          useProfilePassword: true,
          includeSensitive: true,
          includeSecrets: true,
          autoPush: false,
          syncMode: 'manual',
          transport: 'relay',
        },
      },
    })
    const freshProfile = resolveSyncConfigForProfile(persisted, 'p2')
    expect(freshProfile.enabled).toBe(false)
    expect(freshProfile.encryptFile).toBe(false)
    expect(freshProfile.transport).toBe('file')
    expect(freshProfile.includeSensitive).toBe(false)
  })

  it('omitProfileSyncState yalnızca hedef profili temizler', () => {
    const persisted = normalizePersistedSyncConfig({
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), enabled: true },
        p2: { ...defaultProfileSyncPreferences(), enabled: true },
      },
      fileNameByProfile: { p1: 'a.sync', p2: 'b.sync' },
    })
    const next = omitProfileSyncState(persisted, 'p2')
    expect(next.preferencesByProfile?.p1?.enabled).toBe(true)
    expect(next.preferencesByProfile?.p2).toBeUndefined()
    expect(next.fileNameByProfile?.p1).toBe('a.sync')
    expect(next.fileNameByProfile?.p2).toBeUndefined()
  })

  it('applySyncConfigPatch profil tercihlerini diğer profillerden ayırır', () => {
    const base = normalizePersistedSyncConfig({
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), enabled: true },
      },
    })
    const next = applySyncConfigPatch(base, 'p2', { enabled: true, transport: 'relay' })
    expect(next.preferencesByProfile?.p1?.enabled).toBe(true)
    expect(next.preferencesByProfile?.p2?.enabled).toBe(true)
    expect(next.preferencesByProfile?.p2?.transport).toBe('relay')
    expect(resolveSyncConfigForProfile(next, 'p1').enabled).toBe(true)
    expect(resolveSyncConfigForProfile(next, 'p2').transport).toBe('relay')
  })

  it('normalizePersistedSyncConfig geçersiz relayUrl ile profil tercihlerini korur', () => {
    const raw = {
      relayUrl: 'https://sync.example.com/api',
      relayEndpointLocked: true,
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), enabled: true, transport: 'relay' as const },
      },
    }
    const normalized = normalizePersistedSyncConfig(raw)
    expect(normalized.relayUrl).toBe('https://sync.example.com/api')
    expect(normalized.preferencesByProfile?.p1?.enabled).toBe(true)
    expect(resolveSyncConfigForProfile(normalized, 'p1').enabled).toBe(true)
  })

  it('applySyncConfigPatch dosya bağlarken transport file yazar', () => {
    const persisted = normalizePersistedSyncConfig({
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), enabled: true, transport: 'relay' },
      },
    })
    const baseline = { ...defaultProfileSyncPreferences(), enabled: true, transport: 'relay' as const }
    const next = applySyncConfigPatch(
      persisted,
      'p1',
      { fileNameByProfile: { p1: 'profil.sync' } },
      baseline,
    )
    expect(next.preferencesByProfile?.p1?.transport).toBe('file')
    expect(resolveSyncConfigForProfile(next, 'p1').transport).toBe('file')
  })

  it('applySyncConfigPatch patchte enabled yoksa çözülmüş enabled değerini korur', () => {
    const persisted = normalizePersistedSyncConfig({})
    const baseline = { ...defaultProfileSyncPreferences(), enabled: true, transport: 'relay' as const }
    const next = applySyncConfigPatch(
      persisted,
      'p1',
      { transport: 'relay', relayUrl: 'https://bad.example.com/v1' },
      baseline,
    )
    expect(next.preferencesByProfile?.p1?.enabled).toBe(true)
    expect(next.preferencesByProfile?.p1?.transport).toBe('relay')
    expect(resolveSyncConfigForProfile(next, 'p1').enabled).toBe(true)
  })

  it('applySyncConfigPatch lastError undefined ile hatayı temizler', () => {
    const persisted = normalizePersistedSyncConfig({
      preferencesByProfile: {
        p1: { ...defaultProfileSyncPreferences(), lastError: 'Application is not registered' },
      },
    })
    const next = applySyncConfigPatch(persisted, 'p1', { lastError: undefined })
    expect(next.preferencesByProfile?.p1?.lastError).toBeUndefined()
    expect(resolveSyncConfigForProfile(next, 'p1').lastError).toBeUndefined()
  })
})

describe('isValidRelayBaseUrl', () => {
  it('geçerli /v1 adreslerini kabul eder', () => {
    expect(isValidRelayBaseUrl('https://sync.example.com/v1')).toBe(true)
    expect(isValidRelayBaseUrl('https://sync.example.com/v1/')).toBe(true)
    expect(isValidRelayBaseUrl('http://localhost:8080/v1')).toBe(true)
  })

  it('geçersiz yolları reddeder', () => {
    expect(isValidRelayBaseUrl('https://sync.example.com/api')).toBe(false)
    expect(isValidRelayBaseUrl('not-a-url')).toBe(false)
  })
})

describe('isRelayTransport', () => {
  it('relay ve file ayırır', () => {
    expect(isRelayTransport({ transport: 'relay' })).toBe(true)
    expect(isRelayTransport({ transport: 'file' })).toBe(false)
  })
})

describe('SyncFileEnvelopeSchema', () => {
  it('geçerli zarfı kabul eder', () => {
    const envelope = {
      magic: 'KP-SYNC1',
      schemaVersion: 1,
      contentMagic: 'KP-RAW1',
      profileId: 'p1',
      profileName: 'Ev',
      revision: '01JTEST',
      deviceId: 'dev-1',
      writtenAt: '2026-05-22T12:00:00.000Z',
      contentSha256: 'a'.repeat(64),
      payload: '{}',
    }
    expect(SyncFileEnvelopeSchema.parse(envelope).profileId).toBe('p1')
  })
})
