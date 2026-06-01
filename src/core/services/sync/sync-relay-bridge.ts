import type { ConflictContext, EsrSyncStatus } from '@senkronla/client'
import type { RelaySessionCallbacks } from '@/core/services/sync/relay-session'

export type RelayConflictChoice = 'remote' | 'local' | 'cancel'

export interface RelayStoreBridgeHandlers {
  onRecoveryPhrase: (ctx: { phrase: string; namespaceId: string }) => void | Promise<void>
  onConflictDetected: (ctx: ConflictContext) => void
  onStatusChange: (status: EsrSyncStatus) => void
  onError: (message: string) => void
  onRemotePull?: () => void | Promise<void>
  onBeforeRemoteApply?: () => void | Promise<void>
  onAfterRemoteApply?: () => void | Promise<void>
  onDeviceLimit?: RelaySessionCallbacks['onDeviceLimit']
}

export function createRelayConflictChoiceGate(): {
  waitForChoice: () => Promise<RelayConflictChoice>
  resolveChoice: (choice: RelayConflictChoice) => void
  hasPending: () => boolean
  cancelPending: () => void
} {
  let resolver: ((choice: RelayConflictChoice) => void) | null = null

  return {
    waitForChoice: () =>
      new Promise<RelayConflictChoice>((resolve) => {
        resolver = resolve
      }),
    resolveChoice(choice: RelayConflictChoice) {
      resolver?.(choice)
      resolver = null
    },
    hasPending: () => resolver !== null,
    cancelPending() {
      resolver = null
    },
  }
}

export function createRelayStoreCallbacks(
  handlers: RelayStoreBridgeHandlers,
  conflictGate: ReturnType<typeof createRelayConflictChoiceGate>,
): RelaySessionCallbacks {
  return {
    onRecoveryPhrase: handlers.onRecoveryPhrase,
    onConflict: async (ctx) => {
      handlers.onConflictDetected(ctx)
      return conflictGate.waitForChoice()
    },
    onStatusChange: handlers.onStatusChange,
    onError: handlers.onError,
    onRemotePull: handlers.onRemotePull,
    onBeforeRemoteApply: handlers.onBeforeRemoteApply,
    onAfterRemoteApply: handlers.onAfterRemoteApply,
    onDeviceLimit: handlers.onDeviceLimit,
  }
}
