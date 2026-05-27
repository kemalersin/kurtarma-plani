import {
  APP_VERSION,
  EXPORT_FILE_TYPE,
  PBKDF2_ITERATIONS,
  SCHEMA_VERSION,
} from '@/core/constants'
import {
  decryptBytes,
  decryptJson,
  deriveFileKey,
  encryptBytes,
  type EncryptedPayload,
} from '@/core/crypto/aes'
import { fromBase64, randomBytes, toBase64 } from '@/core/crypto/codec'
import { buildPasswordInfo } from '@/core/crypto/profile-key'
import { metaDb, saveProfile } from '@/core/db/meta'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import {
  openProfileDb,
  type EntityType,
} from '@/core/db/profile-db'
import {
  ENCRYPTED_FILE_MAGIC,
  ExportSnapshotSchema,
  PLAIN_FILE_MAGIC,
  type EncryptedFileEnvelope,
  type ExportOptions,
  type ExportSnapshot,
  type PlainFileEnvelope,
  type ProfileEntityForExport,
} from '@/core/types/export'
import { loadActiveBankingPreset } from '@/core/services/banking-preset'
import { resolveUniqueProfileName } from '@/core/services/snapshot-import'
import type { ProfileMeta } from '@/core/types/profile'

interface ActiveProfileContext {
  profile: ProfileMeta
  key: CryptoKey | null
}

/** Yedek/senkron snapshot'ına dahil edilmeyen entity tipleri (cihaza özel). */
export const SNAPSHOT_EXCLUDED_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(['chatSession'])

export function isSnapshotExportableEntity(type: EntityType): boolean {
  return !SNAPSHOT_EXCLUDED_ENTITY_TYPES.has(type)
}

/**
 * Snapshot dosyasını üret — yalnızca aktif (kilidi açık) profil.
 *
 * `includeSecrets=false` iken AI ayarları gibi gizli alanlar (apiKey/baseUrl)
 * çıkarılır. `includeSensitive=false` iken `sensitive: true` işaretli kayıtlar atlanır.
 * AI sohbet oturumları (`chatSession`) yedek/senkrona yazılmaz.
 */
export async function buildSnapshot(
  options: ExportOptions,
  active: ActiveProfileContext,
): Promise<ExportSnapshot> {
  const profile = active.profile
  const key = active.key
  const entities: ProfileEntityForExport[] = []
  const repo = new EncryptedRepo(profile.id, key)
  const rows = await repo.exportAllRaw()
  for (const row of rows) {
    if (!isSnapshotExportableEntity(row.type)) continue
    if (!options.includeSensitive && row.sensitive) continue
    const data = row.encrypted
      ? key
        ? await decryptJson(key, row.payload as EncryptedPayload)
        : null
      : row.payload
    if (data === null) continue

    const cleaned = options.includeSecrets ? data : stripSecrets(row.type, data)
    entities.push({
      id: row.id,
      type: row.type,
      updatedAt: row.updatedAt,
      sensitive: row.sensitive,
      data: cleaned,
    })
  }

  const presetWrapper = await loadActiveBankingPreset()

  const snapshot: ExportSnapshot = {
    type: EXPORT_FILE_TYPE,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    options: {
      includeSensitive: options.includeSensitive,
      includeSecrets: options.includeSecrets,
    },
    bankingPreset: presetWrapper.preset,
    profiles: [
      {
        profile: {
          id: profile.id,
          name: profile.name,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          lastOpenedAt: profile.lastOpenedAt,
          localeSettings: profile.localeSettings,
        },
        entities,
      },
    ],
  }
  return snapshot
}

function stripSecrets(type: string, data: unknown): unknown {
  if (type !== 'aiSettings' || !data || typeof data !== 'object') return data
  const clone = JSON.parse(JSON.stringify(data)) as { providers?: Array<Record<string, unknown>> }
  if (Array.isArray(clone.providers)) {
    for (const p of clone.providers) {
      delete p.apiKey
      delete p.baseUrl
    }
  }
  return clone
}

