import { z } from 'zod'
import { APP_GITHUB_PAGES_RAW_INDEX_URL, APP_GITHUB_PACKAGE_JSON_URL } from '@/core/constants'
import { compareVersions, normalizeVersionTag } from '@/core/services/version-compare'

const PackageJsonSchema = z.object({
  version: z.string().min(1),
})

export interface RemoteVersionInfo {
  version: string
  releaseUrl: string
}

async function fetchPackageJsonVersion(): Promise<string> {
  const res = await fetch(APP_GITHUB_PACKAGE_JSON_URL)
  if (!res.ok) {
    throw new Error(`GitHub package.json okunamadı (${res.status}).`)
  }
  const json: unknown = await res.json()
  const parsed = PackageJsonSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('GitHub package.json yanıtı geçersiz.')
  }
  return normalizeVersionTag(parsed.data.version)
}

/** GitHub main branch package.json sürümü. */
export async function fetchRemoteAppVersion(): Promise<RemoteVersionInfo> {
  const version = await fetchPackageJsonVersion()
  return {
    version,
    releaseUrl: APP_GITHUB_PAGES_RAW_INDEX_URL,
  }
}

export function remoteUpdateFingerprint(version: string): string {
  return version
}

/** Uzak package.json sürümü daha yeni mi? */
export function isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
  return compareVersions(localVersion, remoteVersion) < 0
}
