import {
  ENCRYPTED_FILE_MAGIC,
  PLAIN_FILE_MAGIC,
} from '@/core/types/export'
import {
  SYNC_FILE_MAGIC,
  SYNC_SCHEMA_VERSION,
  SyncFileEnvelopeSchema,
  type SyncFileEnvelope,
} from '@/core/types/sync'
import { sha256Hex } from '@/core/services/sync/sync-crypto'

export function parseSyncEnvelope(text: string): SyncFileEnvelope | null {
  try {
    const raw = JSON.parse(text) as unknown
    const parsed = SyncFileEnvelopeSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function buildSyncEnvelope(input: {
  profileId: string
  profileName: string
  deviceId: string
  revision: string
  innerPayloadJson: string
  encryptFile: boolean
}): Promise<SyncFileEnvelope> {
  const contentSha256 = await sha256Hex(input.innerPayloadJson)
  return {
    magic: SYNC_FILE_MAGIC,
    schemaVersion: SYNC_SCHEMA_VERSION,
    contentMagic: input.encryptFile ? ENCRYPTED_FILE_MAGIC : PLAIN_FILE_MAGIC,
    profileId: input.profileId,
    profileName: input.profileName,
    revision: input.revision,
    deviceId: input.deviceId,
    writtenAt: new Date().toISOString(),
    contentSha256,
    payload: input.innerPayloadJson,
  }
}

export async function verifySyncEnvelope(envelope: SyncFileEnvelope): Promise<boolean> {
  const hash = await sha256Hex(envelope.payload)
  return hash.toLowerCase() === envelope.contentSha256.toLowerCase()
}

export function serializeSyncEnvelope(envelope: SyncFileEnvelope): string {
  return JSON.stringify(envelope, null, 2)
}
