import {
  clearStoredSyncHandle,
  ensureHandlePermission,
  getStoredSyncHandle,
  saveSyncHandle,
  type StoredSyncHandle,
} from '@/core/services/sync/sync-handle-store'
import {
  buildSyncEnvelope,
  parseSyncEnvelope,
  serializeSyncEnvelope,
  verifySyncEnvelope,
} from '@/core/services/sync/sync-envelope'
import {
  buildSnapshot,
  decodeSnapshotFile,
  encodeSnapshotFile,
  importSnapshot,
} from '@/core/services/snapshot'
import type { ProfileMeta } from '@/core/types/profile'
import type { SyncConfig, SyncFileEnvelope, SyncMode } from '@/core/types/sync'
import { newId } from '@/core/util/id'

export const SYNC_FILE_EXTENSION = '.sync'

export function supportsSyncFilePicker(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/** Tarayıcı yeteneğine göre senkron modu; FS Access yoksa manuel zorunlu. */
export function resolveSyncMode(preferred: SyncMode = 'handle'): SyncMode {
  if (!supportsSyncFilePicker()) return 'manual'
  return preferred
}

export function defaultSyncFileName(profileName: string): string {
  const slug = profileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F_-]+/g, '')
    .slice(0, 48)
  return `KurtarmaPlani-${slug || 'profil'}${SYNC_FILE_EXTENSION}`
}

const syncPickerTypes: FilePickerAcceptType[] = [
  {
    description: 'Kurtarma Planı senkron',
    accept: { 'application/json': ['.sync', '.json'] },
  },
]

export async function pickSyncFileHandle(profileId: string): Promise<StoredSyncHandle> {
  const openPicker = window.showOpenFilePicker
  if (!openPicker) {
    throw new Error('Bu tarayıcı dosya seçiciyi desteklemiyor.')
  }
  const [handle] = await openPicker({
    types: syncPickerTypes,
    multiple: false,
  })
  const fileName = handle.name
  await saveSyncHandle(profileId, handle, fileName)
  return { handle, fileName }
}

export async function createSyncFileHandle(
  profileId: string,
  suggestedName: string,
): Promise<StoredSyncHandle> {
  const savePicker = window.showSaveFilePicker
  if (!savePicker) {
    throw new Error('Bu tarayıcı dosya oluşturmayı desteklemiyor.')
  }
  const handle = await savePicker({
    suggestedName,
    types: syncPickerTypes,
  })
  const fileName = handle.name
  await saveSyncHandle(profileId, handle, fileName)
  return { handle, fileName }
}

export async function readSyncFileText(handle: FileSystemFileHandle): Promise<string> {
  const allowed = await ensureHandlePermission(handle, 'read')
  if (!allowed) throw new Error('Senkron dosyası okuma izni verilmedi.')
  const file = await handle.getFile()
  return file.text()
}

export async function writeSyncFileText(
  handle: FileSystemFileHandle,
  contents: string,
): Promise<void> {
  const allowed = await ensureHandlePermission(handle, 'readwrite')
  if (!allowed) throw new Error('Senkron dosyası yazma izni verilmedi.')
  const writable = await handle.createWritable()
  await writable.write(contents)
  await writable.close()
}

export async function readSyncEnvelopeFromText(text: string): Promise<SyncFileEnvelope | null> {
  if (!text.trim()) return null
  const envelope = parseSyncEnvelope(text)
  if (!envelope) return null
  if (!(await verifySyncEnvelope(envelope))) {
    throw new Error('Senkron dosyası bütünlük kontrolünden geçmedi (bozulmuş olabilir).')
  }
  return envelope
}

export async function readSyncEnvelopeFromHandle(
  handle: FileSystemFileHandle,
): Promise<SyncFileEnvelope | null> {
  const text = await readSyncFileText(handle)
  return readSyncEnvelopeFromText(text)
}

export async function readSyncEnvelopeFromFile(file: File): Promise<SyncFileEnvelope | null> {
  const text = await file.text()
  return readSyncEnvelopeFromText(text)
}

