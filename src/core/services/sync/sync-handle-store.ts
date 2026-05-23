import { metaDb } from '@/core/db/meta'

export interface StoredSyncHandle {
  handle: FileSystemFileHandle
  fileName: string
}

interface SyncHandleRow {
  key: string
  handle: FileSystemFileHandle
  fileName: string
}

export async function saveSyncHandle(
  profileId: string,
  handle: FileSystemFileHandle,
  fileName: string,
): Promise<void> {
  const row: SyncHandleRow = { key: profileId, handle, fileName }
  await metaDb.syncHandles.put(row)
}

export async function getStoredSyncHandle(
  profileId: string,
): Promise<StoredSyncHandle | null> {
  const row = await metaDb.syncHandles.get(profileId)
  if (!row) return null
  return { handle: row.handle, fileName: row.fileName }
}

export async function clearStoredSyncHandle(profileId: string): Promise<void> {
  await metaDb.syncHandles.delete(profileId)
}

export async function ensureHandlePermission(
  handle: FileSystemFileHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const current = await handle.queryPermission({ mode })
  if (current === 'granted') return true
  const requested = await handle.requestPermission({ mode })
  return requested === 'granted'
}
