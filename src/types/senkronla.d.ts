/** Yerel / vite alias — npm `@senkronla/client` yayınlanınca paket tipleri devreye girer. */
declare module '@senkronla/client' {
  export interface DocumentAdapter {
    buildDocument(): Promise<string>
    importDocument(documentJson: string): Promise<void>
    contentType(): string
    encryption(): {
      enabled: boolean
      resolvePassword(): Promise<string | undefined>
    }
    namespaceId(): string
    namespaceLabel(): string
  }

  export interface EsrStorage {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
  }

  export interface ConflictContext {
    namespaceId: string
    documentId: string
    knownRevision: string | null
    remoteRevision: string
    remoteMeta: { writtenAt: string }
  }

  export interface EnsureNamespaceResult {
    namespaceId: string
    created: boolean
    recoveryPhrase?: string
  }

  export interface NamespaceLimits {
    freeDeviceLimit: number
    purchasedSlots: number
    maxDevices: number
    activeDevices: number
    canAddDevice?: boolean
  }

  export interface DeviceInfo {
    deviceId: string
    clientDeviceId: string
    label: string
    pairedAt: string
    lastSeenAt: string | null
    isCurrent: boolean
  }

  export interface DeviceLimitContext {
    namespaceId: string
    code: 'DEVICE_LIMIT_PAYMENT_REQUIRED' | 'DEVICE_LIMIT_BLOCKED'
    limits: NamespaceLimits
    slotPackages?: number[]
  }

  export interface PairingHostResult {
    code: string
    qrPayload: string
    expiresAt: string
    allowedAppIds?: string[]
  }

  export type EsrSyncStatus =
    | 'disabled'
    | 'idle'
    | 'syncing'
    | 'pending_push'
    | 'remote_pending'
    | 'conflict'
    | 'error'
    | 'offline'
    | 'ws_connected'

  export type SyncRunResult =
    | { status: 'ok' }
    | { status: 'conflict'; ctx: ConflictContext }
    | { status: 'offline' }
    | { status: 'error'; error: { message: string; code: string } }

  export class EsrSync {
    static connect(options: Record<string, unknown>): Promise<EsrSync>
    enable(): void
    disable(): void
    destroy(): void
    ensureNamespace(opts?: { namespaceLabel?: string }): Promise<EnsureNamespaceResult>
    startPairing(options?: { ttlSeconds?: number; allowedAppIds?: string[] }): Promise<PairingHostResult>
    joinPairing(pairingCode: string): Promise<void>
    recover(recoveryPhrase: string): Promise<void>
    listDevices(): Promise<{ devices: DeviceInfo[]; limits: NamespaceLimits }>
    revokeDevice(deviceId: string): Promise<void>
    redeemUnlockCode(code: string): Promise<void>
    sync(documentId?: string): Promise<SyncRunResult>
    notifyLocalChange(documentId?: string): void
    markLocalChange(documentId?: string): void
    cancelDebouncedPush(documentId?: string): void
    flushPush(documentId?: string): Promise<void>
    resolveConflict(choice: 'remote' | 'local', documentId?: string): Promise<void>
    getStatus(): EsrSyncStatus
  }

  export function createDocumentAdapter(opts: {
    namespaceId: string
    namespaceLabel: string
    contentType: string
    exportDocument: () => Promise<unknown>
    importDocument: (data: unknown) => Promise<void>
    encrypt?: boolean
    resolvePassword?: () => Promise<string | undefined>
  }): DocumentAdapter

  export function createLocalStorageAdapter(): EsrStorage
  export function createMemoryStorageAdapter(initial?: Record<string, string>): EsrStorage
}
