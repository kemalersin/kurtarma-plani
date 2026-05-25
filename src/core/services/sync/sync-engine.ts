import type { ProfileMeta } from '@/core/types/profile'
import type { SyncConfig, SyncFileEnvelope } from '@/core/types/sync'
import {
  buildSyncPushContent,
  downloadSyncFile,
  pullSync,
  pushSync,
  readSyncEnvelopeFromHandle,
  reloadStoresAfterSyncPull,
} from '@/core/services/sync/sync-file'

export function envelopeProfileMismatch(
  envelope: SyncFileEnvelope | null,
  profileId: string,
): boolean {
  return !!envelope && envelope.profileId !== profileId
}

export function remoteRevisionChanged(
  envelope: SyncFileEnvelope | null,
  profileId: string,
  knownRevision: string | undefined,
): boolean {
  if (!envelope || envelope.profileId !== profileId) return false
  if (!knownRevision) return true
  return envelope.revision !== knownRevision
}

export interface ManualModePushParams {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  deviceId: string
  config: SyncConfig
  fileName: string
  filePassword?: string
}

export async function runManualModePush(params: ManualModePushParams): Promise<{
  revision: string
  fileName: string
}> {
  const { revision, fileName, contents } = await buildSyncPushContent({
    profile: params.profile,
    dataKey: params.dataKey,
    deviceId: params.deviceId,
    config: params.config,
    filePassword: params.filePassword,
    fileName: params.fileName,
  })
  downloadSyncFile(contents, fileName)
  return { revision, fileName }
}

export interface PullFromEnvelopeParams {
  envelope: SyncFileEnvelope
  profile: ProfileMeta
  dataKey: CryptoKey | null
  filePassword?: string
  allowProfileAdopt?: boolean
}

export async function runPullFromEnvelope(params: PullFromEnvelopeParams): Promise<void> {
  await pullSync({
    envelope: params.envelope,
    profile: params.profile,
    dataKey: params.dataKey,
    filePassword: params.filePassword,
    allowProfileAdopt: params.allowProfileAdopt,
  })
  await reloadStoresAfterSyncPull()
}

export interface ManualModePullParams {
  envelope: SyncFileEnvelope
  profile: ProfileMeta
  dataKey: CryptoKey | null
  config: SyncConfig
  filePassword?: string
  allowProfileAdopt?: boolean
}

export async function runManualModePull(params: ManualModePullParams): Promise<boolean> {
  if (
    !params.allowProfileAdopt &&
    envelopeProfileMismatch(params.envelope, params.profile.id)
  ) {
    throw new Error(
      'Senkron dosyası farklı bir profile ait. Doğru profili açın veya başka dosya seçin.',
    )
  }

  if (params.allowProfileAdopt) {
    await runPullFromEnvelope({
      envelope: params.envelope,
      profile: params.profile,
      dataKey: params.dataKey,
      filePassword: params.filePassword,
      allowProfileAdopt: true,
    })
    return true
  }

  if (
    envelopeProfileMismatch(params.envelope, params.profile.id) ||
    !remoteRevisionChanged(
      params.envelope,
      params.profile.id,
      params.config.remoteRevisionByProfile[params.profile.id],
    )
  ) {
    return false
  }

  await runPullFromEnvelope({
    envelope: params.envelope,
    profile: params.profile,
    dataKey: params.dataKey,
    filePassword: params.filePassword,
  })
  return true
}

export interface ManualModeSyncParams {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  deviceId: string
  config: SyncConfig
  fileName: string
  filePassword?: string
  remoteEnvelope: SyncFileEnvelope | null
  pullRemote: boolean
}

