import Dexie, { type Table } from 'dexie'
import { PROFILE_DB_PREFIX } from '@/core/constants'
import type { EncryptedPayload } from '@/core/crypto/aes'

export type EntityType =
  | 'aiSettings'
  | 'aiUsage'
  | 'chatSession'
  | 'bank'
  | 'account'
  | 'cashRegister'
  | 'loan'
  | 'loanPayment'
  | 'creditCard'
  | 'creditCardTransaction'
  | 'cashAdvanceAccount'
  | 'cashAdvanceTransaction'
  | 'installmentCashAdvance'
  | 'installmentCashAdvancePayment'
  | 'income'
  | 'incomeType'
  | 'expense'
  | 'expenseType'
  | 'transfer'

/**
 * Profil DB satırı.
 * - `payload`: parolasız profillerde plain JSON, parolalı profillerde AES-GCM ile şifrelenmiş.
 */
export interface ProfileEntityRow {
  id: string
  type: EntityType
  updatedAt: string
  encrypted: boolean
  payload: unknown | EncryptedPayload
  sensitive?: boolean
}

class ProfileDatabase extends Dexie {
  entities!: Table<ProfileEntityRow, string>

  constructor(profileId: string) {
    super(`${PROFILE_DB_PREFIX}${profileId}`)
    this.version(1).stores({
      entities: '&id, type, updatedAt, sensitive',
    })
  }
}

const opened = new Map<string, ProfileDatabase>()

export function openProfileDb(profileId: string): ProfileDatabase {
  let db = opened.get(profileId)
  if (!db) {
    db = new ProfileDatabase(profileId)
    opened.set(profileId, db)
  }
  return db
}

export async function closeProfileDb(profileId: string): Promise<void> {
  const db = opened.get(profileId)
  if (!db) return
  db.close()
  opened.delete(profileId)
}

export async function deleteProfileDb(profileId: string): Promise<void> {
  await closeProfileDb(profileId)
  await Dexie.delete(`${PROFILE_DB_PREFIX}${profileId}`)
}
