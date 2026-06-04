import { z } from 'zod'
import { ENCRYPTED_FILE_MAGIC, PLAIN_FILE_MAGIC } from '@/core/types/export'

export const SYNC_FILE_MAGIC = 'KP-SYNC1' as const
export const SYNC_SCHEMA_VERSION = 1

export type SyncMode = 'handle' | 'manual'
export type SyncTransport = 'file' | 'relay'

/** ESR relay taban URL'i `/v1` ile biter. */
export const RELAY_URL_V1_SUFFIX = '/v1'

export const SyncTransportSchema = z.enum(['file', 'relay'])

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
)

const optionalTrimmedRelayUrlString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().optional(),
)

const optionalRelayUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z
    .string()
    .url()
    .refine(isValidRelayBaseUrl, { message: 'Relay adresi /v1 ile bitmeli.' })
    .optional(),
)

export const ProfileSyncPreferencesSchema = z.object({
  enabled: z.boolean().default(false),
  encryptFile: z.boolean().default(false),
  useProfilePassword: z.boolean().default(true),
  includeSensitive: z.boolean().default(false),
  includeSecrets: z.boolean().default(false),
  autoPush: z.boolean().default(true),
  syncMode: z.enum(['handle', 'manual']).default('handle'),
  transport: SyncTransportSchema.default('file'),
  lastSyncAt: z.string().optional(),
  lastError: z.string().optional(),
})

export type ProfileSyncPreferences = z.infer<typeof ProfileSyncPreferencesSchema>

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
  /** Senkron taşıma katmanı — aynı profilde yalnızca biri aktif. */
  transport: SyncTransportSchema.default('file'),
  /** ESR relay taban URL (örn. `https://sync.example.com/v1`). */
  relayUrl: optionalRelayUrl,
  /** ESR app registry kimliği (`apps.enabled` relay'lerde). */
  appId: optionalTrimmedString,
  /** Profil başına relay namespace kurulum durumu (UI). */
  relayConnectedByProfile: z.record(z.string(), z.boolean()).optional(),
  /** true: kullanıcı Ayarlar'da relay uç noktasını kaydetti; appId/relayUrl IndexedDB'de kalır. */
  relayEndpointLocked: z.boolean().optional(),
  /** Bu kurulumda Senkron.la cihaz listesinde görünen ad (eşleştirme / namespace oluşturma). */
  relayDeviceLabel: optionalTrimmedString,
  /** WebSocket bildirimleri + poll yedeklemesi; kapalıyken yalnızca manuel/zamanlanmış senkron. */
  relayNotificationsEnabled: z.boolean().default(true),
  /** Profil başına senkron tercihleri (enabled, transport, şifreleme vb.). */
  preferencesByProfile: z.record(z.string(), ProfileSyncPreferencesSchema).optional(),
})

export type SyncConfig = z.infer<typeof SyncConfigSchema>

/** IndexedDB ham kaydı — relayUrl biçim doğrulaması yok (hatalı adres kayıtta kalır, bağlantı reddedilir). */
export const SyncConfigPersistedSchema = SyncConfigSchema.extend({
  relayUrl: optionalTrimmedRelayUrlString,
}).partial()

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

/** Build-time varsayılan relay URL (`VITE_ESR_RELAY_URL`). */
export function relayUrlFromEnv(): string | undefined {
  const url = import.meta.env.VITE_ESR_RELAY_URL?.trim()
  return url || undefined
}

/** Build-time varsayılan app id (`VITE_ESR_APP_ID`). */
export function appIdFromEnv(): string | undefined {
  const id = import.meta.env.VITE_ESR_APP_ID?.trim()
  return id || undefined
}

export function isValidRelayBaseUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname === '/v1' || pathname.endsWith('/v1')
  } catch {
    return false
  }
}

export function isRelayTransport(config: Pick<SyncConfig, 'transport'>): boolean {
  return config.transport === 'relay'
}

/** Relay `DocumentAdapter` seçenekleri değişince oturum yenilenmeli. */
export function relayAdapterConfigKey(
  config: Pick<SyncConfig, 'encryptFile' | 'useProfilePassword' | 'includeSensitive' | 'includeSecrets'>,
): string {
  return [
    config.encryptFile,
    config.useProfilePassword,
    config.includeSensitive,
    config.includeSecrets,
  ].join('\0')
}