export async function runManualModeSync(params: ManualModeSyncParams): Promise<ManualSyncResult> {
  const remote = params.remoteEnvelope

  if (envelopeProfileMismatch(remote, params.profile.id)) {
    throw new Error(
      'Senkron dosyası farklı bir profile ait. Doğru profili açın veya başka dosya seçin.',
    )
  }

  let pulled = false
  if (
    params.pullRemote &&
    remote &&
    remoteRevisionChanged(
      remote,
      params.profile.id,
      params.config.remoteRevisionByProfile[params.profile.id],
    )
  ) {
    await runPullFromEnvelope({
      envelope: remote,
      profile: params.profile,
      dataKey: params.dataKey,
      filePassword: params.filePassword,
    })
    pulled = true
  }

  const { revision, fileName } = await runManualModePush({
    profile: params.profile,
    dataKey: params.dataKey,
    deviceId: params.deviceId,
    config: params.config,
    fileName: params.fileName,
    filePassword: params.filePassword,
  })

  return { pulled, revision, fileName }
}

export interface ManualSyncParams {
  handle: FileSystemFileHandle
  profile: ProfileMeta
  dataKey: CryptoKey | null
  deviceId: string
  config: SyncConfig
  filePassword?: string
  pullRemote: boolean
}

export interface ManualSyncResult {
  pulled: boolean
  revision: string
  fileName: string
}

export async function runManualSync(params: ManualSyncParams): Promise<ManualSyncResult> {
  const remote = await readSyncEnvelopeFromHandle(params.handle)

  if (envelopeProfileMismatch(remote, params.profile.id)) {
    throw new Error(
      'Senkron dosyası farklı bir profile ait. Doğru profili açın veya başka dosya seçin.',
    )
  }

  let pulled = false
  if (
    params.pullRemote &&
    remote &&
    remoteRevisionChanged(
      remote,
      params.profile.id,
      params.config.remoteRevisionByProfile[params.profile.id],
    )
  ) {
    await pullSync({
      envelope: remote,
      profile: params.profile,
      dataKey: params.dataKey,
      filePassword: params.filePassword,
    })
    await reloadStoresAfterSyncPull()
    pulled = true
  }

  const { revision, fileName } = await pushSync({
    handle: params.handle,
    profile: params.profile,
    dataKey: params.dataKey,
    deviceId: params.deviceId,
    config: params.config,
    filePassword: params.filePassword,
  })

  return { pulled, revision, fileName }
}

export interface PullSyncParams {
  handle: FileSystemFileHandle
  profile: ProfileMeta
  dataKey: CryptoKey | null
  config: SyncConfig
  filePassword?: string
  allowProfileAdopt?: boolean
}

export async function runPullSync(params: PullSyncParams): Promise<boolean> {
  const remote = await readSyncEnvelopeFromHandle(params.handle)

  if (
    !params.allowProfileAdopt &&
    envelopeProfileMismatch(remote, params.profile.id)
  ) {
    throw new Error(
      'Senkron dosyası farklı bir profile ait. Doğru profili açın veya başka dosya seçin.',
    )
  }

  if (!remote) return false

  if (params.allowProfileAdopt) {
    await pullSync({
      envelope: remote,
      profile: params.profile,
      dataKey: params.dataKey,
      filePassword: params.filePassword,
      allowProfileAdopt: true,
    })
    await reloadStoresAfterSyncPull()
    return true
  }

  if (
    envelopeProfileMismatch(remote, params.profile.id) ||
    !remoteRevisionChanged(
      remote,
      params.profile.id,
      params.config.remoteRevisionByProfile[params.profile.id],
    )
  ) {
    return false
  }

  await pullSync({
    envelope: remote,
    profile: params.profile,
    dataKey: params.dataKey,
    filePassword: params.filePassword,
  })
  await reloadStoresAfterSyncPull()
  return true
}

export interface PushSyncParams {
  handle: FileSystemFileHandle
  profile: ProfileMeta
  dataKey: CryptoKey | null
  deviceId: string
  config: SyncConfig
  filePassword?: string
}

export async function runPushSync(params: PushSyncParams): Promise<{
  revision: string
  fileName: string
}> {
  return pushSync({
    handle: params.handle,
    profile: params.profile,
    dataKey: params.dataKey,
    deviceId: params.deviceId,
    config: params.config,
    filePassword: params.filePassword,
  })
}

export { readSyncEnvelopeFromHandle }
