import { createDocumentAdapter, type DocumentAdapter } from '@senkronla/client'
import { buildSnapshot, importSnapshot } from '@/core/services/snapshot'
import { ExportSnapshotSchema } from '@/core/types/export'
import type { ProfileMeta } from '@/core/types/profile'
import type { SyncConfig } from '@/core/types/sync'

/** ESR relay `DocumentAdapter.contentType()` — operatör whitelist için. */
export const KP_CONTENT_TYPE = 'application/vnd.kurtarma-plani.snapshot+json'

export interface KpDocumentAdapterContext {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  syncOptions: Pick<SyncConfig, 'includeSensitive' | 'includeSecrets'>
  /** Relay zarf şifrelemesi (`ENV-ENC1`); inner snapshot düz JSON kalır. */
  encrypt?: boolean
  resolveSyncPassword: () => Promise<string | undefined>
  /** WS bildirimi veya poll pull sonrası — IndexedDB içe aktarımı bittiğinde. */
  onAfterImport?: () => void | Promise<void>
}

/** `SyncConfig` içinden snapshot export seçeneklerini ayırır. */
export function pickKpSyncSnapshotOptions(
  config: Pick<SyncConfig, 'includeSensitive' | 'includeSecrets'>,
): Pick<SyncConfig, 'includeSensitive' | 'includeSecrets'> {
  return {
    includeSensitive: config.includeSensitive,
    includeSecrets: config.includeSecrets,
  }
}

/**
 * Kurtarma Planı snapshot'ını Senkronla `DocumentAdapter`'a köprüler.
 * Relay transport push/pull bu adapter üzerinden `buildSnapshot` / `importSnapshot` çağırır.
 */
export function createKpDocumentAdapter(ctx: KpDocumentAdapterContext): DocumentAdapter {
  const encrypt = ctx.encrypt ?? true

  return createDocumentAdapter({
    namespaceId: ctx.profile.id,
    namespaceLabel: ctx.profile.name,
    contentType: KP_CONTENT_TYPE,
    encrypt,
    resolvePassword: ctx.resolveSyncPassword,
    exportDocument: async () =>
      buildSnapshot(
        {
          includeSensitive: ctx.syncOptions.includeSensitive,
          includeSecrets: ctx.syncOptions.includeSecrets,
          encryptFile: false,
        },
        { profile: ctx.profile, key: ctx.dataKey },
      ),
    importDocument: async (json: unknown) => {
      const snapshot = ExportSnapshotSchema.parse(json)
      await importSnapshot(snapshot, {
        overwriteProfileId: ctx.profile.id,
        dataKey: ctx.dataKey,
      })
      await ctx.onAfterImport?.()
    },
  })
}
