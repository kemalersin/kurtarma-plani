import type { SyncFileEnvelope } from '@/core/types/sync'
import { remoteRevisionChanged } from '@/core/services/sync/sync-engine'

export interface SyncConflictContext {
  remoteRevision: string
  remoteWrittenAt: string
  remoteDeviceId: string
  localMutationAt: string | null
  lastKnownPushAt: string | null
}

export function buildConflictContext(
  envelope: SyncFileEnvelope,
  lastLocalMutationAt: string | null | undefined,
  lastPushAt: string | null | undefined,
): SyncConflictContext {
  return {
    remoteRevision: envelope.revision,
    remoteWrittenAt: envelope.writtenAt,
    remoteDeviceId: envelope.deviceId,
    localMutationAt: lastLocalMutationAt ?? null,
    lastKnownPushAt: lastPushAt ?? null,
  }
}

export function hasLocalChangesSinceLastSync(
  lastLocalMutationAt: string | null | undefined,
  lastPushAt: string | null | undefined,
): boolean {
  if (!lastLocalMutationAt) return false
  if (!lastPushAt) return true
  return lastLocalMutationAt > lastPushAt
}

export type AutoPullDecision = 'none' | 'pull' | 'conflict'

export function decideAutoPull(
  envelope: SyncFileEnvelope | null,
  profileId: string,
  knownRevision: string | undefined,
  lastLocalMutationAt: string | null | undefined,
  lastPushAt: string | null | undefined,
): AutoPullDecision {
  if (!remoteRevisionChanged(envelope, profileId, knownRevision)) return 'none'
  if (hasLocalChangesSinceLastSync(lastLocalMutationAt, lastPushAt)) return 'conflict'
  return 'pull'
}
