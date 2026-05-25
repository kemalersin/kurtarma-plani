import { describe, expect, it } from 'vitest'
import {
  decideAutoPull,
  hasLocalChangesSinceLastSync,
  buildConflictContext,
} from '@/core/services/sync/sync-conflict'

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

describe('hasLocalChangesSinceLastSync', () => {
  it('push yoksa yerel değişiklik vardır', () => {
    expect(hasLocalChangesSinceLastSync('2026-05-22T13:00:00.000Z', null)).toBe(true)
  })

  it('mutation push sonrasıysa değişiklik yok', () => {
    expect(
      hasLocalChangesSinceLastSync(
        '2026-05-22T12:00:00.000Z',
        '2026-05-22T12:30:00.000Z',
      ),
    ).toBe(false)
  })

  it('mutation push sonrasıysa değişiklik var', () => {
    expect(
      hasLocalChangesSinceLastSync(
        '2026-05-22T13:00:00.000Z',
        '2026-05-22T12:30:00.000Z',
      ),
    ).toBe(true)
  })
})

describe('decideAutoPull', () => {
  it('rev aynıysa pull yok', () => {
    expect(decideAutoPull(envelope, 'p1', 'rev-remote', null, '2026-05-22T12:00:00.000Z')).toBe(
      'none',
    )
  })

  it('uzak rev farklı ve yerel temizse pull', () => {
    expect(decideAutoPull(envelope, 'p1', 'rev-local', null, '2026-05-22T12:00:00.000Z')).toBe(
      'pull',
    )
  })

  it('uzak rev farklı ve yerel değişmişse çakışma', () => {
    expect(
      decideAutoPull(
        envelope,
        'p1',
        'rev-local',
        '2026-05-22T13:00:00.000Z',
        '2026-05-22T12:00:00.000Z',
      ),
    ).toBe('conflict')
  })
})

describe('buildConflictContext', () => {
  it('uzak meta bilgisini paketler', () => {
    const ctx = buildConflictContext(
      envelope,
      '2026-05-22T13:00:00.000Z',
      '2026-05-22T12:00:00.000Z',
    )
    expect(ctx.remoteRevision).toBe('rev-remote')
    expect(ctx.localMutationAt).toBe('2026-05-22T13:00:00.000Z')
  })
})
