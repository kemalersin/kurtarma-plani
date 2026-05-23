import { z } from 'zod'
import { ENCRYPTED_FILE_MAGIC, PLAIN_FILE_MAGIC } from '@/core/types/export'

export const SYNC_FILE_MAGIC = 'KP-SYNC1' as const
export const SYNC_SCHEMA_VERSION = 1

export type SyncMode = 'handle' | 'manual'

export const SyncConfigSchema = z.object({
  enabled: z.boolean(),
  /** @deprecated Profil başına `fileNameByProfile` kullanın. */
  fileName: z.string().optional(),
  fileNameByProfile: z.record(z.string(), z.string()).optional(),
  encryptFile: z.boolean(),
  useProfilePassword: z.boolean(),
  includeSensitive: z.boolean(),
  includeSecrets: z.boolean(),
  autoPush: z.boolean(),
  syncMode: z.enum(['handle', 'manual']),
  remoteRevisionByProfile: z.record(z.string(), z.string()),
  lastSyncAt: z.string().optional(),
  lastError: z.string().optional(),
})

export type SyncConfig = z.infer<typeof SyncConfigSchema>

export const SyncFileEnvelopeSchema = z.object({
  magic: z.literal(SYNC_FILE_MAGIC),
  schemaVersion: z.number().int().min(1),
  contentMagic: z.union([z.literal(PLAIN_FILE_MAGIC), z.literal(ENCRYPTED_FILE_MAGIC)]),
  profileId: z.string().min(1),
  profileName: z.string().min(1),
  revision: z.string().min(1),
  deviceId: z.string().min(1),
  writtenAt: z.string(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  payload: z.string().min(1),
})

export type SyncFileEnvelope = z.infer<typeof SyncFileEnvelopeSchema>

export function createDefaultSyncConfig(): SyncConfig {
  return {
    enabled: false,
    encryptFile: true,
    useProfilePassword: true,
    includeSensitive: false,
    includeSecrets: false,
    autoPush: true,
    syncMode: 'handle',
    remoteRevisionByProfile: {},
    fileNameByProfile: {},
  }
}

/** AppMeta.sync okuma — eksik alanları varsayılanlarla tamamlar. */
export function normalizeSyncConfig(raw: unknown): SyncConfig {
  const base = createDefaultSyncConfig()
  if (!raw || typeof raw !== 'object') return base
  const parsed = SyncConfigSchema.partial().safeParse(raw)
  if (!parsed.success) return base
  return {
    ...base,
    ...parsed.data,
    fileNameByProfile: {
      ...base.fileNameByProfile,
      ...(parsed.data.fileNameByProfile ?? {}),
    },
    remoteRevisionByProfile: {
      ...base.remoteRevisionByProfile,
      ...(parsed.data.remoteRevisionByProfile ?? {}),
    },
  }
}

export function syncFileNameForProfile(
  config: SyncConfig,
  profileId: string | null | undefined,
): string | undefined {
  if (!profileId) return undefined
  return config.fileNameByProfile?.[profileId] ?? (config.fileName || undefined)
}

/** Yeni AppMeta kaydı için kalıcı cihaz kimliği. */
export function newDeviceId(): string {
  return crypto.randomUUID()
}
