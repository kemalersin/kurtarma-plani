import Dexie, { type Table } from 'dexie'
import { APP_VERSION, META_DB_NAME, SCHEMA_VERSION } from '@/core/constants'
import type { AppMeta, ProfileMeta } from '@/core/types/profile'

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

class MetaDatabase extends Dexie {
  appMeta!: Table<AppMetaRow, string>
  profiles!: Table<ProfileMeta, string>

  constructor() {
    super(META_DB_NAME)
    this.version(1).stores({
      appMeta: '&key',
      profiles: '&id, name, lastOpenedAt',
    })
  }
}

export const metaDb = new MetaDatabase()

export async function getAppMeta(): Promise<AppMeta> {
  const row = await metaDb.appMeta.get(APP_META_KEY)
  if (row) return row.value

  const now = new Date().toISOString()
  const fresh: AppMeta = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: now,
    updatedAt: now,
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
