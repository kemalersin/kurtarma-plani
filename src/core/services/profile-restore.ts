import {
  decodeSnapshotFile,
  importSnapshot,
  type ImportSnapshotOptions,
  type ImportSummary,
} from '@/core/services/snapshot'
import { parseSyncEnvelope, verifySyncEnvelope } from '@/core/services/sync/sync-envelope'
import type { SyncFileEnvelope } from '@/core/types/sync'

export type ProfileRestoreKind = 'backup' | 'sync'

export interface ProfileRestoreOutcome {
  summary: ImportSummary
  syncEnvelope?: SyncFileEnvelope
}

const setupImportOptions: ImportSnapshotOptions = {
  preserveProfileId: true,
}

export async function restoreProfileFromText(
  text: string,
  kind: ProfileRestoreKind,
  password?: string,
): Promise<ProfileRestoreOutcome> {
  if (kind === 'sync') {
    const envelope = parseSyncEnvelope(text)
    if (!envelope) {
      throw new Error('Geçerli senkron dosyası değil (KP-SYNC1 bekleniyor).')
    }
    if (!(await verifySyncEnvelope(envelope))) {
      throw new Error('Senkron dosyası bütünlük kontrolünden geçmedi.')
    }
    const decoded = await decodeSnapshotFile(envelope.payload, password)
    if (!decoded.ok) {
      if (decoded.reason === 'needs-password') {
        throw new Error('NEEDS_PASSWORD')
      }
      throw new Error(decoded.message)
    }
    const summary = await importSnapshot(decoded.snapshot, setupImportOptions)
    return { summary, syncEnvelope: envelope }
  }

  const decoded = await decodeSnapshotFile(text, password)
  if (!decoded.ok) {
    if (decoded.reason === 'needs-password') {
      throw new Error('NEEDS_PASSWORD')
    }
    throw new Error(decoded.message)
  }
  const summary = await importSnapshot(decoded.snapshot, setupImportOptions)
  return { summary }
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text()
}
