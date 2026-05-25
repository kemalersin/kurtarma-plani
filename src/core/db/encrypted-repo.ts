import type { Table } from 'dexie'
import { decryptJson, encryptJson, type EncryptedPayload } from '@/core/crypto/aes'
import {
  openProfileDb,
  type EntityType,
  type ProfileEntityRow,
} from '@/core/db/profile-db'

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    'iv' in value &&
    'ct' in value &&
    typeof (value as EncryptedPayload).iv === 'string' &&
    typeof (value as EncryptedPayload).ct === 'string'
  )
}

export interface EntityRecord<TData> {
  id: string
  type: EntityType
  updatedAt: string
  data: TData
  sensitive?: boolean
}

export class EncryptedRepo {
  private readonly key: CryptoKey | null
  private readonly profileId: string

  constructor(profileId: string, key: CryptoKey | null) {
    this.profileId = profileId
    this.key = key
  }

  private table(): Table<ProfileEntityRow, string> {
    return openProfileDb(this.profileId).entities
  }

  private async encode(data: unknown): Promise<{
    payload: unknown | EncryptedPayload
    encrypted: boolean
  }> {
    if (!this.key) return { payload: plain(data), encrypted: false }
    const ciphertext = await encryptJson(this.key, data)
    return { payload: ciphertext, encrypted: true }
  }

  private async decode<T>(row: ProfileEntityRow): Promise<T> {
    if (row.encrypted) {
      if (!this.key) {
        throw new Error('Şifreli kayıt; profil kilidi açık değil.')
      }
      if (!isEncryptedPayload(row.payload)) {
        throw new Error('Şifreli kayıt formatı bozuk.')
      }
      return decryptJson<T>(this.key, row.payload)
    }
    return row.payload as T
  }

  async put<T>(record: EntityRecord<T>): Promise<void> {
    await this.putMany([record])
  }

  /** Atomik toplu yazım — tek Dexie transaction. */
  async putMany<T>(records: EntityRecord<T>[]): Promise<void> {
    if (records.length === 0) return
    const rows = await Promise.all(
      records.map(async (record) => {
        const { payload, encrypted } = await this.encode(record.data)
        const row: ProfileEntityRow = {
          id: record.id,
          type: record.type,
          updatedAt: record.updatedAt,
          encrypted,
          payload,
          ...(record.sensitive ? { sensitive: true } : {}),
        }
        return row
      }),
    )
    const db = openProfileDb(this.profileId)
    await db.transaction('rw', db.entities, async () => {
      await db.entities.bulkPut(rows)
    })
  }

  async get<T>(id: string): Promise<EntityRecord<T> | undefined> {
    const row = await this.table().get(id)
    if (!row) return undefined
    return this.toRecord<T>(row)
  }

  async list<T>(type: EntityType): Promise<EntityRecord<T>[]> {
    const rows = await this.table().where('type').equals(type).toArray()
    return Promise.all(rows.map((row) => this.toRecord<T>(row)))
  }

  async delete(id: string): Promise<void> {
    await this.table().delete(id)
  }

  async clear(): Promise<void> {
    await this.table().clear()
  }

  async exportAllRaw(): Promise<ProfileEntityRow[]> {
    return this.table().toArray()
  }

  /** AI snapshot / export öncesi: tüm kayıtları çözülmüş veri olarak döner. */
  async exportAllDecoded(): Promise<
    Array<{ id: string; type: EntityType; sensitive?: boolean; updatedAt: string; data: unknown }>
  > {
    const rows = await this.table().toArray()
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        type: row.type,
        sensitive: row.sensitive,
        updatedAt: row.updatedAt,
        data: await this.decode(row),
      })),
    )
  }

  private async toRecord<T>(row: ProfileEntityRow): Promise<EntityRecord<T>> {
    return {
      id: row.id,
      type: row.type,
      updatedAt: row.updatedAt,
      data: await this.decode<T>(row),
      sensitive: row.sensitive,
    }
  }
}

/** Profilde en az bir düz (encrypted: false) entity var mı. */
export async function profileHasPlainEntityRows(profileId: string): Promise<boolean> {
  const db = openProfileDb(profileId)
  const rows = await db.entities.toArray()
  return rows.some((row) => !row.encrypted)
}

/**
 * Profil DB'sindeki tüm kayıtları kaynak `fromKey` ile decrypt edip hedef `toKey` ile
 * yeniden şifreler (veya `toKey === null` ise düz yazar). Parola değişimi / ekleme /
 * kaldırma akışlarında tek noktadan çağrılır.
 */
export async function reencryptAll(
  profileId: string,
  fromKey: CryptoKey | null,
  toKey: CryptoKey | null,
): Promise<void> {
  const db = openProfileDb(profileId)
  const rows = await db.entities.toArray()
  if (rows.length === 0) return

  const updated: ProfileEntityRow[] = []
  for (const row of rows) {
    let data: unknown
    if (row.encrypted) {
      if (!fromKey) throw new Error('Şifreli kayıt; kaynak anahtar gerekli.')
      if (!isEncryptedPayload(row.payload)) throw new Error('Şifreli kayıt formatı bozuk.')
      data = await decryptJson(fromKey, row.payload)
    } else {
      data = row.payload
    }

    if (toKey) {
      const ct = await encryptJson(toKey, data)
      updated.push({ ...row, encrypted: true, payload: ct })
    } else {
      updated.push({ ...row, encrypted: false, payload: plain(data) })
    }
  }
  await db.transaction('rw', db.entities, async () => {
    await db.entities.bulkPut(updated)
  })
}
