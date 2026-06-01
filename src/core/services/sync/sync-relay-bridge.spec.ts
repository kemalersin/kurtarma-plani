import { describe, expect, it, vi } from 'vitest'
import { buildRelayConflictContext } from '@/core/services/sync/sync-conflict'
import {
  createRelayConflictChoiceGate,
  createRelayStoreCallbacks,
} from '@/core/services/sync/sync-relay-bridge'

describe('buildRelayConflictContext', () => {
  it('ESR ConflictContext alanlarını eşler', () => {
    const ctx = buildRelayConflictContext(
      {
        remoteRevision: 'rev-remote',
        remoteWrittenAt: '2026-05-22T12:00:00.000Z',
      },
      '2026-05-22T11:00:00.000Z',
      '2026-05-22T10:00:00.000Z',
    )
    expect(ctx.remoteRevision).toBe('rev-remote')
    expect(ctx.remoteWrittenAt).toBe('2026-05-22T12:00:00.000Z')
    expect(ctx.localMutationAt).toBe('2026-05-22T11:00:00.000Z')
  })
})

describe('createRelayConflictChoiceGate', () => {
  it('onConflict seçimini bekler ve çözer', async () => {
    const gate = createRelayConflictChoiceGate()
    const onConflictDetected = vi.fn()
    const callbacks = createRelayStoreCallbacks(
      {
        onRecoveryPhrase: vi.fn(),
        onConflictDetected,
        onStatusChange: vi.fn(),
        onError: vi.fn(),
      },
      gate,
    )

    const choicePromise = callbacks.onConflict!({
      namespaceId: 'ns',
      documentId: 'primary',
      knownRevision: 'a',
      remoteRevision: 'b',
      remoteMeta: { writtenAt: '2026-05-22T12:00:00.000Z' },
    })

    expect(onConflictDetected).toHaveBeenCalled()
    expect(gate.hasPending()).toBe(true)

    gate.resolveChoice('remote')
    await expect(choicePromise).resolves.toBe('remote')
    expect(gate.hasPending()).toBe(false)
  })
})