/** Relay oturumu (`EsrSync.connect`) seçenekleri — adapter + cihaz adı + bildirimler. */
export function relaySessionConfigKey(
  config: Pick<
    SyncConfig,
    | 'encryptFile'
    | 'useProfilePassword'
    | 'includeSensitive'
    | 'includeSecrets'
    | 'relayDeviceLabel'
    | 'relayNotificationsEnabled'
  >,
): string {
  return [
    relayAdapterConfigKey(config),
    (config.relayDeviceLabel ?? '').trim(),
    String(config.relayNotificationsEnabled !== false),
  ].join('\0')
}

export const PROFILE_SYNC_PREFERENCE_KEYS = [
  'enabled',
  'encryptFile',
  'useProfilePassword',
  'includeSensitive',
  'includeSecrets',
  'autoPush',
  'syncMode',
  'transport',
  'lastSyncAt',
  'lastError',
] as const satisfies readonly (keyof SyncConfig)[]

export function defaultProfileSyncPreferences(): ProfileSyncPreferences {
  return ProfileSyncPreferencesSchema.parse({})
}

export function pickProfileSyncPreferences(
  source: Partial<SyncConfig>,
): Partial<ProfileSyncPreferences> {
  const picked: Partial<ProfileSyncPreferences> = {}
  for (const key of PROFILE_SYNC_PREFERENCE_KEYS) {
    const value = source[key]
    if (value !== undefined) {
      ;(picked as Record<string, unknown>)[key] = value
    }
  }
  return picked
}

function omitProfileKey<T>(record: Record<string, T> | undefined, profileId: string): Record<string, T> {
  if (!record) return {}
  const { [profileId]: _removed, ...rest } = record
  return rest
}

function collectProfileIdsFromPersisted(data: Partial<SyncConfig>): Set<string> {
  const ids = new Set<string>()
  for (const map of [
    data.fileNameByProfile,
    data.remoteRevisionByProfile,
    data.relayConnectedByProfile,
    data.preferencesByProfile,
  ]) {
    if (map) {
      for (const key of Object.keys(map)) ids.add(key)
    }
  }
  return ids
}

function extractLegacyProfilePreferences(data: Partial<SyncConfig>): ProfileSyncPreferences {
  return ProfileSyncPreferencesSchema.parse({
    enabled: data.enabled,
    encryptFile: data.encryptFile,
    useProfilePassword: data.useProfilePassword,
    includeSensitive: data.includeSensitive,
    includeSecrets: data.includeSecrets,
    autoPush: data.autoPush,
    syncMode: data.syncMode,
    transport: data.transport,
    lastSyncAt: data.lastSyncAt,
    lastError: data.lastError,
  })
}

function stripLegacyTopLevelProfileFields(config: SyncConfig): SyncConfig {
  const next = { ...config }
  for (const key of PROFILE_SYNC_PREFERENCE_KEYS) {
    delete (next as Record<string, unknown>)[key]
  }
  return next
}

export function createDefaultSyncConfig(): SyncConfig {
  return resolveSyncConfigForProfile(createEmptyPersistedSyncConfig(), null)
}

/** Kilitsiz kayıtlarda relay uç noktasını build-time env varsayılanlarına bağlar. */
export function applyEnvRelayEndpoint(config: SyncConfig): SyncConfig {
  if (config.relayEndpointLocked === true) return config
  return {
    ...config,
    appId: appIdFromEnv(),
    relayUrl: relayUrlFromEnv(),
    relayEndpointLocked: false,
  }
}

function createEmptyPersistedSyncConfig(): SyncConfig {
  return stripLegacyTopLevelProfileFields({
    ...defaultProfileSyncPreferences(),
    relayNotificationsEnabled: true,
    remoteRevisionByProfile: {},
    fileNameByProfile: {},
    relayConnectedByProfile: {},
    preferencesByProfile: {},
  })
}

