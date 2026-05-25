import { describe, expect, it } from 'vitest'
import { PLAIN_FILE_MAGIC } from '@/core/types/export'
import { SYNC_FILE_MAGIC } from '@/core/types/sync'
import {
  buildSyncEnvelope,
  parseSyncEnvelope,
  serializeSyncEnvelope,
  verifySyncEnvelope,
} from '@/core/services/sync/sync-envelope'
import {
  envelopeProfileMismatch,
  remoteRevisionChanged,
} from '@/core/services/sync/sync-engine'

describe('sync-envelope', () => {
  it('build → serialize → parse → verify döngüsü', async () => {
    const inner = JSON.stringify({ magic: PLAIN_FILE_MAGIC, snapshot: {} })
    const envelope = await buildSyncEnvelope({
      profileId: 'p1',
      profileName: 'Ev',
      deviceId: 'dev-1',
      revision: 'rev-1',
      innerPayloadJson: inner,
      encryptFile: false,
    })
    expect(envelope.magic).toBe(SYNC_FILE_MAGIC)
    expect(await verifySyncEnvelope(envelope)).toBe(true)

    const text = serializeSyncEnvelope(envelope)
    const parsed = parseSyncEnvelope(text)
    expect(parsed?.revision).toBe('rev-1')
    expect(parsed && (await verifySyncEnvelope(parsed))).toBe(true)
  })

  it('bozuk hash doğrulamayı reddeder', async () => {
    const envelope = await buildSyncEnvelope({
      profileId: 'p1',
      profileName: 'Ev',
      deviceId: 'dev-1',
      revision: 'rev-1',
      innerPayloadJson: '{}',
      encryptFile: false,
    })
    envelope.contentSha256 = 'f'.repeat(64)
    expect(await verifySyncEnvelope(envelope)).toBe(false)
  })
})

describe('sync-conflict helpers', () => {
  const envelope = {
    magic: 'KP-SYNC1' as const,
    schemaVersion: 1,
    contentMagic: 'KP-RAW1' as const,
    profileId: 'p1',
    profileName: 'Ev',
    revision: 'rev-remote',
    deviceId: 'dev-2',
    writtenAt: '2026-05-22T12:00:00.000Z',
    contentSha256: 'a'.repeat(64),
    payload: '{}',
  }

  it('profil uyuşmazlığını ayırır', () => {
    expect(envelopeProfileMismatch(envelope, 'p2')).toBe(true)
    expect(envelopeProfileMismatch(envelope, 'p1')).toBe(false)
    expect(envelopeProfileMismatch(null, 'p1')).toBe(false)
  })

  it('revizyon değişimini algılar', () => {
    expect(remoteRevisionChanged(envelope, 'p1', undefined)).toBe(true)
    expect(remoteRevisionChanged(envelope, 'p1', 'rev-remote')).toBe(false)
    expect(remoteRevisionChanged(envelope, 'p1', 'rev-local')).toBe(true)
    expect(remoteRevisionChanged(null, 'p1', 'rev-local')).toBe(false)
    expect(remoteRevisionChanged(envelope, 'p2', 'rev-local')).toBe(false)
  })
})