export async function encodeSnapshotFile(
  snapshot: ExportSnapshot,
  options: { encryptFile: boolean; password?: string },
): Promise<string> {
  const exportedAt = snapshot.exportedAt
  if (!options.encryptFile) {
    const envelope: PlainFileEnvelope = {
      magic: PLAIN_FILE_MAGIC,
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      snapshot,
    }
    return JSON.stringify(envelope, null, 2)
  }

  if (!options.password || options.password.length < 6) {
    throw new Error('Dosya şifreleme için parola en az 6 karakter olmalı.')
  }
  const salt = randomBytes(16)
  const key = await deriveFileKey(options.password, salt, PBKDF2_ITERATIONS)
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot))
  const { iv, ct } = await encryptBytes(key, bytes)
  const envelope: EncryptedFileEnvelope = {
    magic: ENCRYPTED_FILE_MAGIC,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: toBase64(salt),
    },
    cipher: { name: 'AES-GCM', iv, ct },
  }
  return JSON.stringify(envelope, null, 2)
}

export type LoadedSnapshotResult =
  | { ok: true; snapshot: ExportSnapshot; encrypted: boolean }
  | { ok: false; reason: 'needs-password' | 'invalid-format' | 'wrong-password' | 'schema'; message: string }

export async function decodeSnapshotFile(
  text: string,
  password?: string,
): Promise<LoadedSnapshotResult> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'invalid-format', message: 'Dosya geçerli JSON değil.' }
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'invalid-format', message: 'Dosya yapısı tanınmıyor.' }
  }
  const envelope = raw as Record<string, unknown>
  const magic = envelope.magic

  if (magic === PLAIN_FILE_MAGIC) {
    const snap = (envelope.snapshot ?? null) as unknown
    const parsed = ExportSnapshotSchema.safeParse(snap)
    if (!parsed.success) {
      return {
        ok: false,
        reason: 'schema',
        message: `Snapshot şeması geçersiz: ${parsed.error.issues[0]?.message ?? 'bilinmiyor'}`,
      }
    }
    return { ok: true, snapshot: parsed.data, encrypted: false }
  }

  if (magic === ENCRYPTED_FILE_MAGIC) {
    if (!password) {
      return {
        ok: false,
        reason: 'needs-password',
        message: 'Şifreli dosya; içe almak için parola gerekli.',
      }
    }
    const kdf = (envelope.kdf ?? {}) as Record<string, unknown>
    const cipher = (envelope.cipher ?? {}) as Record<string, unknown>
    if (
      kdf.name !== 'PBKDF2' ||
      kdf.hash !== 'SHA-256' ||
      typeof kdf.iterations !== 'number' ||
      typeof kdf.salt !== 'string' ||
      cipher.name !== 'AES-GCM' ||
      typeof cipher.iv !== 'string' ||
      typeof cipher.ct !== 'string'
    ) {
      return { ok: false, reason: 'invalid-format', message: 'Şifreli zarf alanları eksik.' }
    }
    try {
      const key = await deriveFileKey(password, fromBase64(kdf.salt), kdf.iterations)
      const bytes = await decryptBytes(key, { iv: cipher.iv, ct: cipher.ct })
      const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown
      const parsed = ExportSnapshotSchema.safeParse(json)
      if (!parsed.success) {
        return {
          ok: false,
          reason: 'schema',
          message: `Snapshot şeması geçersiz: ${parsed.error.issues[0]?.message ?? 'bilinmiyor'}`,
        }
      }
      return { ok: true, snapshot: parsed.data, encrypted: true }
    } catch {
      return { ok: false, reason: 'wrong-password', message: 'Parola yanlış veya dosya bozulmuş.' }
    }
  }

  return { ok: false, reason: 'invalid-format', message: 'Bilinmeyen dosya türü.' }
}

export interface ImportSummary {
  importedProfiles: number
  importedEntities: number
  skippedProfiles: number
  overwritten?: boolean
  /** İçe aktarma sonrası açılması gereken profil kimliği. */
  targetProfileId?: string
  /** Aynı kimlik zaten vardı; veri güncellendi. */
  mergedExisting?: boolean
}

export interface ImportSnapshotOptions {
  /** Verilirse dosyadaki profil bu kaydın üzerine yazılır (id ve parola korunur). */
  overwriteProfileId?: string
  /** Üzerine yazma modunda entity şifreleme anahtarı. */
  dataKey?: CryptoKey | null
  /** Kurulum/geri yükleme: yedekteki profil kimliği korunur (varsayılan import davranışı). */
  preserveProfileId?: boolean
}