/** IndexedDB'deki ham sync kaydını normalize eder (profil tercihleri `preferencesByProfile` içinde). */
export function normalizePersistedSyncConfig(raw: unknown): SyncConfig {
  const base = createEmptyPersistedSyncConfig()
  if (!raw || typeof raw !== 'object') return stripLegacyTopLevelProfileFields(base)

  const parsed = SyncConfigPersistedSchema.safeParse(raw)
  if (!parsed.success) return stripLegacyTopLevelProfileFields(base)

  const data = parsed.data
  let preferencesByProfile: Record<string, ProfileSyncPreferences> = {
    ...base.preferencesByProfile,
    ...(data.preferencesByProfile ?? {}),
  }

  const hasLegacyTopLevel = PROFILE_SYNC_PREFERENCE_KEYS.some((key) => data[key] !== undefined)
  if (hasLegacyTopLevel && data.preferencesByProfile === undefined) {
    const legacyPrefs = extractLegacyProfilePreferences({ ...base, ...data })
    for (const profileId of collectProfileIdsFromPersisted(data)) {
      if (!preferencesByProfile[profileId]) {
        preferencesByProfile[profileId] = legacyPrefs
      }
    }
  }

  return stripLegacyTopLevelProfileFields({
    ...base,
    fileName: data.fileName,
    fileNameByProfile: {
      ...base.fileNameByProfile,
      ...(data.fileNameByProfile ?? {}),
    },
    remoteRevisionByProfile: {
      ...base.remoteRevisionByProfile,
      ...(data.remoteRevisionByProfile ?? {}),
    },
    relayConnectedByProfile: {
      ...base.relayConnectedByProfile,
      ...(data.relayConnectedByProfile ?? {}),
    },
    relayUrl: data.relayUrl,
    appId: data.appId,
    relayEndpointLocked: data.relayEndpointLocked,
    relayDeviceLabel: data.relayDeviceLabel,
    relayNotificationsEnabled: data.relayNotificationsEnabled ?? true,
    preferencesByProfile,
  })
}

/** Aktif profil için birleşik (çalışma zamanı) sync yapılandırması. */
export function resolveSyncConfigForProfile(
  persisted: SyncConfig,
  profileId: string | null | undefined,
): SyncConfig {
  const normalized = normalizePersistedSyncConfig(persisted)
  let prefs = defaultProfileSyncPreferences()

  if (profileId) {
    const storedPrefs = normalized.preferencesByProfile?.[profileId]
    if (storedPrefs) {
      prefs = ProfileSyncPreferencesSchema.parse(storedPrefs)
    } else if (
      !normalized.preferencesByProfile ||
      Object.keys(normalized.preferencesByProfile).length === 0
    ) {
      const hasBinding =
        Boolean(syncFileNameForProfile(normalized, profileId)) ||
        isRelayConnectedForProfile(normalized, profileId)
      if (hasBinding) {
        prefs = extractLegacyProfilePreferences(normalized)
      }
    }
  }

  const merged: SyncConfig = {
    ...defaultProfileSyncPreferences(),
    remoteRevisionByProfile: normalized.remoteRevisionByProfile ?? {},
    fileNameByProfile: normalized.fileNameByProfile ?? {},
    relayConnectedByProfile: normalized.relayConnectedByProfile ?? {},
    preferencesByProfile: normalized.preferencesByProfile ?? {},
    fileName: normalized.fileName,
    relayUrl: normalized.relayUrl,
    appId: normalized.appId,
    relayEndpointLocked: normalized.relayEndpointLocked,
    relayDeviceLabel: normalized.relayDeviceLabel,
    relayNotificationsEnabled: normalized.relayNotificationsEnabled ?? true,
    ...prefs,
  }
  return applyEnvRelayEndpoint(merged)
}

/** Profil kaydını persisted sync'ten çıkarır; diğer profiller etkilenmez. */
export function omitProfileSyncState(persisted: SyncConfig, profileId: string): SyncConfig {
  const normalized = normalizePersistedSyncConfig(persisted)
  return stripLegacyTopLevelProfileFields({
    ...normalized,
    fileNameByProfile: omitProfileKey(normalized.fileNameByProfile, profileId),
    remoteRevisionByProfile: omitProfileKey(normalized.remoteRevisionByProfile, profileId),
    relayConnectedByProfile: omitProfileKey(normalized.relayConnectedByProfile, profileId),
    preferencesByProfile: omitProfileKey(normalized.preferencesByProfile, profileId),
  })
}

