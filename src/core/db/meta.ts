import Dexie, { type Table } from 'dexie'
import { APP_VERSION, META_DB_NAME, SCHEMA_VERSION } from '@/core/constants'
import type { AppMeta, ProfileMeta } from '@/core/types/profile'
import type { BankingPresetRow } from '@/core/types/banking-preset'
import type { ModelsCatalogRow } from '@/core/types/ai-catalog'
import { newDeviceId, normalizeSyncConfig } from '@/core/types/sync'
import { normalizeUpdateCheckConfig } from '@/core/types/update-check'

const APP_META_KEY = 'app'

interface AppMetaRow {
  key: typeof APP_META_KEY
  value: AppMeta
}

/**
 * IndexedDB structured clone Vue 3 reactive Proxy'lerinin bazı
 * iç Symbol/getter'larını kopyalayamayabilir. JSON dance ile
 * her zaman düz, serileştirilebilir bir obje elde et.
 *
 * Not: `undefined`, fonksiyon ve Symbol alanlar atlanır; ProfileMeta
 * ve AppMeta yalnızca string/number/boolean alanlar içerir.
 */
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface SyncHandleRow {
  key: string
  handle: FileSystemFileHandle
  fileName: string
}

class MetaDatabase extends Dexie {
  appMeta!: Table<AppMetaRow, string>
  profiles!: Table<ProfileMeta, string>
  bankingPreset!: Table<BankingPresetRow, string>
  modelsCatalog!: Table<ModelsCatalogRow, string>
  syncHandles!: Table<SyncHandleRow, string>

  constructor() {
    super(META_DB_NAME)
    this.version(1).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
    })
    this.version(2).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
      bankingPreset: '&id',
    })
    this.version(3).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
      bankingPreset: '&id',
      modelsCatalog: '&id',
    })
    this.version(4).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
      bankingPreset: '&id',
      modelsCatalog: '&id',
    }).upgrade(async (tx) => {
      const row = await tx.table('appMeta').get(APP_META_KEY)
      if (!row?.value) return
      const value = row.value as AppMeta
      if (!value.deviceId) {
        value.deviceId = newDeviceId()
        await tx.table('appMeta').put({ key: APP_META_KEY, value: toPlain(value) })
      }
    })
    this.version(5).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
      bankingPreset: '&id',
      modelsCatalog: '&id',
      syncHandles: '&key',
    })
    this.version(6).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
      bankingPreset: '&id',
      modelsCatalog: '&id',
      syncHandles: '&key',
    }).upgrade(async (tx) => {
      const legacy = await tx.table('syncHandles').get('active')
      if (!legacy) return
      const appRow = await tx.table('appMeta').get(APP_META_KEY)
      const profileId = (appRow?.value as AppMeta | undefined)?.activeProfileId
      if (profileId) {
        await tx.table('syncHandles').put({
          key: profileId,
          handle: legacy.handle,
          fileName: legacy.fileName,
        })
        const sync = (appRow?.value as AppMeta | undefined)?.sync
        if (sync && typeof sync === 'object') {
          const cfg = sync as Record<string, unknown>
          const byProfile =
            cfg.fileNameByProfile && typeof cfg.fileNameByProfile === 'object'
              ? { ...(cfg.fileNameByProfile as Record<string, string>) }
              : {}
          byProfile[profileId] = legacy.fileName
          const value = {
            ...(appRow!.value as AppMeta),
            sync: { ...cfg, fileNameByProfile: byProfile },
          }
          await tx.table('appMeta').put({ key: APP_META_KEY, value: toPlain(value) })
        }
      }
      await tx.table('syncHandles').delete('active')
    })
  }
}

export const metaDb = new MetaDatabase()

export async function getActiveBankingPresetRow(): Promise<BankingPresetRow | undefined> {
  return metaDb.bankingPreset.get('active')
}

export async function putActiveBankingPresetRow(row: BankingPresetRow): Promise<void> {
  await metaDb.bankingPreset.put(toPlain(row))
}

export async function clearActiveBankingPreset(): Promise<void> {
  await metaDb.bankingPreset.delete('active')
}

export async function getActiveModelsCatalogRow(): Promise<ModelsCatalogRow | undefined> {
  return metaDb.modelsCatalog.get('active')
}

export async function putActiveModelsCatalogRow(row: ModelsCatalogRow): Promise<void> {
  await metaDb.modelsCatalog.put(toPlain(row))
}

export async function clearActiveModelsCatalogRow(): Promise<void> {
  await metaDb.modelsCatalog.delete('active')
}

export async function getAppMeta(): Promise<AppMeta> {
  const row = await metaDb.appMeta.get(APP_META_KEY)
  if (row) {
    let value = row.value
    if (!value.deviceId) {
      value = {
        ...value,
        deviceId: newDeviceId(),
        updatedAt: new Date().toISOString(),
      }
      await metaDb.appMeta.put({ key: APP_META_KEY, value: toPlain(value) })
    }
    if (value.sync) {
      value = { ...value, sync: normalizeSyncConfig(value.sync) }
    }
    if (value.updateCheck) {
      value = { ...value, updateCheck: normalizeUpdateCheckConfig(value.updateCheck) }
    }
    return value
  }

  const now = new Date().toISOString()
  const fresh: AppMeta = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: now,
    updatedAt: now,
    deviceId: newDeviceId(),
  }
  await metaDb.appMeta.put({ key: APP_META_KEY, value: toPlain(fresh) })
  return fresh
}

export async function updateAppMeta(patch: Partial<AppMeta>): Promise<AppMeta> {
  const current = await getAppMeta()
  const next: AppMeta = {
    ...current,
    ...patch,
    appVersion: APP_VERSION,
    updatedAt: new Date().toISOString(),
  }
  if (patch.sync !== undefined) {
    next.sync = normalizeSyncConfig(patch.sync)
  }
  if (patch.updateCheck !== undefined) {
    next.updateCheck = normalizeUpdateCheckConfig(patch.updateCheck)
  }
  await metaDb.appMeta.put({ key: APP_META_KEY, value: toPlain(next) })
  return next
}

export async function listProfiles(): Promise<ProfileMeta[]> {
  return metaDb.profiles.orderBy('name').toArray()
}

export async function getProfile(id: string): Promise<ProfileMeta | undefined> {
  return metaDb.profiles.get(id)
}

export async function saveProfile(profile: ProfileMeta): Promise<void> {
  await metaDb.profiles.put(toPlain(profile))
}

export async function deleteProfile(id: string): Promise<void> {
  await metaDb.profiles.delete(id)
}