export function downloadSyncFile(contents: string, fileName: string): void {
  const name = fileName.endsWith(SYNC_FILE_EXTENSION) ? fileName : `${fileName}${SYNC_FILE_EXTENSION}`
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function resolveSyncFilePasswordError(
  config: SyncConfig,
  profileHasPassword: boolean,
  password?: string,
): string | null {
  if (!config.encryptFile) return null
  if (config.useProfilePassword && profileHasPassword) {
    if (!password?.trim()) return 'Senkron parolası gerekli (profil parolası).'
    return null
  }
  if (!password || password.length < 6) {
    return 'Senkron dosyası parolası en az 6 karakter olmalı.'
  }
  return null
}


export interface SyncPushParams {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  deviceId: string
  config: SyncConfig
  filePassword?: string
}

export async function buildSyncPushContent(
  params: SyncPushParams & { fileName: string },
): Promise<{
  revision: string
  fileName: string
  contents: string
}> {
  const pwdError = resolveSyncFilePasswordError(
    params.config,
    params.profile.password.enabled,
    params.filePassword,
  )
  if (pwdError) throw new Error(pwdError)

  const snapshot = await buildSnapshot(
    {
      includeSensitive: params.config.includeSensitive,
      includeSecrets: params.config.includeSecrets,
      encryptFile: false,
    },
    { profile: params.profile, key: params.dataKey },
  )

  const innerJson = await encodeSnapshotFile(snapshot, {
    encryptFile: params.config.encryptFile,
    password: params.config.encryptFile ? params.filePassword : undefined,
  })

  const revision = newId()
  const envelope = await buildSyncEnvelope({
    profileId: params.profile.id,
    profileName: params.profile.name,
    deviceId: params.deviceId,
    revision,
    innerPayloadJson: innerJson,
    encryptFile: params.config.encryptFile,
  })

  return {
    revision,
    fileName: params.fileName,
    contents: serializeSyncEnvelope(envelope),
  }
}

export async function pushSync(
  params: SyncPushParams & { handle: FileSystemFileHandle },
): Promise<{
  revision: string
  fileName: string
}> {
  const { revision, fileName, contents } = await buildSyncPushContent({
    ...params,
    fileName: params.handle.name,
  })
  await writeSyncFileText(params.handle, contents)
  return { revision, fileName }
}

export interface SyncPullParams {
  envelope: SyncFileEnvelope
  profile: ProfileMeta
  dataKey: CryptoKey | null
  filePassword?: string
  /** Dosyadaki profil kimliği farklı olsa da aktif profile içe aktar. */
  allowProfileAdopt?: boolean
}

export async function pullSync(params: SyncPullParams): Promise<void> {
  if (!params.allowProfileAdopt && params.envelope.profileId !== params.profile.id) {
    throw new Error(
      'Senkron dosyası farklı bir profile ait. Doğru profili açın veya başka dosya seçin.',
    )
  }

  const decoded = await decodeSnapshotFile(params.envelope.payload, params.filePassword)
  if (!decoded.ok) {
    if (decoded.reason === 'needs-password') {
      throw new Error('Şifreli senkron dosyası; parola gerekli.')
    }
    throw new Error(decoded.message)
  }

  await importSnapshot(decoded.snapshot, {
    overwriteProfileId: params.profile.id,
    dataKey: params.dataKey,
  })
}

export async function reloadStoresAfterSyncPull(): Promise<void> {
  const { useEntitiesStore } = await import('@/stores/entities')
  useEntitiesStore().reset()
  const { useAiStore } = await import('@/stores/ai')
  useAiStore().reset()
  const { useProfileStore } = await import('@/stores/profile')
  const profileStore = useProfileStore()
  if (profileStore.activeProfileId) {
    await useAiStore().load()
  }
  await profileStore.load()
}

export async function getActiveSyncHandle(
  profileId: string,
): Promise<StoredSyncHandle | null> {
  return getStoredSyncHandle(profileId)
}

export { clearStoredSyncHandle, getStoredSyncHandle, saveSyncHandle }
