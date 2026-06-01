import {
  EsrSync,
  createLocalStorageAdapter,
  type ConflictContext,
  type EnsureNamespaceResult,
  type EsrStorage,
  type EsrSyncStatus,
  type SyncRunResult,
} from '@senkronla/client'
import type { ProfileMeta } from '@/core/types/profile'
import {
  isRelayTransport,
  isValidRelayBaseUrl,
  type SyncConfig,
} from '@/core/types/sync'
import { createKpDocumentAdapter, pickKpSyncSnapshotOptions } from '@/core/services/sync/kp-document-adapter'
import { reloadStoresAfterSyncPull } from '@/core/services/sync/sync-file'
import { SYNC_PUSH_DEBOUNCE_MS } from '@/core/services/sync/sync-scheduler'

export const RELAY_PRIMARY_DOCUMENT_ID = 'primary'

export type RelayConfigValidation =
  | { ok: true; relayUrl: string }
  | { ok: false; message: string }

export interface RelaySessionCallbacks {
  onRecoveryPhrase: (ctx: { phrase: string; namespaceId: string }) => void | Promise<void>
  onConflict: (ctx: ConflictContext) => Promise<'remote' | 'local' | 'cancel'>
  onDeviceLimit?: EsrSyncConnectCallbacks['onDeviceLimit']
  onStatusChange?: (status: EsrSyncStatus) => void
  onError?: (message: string) => void
  /** Uzak head değişikliği (WS veya poll) pull tamamlandığında — UI yenileme. */
  onRemotePull?: () => void | Promise<void>
  /** IndexedDB import / store reload öncesi — yerel push bildirimlerini bastır. */
  onBeforeRemoteApply?: () => void | Promise<void>
  /** Import tamamlandıktan sonra — bekleyen push kuyruğunu temizle. */
  onAfterRemoteApply?: () => void | Promise<void>
}

/** Pick from EsrSyncConnectOptions — ambient modülde tam tip yok. */
interface EsrSyncConnectCallbacks {
  onDeviceLimit?: (ctx: {
    namespaceId: string
    code: 'DEVICE_LIMIT_PAYMENT_REQUIRED' | 'DEVICE_LIMIT_BLOCKED'
    limits: unknown
    slotPackages?: number[]
  }) => void | Promise<void>
}

export interface ConnectRelaySessionParams {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  config: SyncConfig
  resolveSyncPassword: () => Promise<string | undefined>
  callbacks: RelaySessionCallbacks
  fetch?: typeof fetch
  /** Test veya özel depolama; varsayılan `createLocalStorageAdapter()`. */
  storage?: EsrStorage
  /** Onay sonrası phrase'i EsrStorage'a yazar (SDK). */
  persistRecoveryPhrase?: boolean
}

export type RelaySyncOutcome = SyncRunResult & { reloaded: boolean }

/** Oturum başına son sync'te import olup olmadığını izler (`runRelaySync.reloaded`). */
const relayImportState = new WeakMap<EsrSync, { imported: boolean }>()

export function validateRelayConfig(config: SyncConfig): RelayConfigValidation {
  if (!isRelayTransport(config)) {
    return { ok: false, message: 'Senkron yöntemi relay değil.' }
  }
  const relayUrl = config.relayUrl?.trim()
  if (!relayUrl) {
    return { ok: false, message: 'Relay sunucu adresi gerekli.' }
  }
  if (!isValidRelayBaseUrl(relayUrl)) {
    return { ok: false, message: 'Relay adresi /v1 ile bitmeli.' }
  }
  return { ok: true, relayUrl }
}

/** Dosya senkron parola çözümlemesi ile aynı kaynak — ENV-ENC1 için. */
export function createRelayPasswordResolver(
  config: Pick<SyncConfig, 'encryptFile'>,
  getPassword: () => string | undefined,
): () => Promise<string | undefined> {
  return async () => {
    if (!config.encryptFile) return undefined
    const password = getPassword()?.trim()
    return password || undefined
  }
}