export function applySyncConfigPatch(
  persisted: SyncConfig,
  profileId: string | null,
  patch: Partial<SyncConfig>,
  /** Aktif profilin çözülmüş tercihleri — patch'te olmayan alanlar (ör. enabled) korunur. */
  resolvedBaseline?: Partial<ProfileSyncPreferences>,
): SyncConfig {
  let next = normalizePersistedSyncConfig(persisted)

  if (patch.fileName !== undefined) next.fileName = patch.fileName
  if (patch.fileNameByProfile) {
    next.fileNameByProfile = { ...next.fileNameByProfile, ...patch.fileNameByProfile }
  }
  if (patch.remoteRevisionByProfile) {
    next.remoteRevisionByProfile = {
      ...next.remoteRevisionByProfile,
      ...patch.remoteRevisionByProfile,
    }
  }
  if (patch.relayConnectedByProfile) {
    next.relayConnectedByProfile = {
      ...next.relayConnectedByProfile,
      ...patch.relayConnectedByProfile,
    }
  }
  if (patch.relayUrl !== undefined) next.relayUrl = patch.relayUrl
  if (patch.appId !== undefined) next.appId = patch.appId
  if (patch.relayEndpointLocked !== undefined) next.relayEndpointLocked = patch.relayEndpointLocked
  if (patch.relayDeviceLabel !== undefined) next.relayDeviceLabel = patch.relayDeviceLabel
  if (patch.relayNotificationsEnabled !== undefined) {
    next.relayNotificationsEnabled = patch.relayNotificationsEnabled
  }

  const profilePatch = pickProfileSyncPreferences(patch)
  if (Object.prototype.hasOwnProperty.call(patch, 'lastError')) {
    profilePatch.lastError = patch.lastError
  }
  if (profileId) {
    const boundFileName = patch.fileNameByProfile?.[profileId]?.trim()
    if (boundFileName && profilePatch.transport === undefined) {
      profilePatch.transport = 'file'
    }
    if (patch.relayConnectedByProfile?.[profileId] === true && profilePatch.transport === undefined) {
      profilePatch.transport = 'relay'
    }
  }
  if (profileId && Object.keys(profilePatch).length > 0) {
    const stored = next.preferencesByProfile?.[profileId]
    const current = ProfileSyncPreferencesSchema.parse({
      ...defaultProfileSyncPreferences(),
      ...resolvedBaseline,
      ...stored,
    })
    const merged: ProfileSyncPreferences = { ...current, ...profilePatch }
    if (
      Object.prototype.hasOwnProperty.call(profilePatch, 'lastError') &&
      profilePatch.lastError === undefined
    ) {
      delete merged.lastError
    }
    next.preferencesByProfile = {
      ...next.preferencesByProfile,
      [profileId]: ProfileSyncPreferencesSchema.parse(merged),
    }
  }

  return stripLegacyTopLevelProfileFields(next)
}

/** AppMeta.sync okuma — aktif profil yoksa varsayılan profil tercihleri. */
export function normalizeSyncConfig(raw: unknown): SyncConfig {
  const persisted = normalizePersistedSyncConfig(raw)
  const resolved = resolveSyncConfigForProfile(persisted, null)

  if (!raw || typeof raw !== 'object') return resolved
  const parsed = SyncConfigSchema.partial().safeParse(raw)
  if (!parsed.success) return resolved

  if (parsed.data.preferencesByProfile === undefined) {
    return applyEnvRelayEndpoint({
      ...resolved,
      ...pickProfileSyncPreferences(parsed.data),
    })
  }

  return resolved
}

/** IndexedDB'ye yazılacak sync — env türevli uç nokta yalnızca kullanıcı kilitlemişse saklanır. */
export function syncConfigForPersist(config: SyncConfig): SyncConfig {
  const persisted = stripLegacyTopLevelProfileFields(normalizePersistedSyncConfig(config))
  if (persisted.relayEndpointLocked === true) return persisted
  const stripped = { ...persisted }
  delete stripped.appId
  delete stripped.relayUrl
  delete stripped.relayEndpointLocked
  return stripped
}

export function syncFileNameForProfile(
  config: SyncConfig,
  profileId: string | null | undefined,
): string | undefined {
  if (!profileId) return undefined
  return config.fileNameByProfile?.[profileId] ?? (config.fileName || undefined)
}

export function isRelayConnectedForProfile(
  config: SyncConfig,
  profileId: string | null | undefined,
): boolean {
  if (!profileId) return false
  return config.relayConnectedByProfile?.[profileId] === true
}

/** Yeni AppMeta kaydı için kalıcı cihaz kimliği. */
export function newDeviceId(): string {
  return crypto.randomUUID()
}
