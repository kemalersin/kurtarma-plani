import { describe, expect, it } from 'vitest'
import {
  SyncConfigSchema,
  SyncFileEnvelopeSchema,
  createDefaultSyncConfig,
  normalizeSyncConfig,
} from '@/core/types/sync'

describe('SyncConfigSchema', () => {
  it('varsayılan yapılandırmayı doğrular', () => {
    expect(SyncConfigSchema.parse(createDefaultSyncConfig())).toEqual(createDefaultSyncConfig())
  })

  it('normalizeSyncConfig bozuk veride varsayılan döner', () => {
    expect(normalizeSyncConfig(null).enabled).toBe(false)
    expect(normalizeSyncConfig({ enabled: true }).enabled).toBe(true)
    expect(normalizeSyncConfig({ enabled: true }).encryptFile).toBe(true)
    expect(normalizeSyncConfig({ fileNameByProfile: { p1: 'a.sync' } }).fileNameByProfile?.p1).toBe(
      'a.sync',
    )
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