export async function connectRelaySession(params: ConnectRelaySessionParams): Promise<EsrSync> {
  const validation = validateRelayConfig(params.config)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const importState = { imported: false }

  const adapter = createKpDocumentAdapter({
    profile: params.profile,
    dataKey: params.dataKey,
    syncOptions: pickKpSyncSnapshotOptions(params.config),
    encrypt: params.config.encryptFile,
    resolveSyncPassword: params.resolveSyncPassword,
    onAfterImport: async () => {
      importState.imported = true
      await params.callbacks.onBeforeRemoteApply?.()
      try {
        await reloadStoresAfterSyncPull()
        await params.callbacks.onRemotePull?.()
      } finally {
        await params.callbacks.onAfterRemoteApply?.()
      }
    },
  })

  const storage = params.storage ?? createLocalStorageAdapter()

  const session = await EsrSync.connect({
    relayUrl: validation.relayUrl,
    appId: params.config.appId,
    document: adapter,
    storage,
    fetch: params.fetch,
    /** Namespace `ensureRelayNamespace` + `activateRelaySession` sonrası açılır. */
    enabled: false,
    pushDebounceMs: SYNC_PUSH_DEBOUNCE_MS,
    persistRecoveryPhrase: params.persistRecoveryPhrase ?? false,
    onRecoveryPhrase: params.callbacks.onRecoveryPhrase,
    onConflict: params.callbacks.onConflict,
    onDeviceLimit: params.callbacks.onDeviceLimit,
    onStatusChange: params.callbacks.onStatusChange,
    onError: (err: { message: string }) => {
      params.callbacks.onError?.(err.message)
    },
  })

  relayImportState.set(session, importState)
  return session
}

/** Bildirim / scheduler — namespace hazır olduktan sonra. */
export function activateRelaySession(session: EsrSync): void {
  session.enable()
}

export async function ensureRelayNamespace(
  session: EsrSync,
  opts?: { namespaceLabel?: string },
): Promise<EnsureNamespaceResult> {
  return session.ensureNamespace({
    namespaceLabel: opts?.namespaceLabel,
  })
}

export async function runRelaySync(
  session: EsrSync,
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): Promise<RelaySyncOutcome> {
  const importState = relayImportState.get(session)
  if (importState) importState.imported = false

  const result = await session.sync(documentId)
  const reloaded = importState?.imported ?? false
  return { ...result, reloaded }
}

export interface RunRelayManualSyncOptions {
  /** `false` ise yalnızca push (`flushPush`); varsayılan `true` — ardından `sync` (pull). */
  pullAfterPush?: boolean
}

/**
 * Manuel «Şimdi senkronize et»: yerel snapshot'ı relay'e yazar, isteğe bağlı uzak pull.
 * `sync()` tek başına push garantisi vermez; önce `markLocalChange` + `flushPush` gerekir.
 */
export async function runRelayManualSync(
  session: EsrSync,
  options: RunRelayManualSyncOptions = {},
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): Promise<RelaySyncOutcome> {
  cancelRelayDebouncedPush(session, documentId)
  markRelayLocalChange(session, documentId)
  await flushRelayPush(session, documentId)

  if (options.pullAfterPush === false) {
    return { status: 'ok', reloaded: false }
  }
  return runRelaySync(session, documentId)
}

export function notifyRelayLocalChange(
  session: EsrSync,
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): void {
  session.notifyLocalChange(documentId)
}

/** SDK debounce tetiklemeden yerel değişiklik bayrağı (KP scheduler push). */
export function markRelayLocalChange(
  session: EsrSync,
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): void {
  session.markLocalChange(documentId)
}

export function cancelRelayDebouncedPush(
  session: EsrSync,
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): void {
  session.cancelDebouncedPush(documentId)
}

export async function flushRelayPush(
  session: EsrSync,
  documentId: string = RELAY_PRIMARY_DOCUMENT_ID,
): Promise<void> {
  await session.flushPush(documentId)
}

export function disconnectRelaySession(session: EsrSync): void {
  session.disable()
}

export function destroyRelaySession(session: EsrSync): void {
  session.destroy()
}
