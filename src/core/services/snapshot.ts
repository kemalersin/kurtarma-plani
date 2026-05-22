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
  importRawKey,
  type EncryptedPayload,
} from '@/core/crypto/aes'
import { fromBase64, randomBytes, toBase64 } from '@/core/crypto/codec'
import { buildPasswordInfo } from '@/core/crypto/profile-key'
import { metaDb, saveProfile } from '@/core/db/meta'
import { EncryptedRepo } from '@/core/db/encrypted-repo'
import {
  openProfileDb,
  type EntityType,
  type ProfileEntityRow,
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
  type ProfileExportBundle,
} from '@/core/types/export'
import { loadActiveBankingPreset } from '@/core/services/banking-preset'
import { newId } from '@/core/util/id'
import type { ProfileMeta } from '@/core/types/profile'

interface ActiveProfileContext {
  profile: ProfileMeta
  key: CryptoKey | null
}

/**
 * Snapshot dosyasını üret. Yalnız aktif (kilidi açık) profilin entity'leri okunabilir;
 * diğer profiller meta + parolasız ise entity'leri eklenir, parolalı + kilitliyse
 * yalnız meta export edilir.
 *
 * `includeSecrets=false` iken AI ayarları gibi gizli alanlar (apiKey/baseUrl)
 * çıkarılır. `includeSensitive=false` iken `sensitive: true` işaretli kayıtlar atlanır.
 */
export async function buildSnapshot(
  options: ExportOptions,
  active: ActiveProfileContext | null,
): Promise<ExportSnapshot> {
  const allProfiles = await metaDb.profiles.toArray()
  const bundles: ProfileExportBundle[] = []

  for (const profile of allProfiles) {
    const isActive = active?.profile.id === profile.id
    const canRead = isActive
      ? true
      : !profile.password.enabled && profile.password.dataKey !== undefined

    let entities: ProfileEntityForExport[] = []
    if (canRead) {
      let key: CryptoKey | null = null
      if (isActive) {
        key = active!.key
      } else {
        // Parolasız profilin dataKey'i metadata'da raw saklı; AES-GCM olarak içe al.
        const dataKey = profile.password.dataKey
        if (dataKey) {
          key = await importRawKey(dataKey)
        }
      }
      const repo = new EncryptedRepo(profile.id, key)
      const rows = await repo.exportAllRaw()
      for (const row of rows) {
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
    }

    bundles.push({
      profile: {
        id: profile.id,
        name: profile.name,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        lastOpenedAt: profile.lastOpenedAt,
        localeSettings: profile.localeSettings,
      },
      entities,
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
    profiles: bundles,
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
}

/** İçe aktarma başarı mesajı; kayıt yoksa yalnızca profil sayısı belirtilir. */
export function formatImportSummaryMessage(summary: ImportSummary): string {
  const { importedProfiles, importedEntities } = summary
  if (importedEntities > 0) {
    return `${importedProfiles} profil ve ${importedEntities} kayıt içe aktarıldı.`
  }
  return `${importedProfiles} profil içe aktarıldı.`
}

/**
 * Snapshot'taki profilleri yeni parolasız profiller olarak ekler.
 * Çakışan id'ler için yeni id üretilir; kullanıcı sonra parola atayabilir.
 */
export async function importSnapshot(snapshot: ExportSnapshot): Promise<ImportSummary> {
  let importedProfiles = 0
  let importedEntities = 0

  for (const bundle of snapshot.profiles) {
    const existing = await metaDb.profiles.get(bundle.profile.id)
    const targetId = existing ? newId() : bundle.profile.id
    const now = new Date().toISOString()
    const { info } = await buildPasswordInfo(undefined)
    const namedSuffix = existing ? ' (içe aktarıldı)' : ''
    const profile: ProfileMeta = {
      id: targetId,
      name: `${bundle.profile.name}${namedSuffix}`,
      createdAt: bundle.profile.createdAt,
      updatedAt: now,
      lastOpenedAt: undefined,
      localeSettings: bundle.profile.localeSettings as ProfileMeta['localeSettings'],
      password: info,
    }
    await saveProfile(profile)

    if (bundle.entities.length > 0) {
      const db = openProfileDb(targetId)
      const rows: ProfileEntityRow[] = bundle.entities.map((e) => ({
        id: e.id,
        type: e.type as EntityType,
        updatedAt: e.updatedAt,
        encrypted: false,
        payload: JSON.parse(JSON.stringify(e.data)),
        sensitive: e.sensitive,
      }))
      await db.entities.bulkPut(rows)
      importedEntities += rows.length
    }
    importedProfiles += 1
  }

  return { importedProfiles, importedEntities, skippedProfiles: 0 }
}