/** İçe aktarma başarı mesajı; kayıt yoksa yalnızca profil sayısı belirtilir. */
export function formatImportSummaryMessage(summary: ImportSummary): string {
  if (summary.overwritten) {
    if (summary.importedEntities > 0) {
      return `Aktif profil güncellendi (${summary.importedEntities} kayıt).`
    }
    return 'Aktif profil güncellendi.'
  }
  if (summary.mergedExisting) {
    if (summary.importedEntities > 0) {
      return `Mevcut profil güncellendi (${summary.importedEntities} kayıt).`
    }
    return 'Mevcut profil güncellendi.'
  }
  const { importedProfiles, importedEntities } = summary
  if (importedEntities > 0) {
    return `${importedProfiles} profil ve ${importedEntities} kayıt içe aktarıldı.`
  }
  return `${importedProfiles} profil içe aktarıldı.`
}

async function writeImportedEntities(
  profileId: string,
  key: CryptoKey | null,
  entities: ProfileEntityForExport[],
): Promise<number> {
  const importable = entities.filter((entity) =>
    isSnapshotExportableEntity(entity.type as EntityType),
  )
  const db = openProfileDb(profileId)
  const existingRows = await db.entities.toArray()
  const idsToReplace = existingRows
    .filter((row) => isSnapshotExportableEntity(row.type))
    .map((row) => row.id)
  if (idsToReplace.length > 0) {
    await db.entities.bulkDelete(idsToReplace)
  }
  if (importable.length === 0) return 0

  const repo = new EncryptedRepo(profileId, key)
  for (const entity of importable) {
    await repo.put({
      id: entity.id,
      type: entity.type as EntityType,
      updatedAt: entity.updatedAt,
      data: entity.data,
      sensitive: entity.sensitive,
    })
  }
  return importable.length
}

/**
 * Snapshot'taki profilleri içe aktarır.
 * Varsayılan: yeni profil; aynı isim varsa "Ad 2", "Ad 3" …
 * `overwriteProfileId` ile aktif profilin verisi değiştirilir.
 */
export async function importSnapshot(
  snapshot: ExportSnapshot,
  options: ImportSnapshotOptions = {},
): Promise<ImportSummary> {
  if (snapshot.profiles.length === 0) {
    return { importedProfiles: 0, importedEntities: 0, skippedProfiles: 0 }
  }

  const bundle = snapshot.profiles[0]!
  const now = new Date().toISOString()

  if (options.overwriteProfileId) {
    const existing = await metaDb.profiles.get(options.overwriteProfileId)
    if (!existing) {
      throw new Error('Üzerine yazılacak profil bulunamadı.')
    }

    const importedEntities = await writeImportedEntities(
      options.overwriteProfileId,
      options.dataKey ?? null,
      bundle.entities,
    )

    const updated: ProfileMeta = {
      ...existing,
      name: bundle.profile.name,
      localeSettings: bundle.profile.localeSettings as ProfileMeta['localeSettings'],
      updatedAt: now,
    }
    await saveProfile(updated)

    return {
      importedProfiles: 1,
      importedEntities,
      skippedProfiles: 0,
      overwritten: true,
      targetProfileId: options.overwriteProfileId,
    }
  }

  let importedProfiles = 0
  let importedEntities = 0
  let targetProfileId: string | undefined
  let mergedExisting = false
  const existingNames = (await metaDb.profiles.toArray()).map((p) => p.name)

  for (const item of snapshot.profiles) {
    const existingById = await metaDb.profiles.get(item.profile.id)
    if (existingById) {
      const count = await writeImportedEntities(item.profile.id, null, item.entities)
      importedEntities += count
      importedProfiles += 1
      targetProfileId = item.profile.id
      mergedExisting = true
      continue
    }

    const name = resolveUniqueProfileName(item.profile.name, existingNames)
    existingNames.push(name)

    const { info } = await buildPasswordInfo(undefined)
    const profile: ProfileMeta = {
      id: item.profile.id,
      name,
      createdAt: item.profile.createdAt,
      updatedAt: now,
      lastOpenedAt: undefined,
      localeSettings: item.profile.localeSettings as ProfileMeta['localeSettings'],
      password: info,
    }
    await saveProfile(profile)

    importedEntities += await writeImportedEntities(item.profile.id, null, item.entities)
    importedProfiles += 1
    targetProfileId = item.profile.id
  }

  return {
    importedProfiles,
    importedEntities,
    skippedProfiles: 0,
    targetProfileId,
    mergedExisting: mergedExisting || undefined,
  }
}
