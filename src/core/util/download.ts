import { APP_GITHUB_PAGES_RAW_INDEX_URL } from '@/core/constants'

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export type AppReleaseDownloadResult =
  | { status: 'downloaded'; fileName: string }
  | { status: 'fallback-open' }

/** Metin dosyasını tarayıcıda indirir. */
export function downloadTextFile(
  contents: string,
  fileName: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  triggerBlobDownload(new Blob([contents], { type: mimeType }), fileName)
}

/** Uzak URL içeriğini indirir (CORS izin vermeli). */
export async function downloadFileFromUrl(url: string, fileName: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Dosya indirilemedi (${res.status}).`)
  }
  triggerBlobDownload(await res.blob(), fileName)
}

/** pages dalı index.html dosya adı. */
export function appReleaseFileName(version: string): string {
  const safe = version.replace(/[^\d.A-Za-z-]+/g, '')
  return `kurtarma-plani-v${safe || 'latest'}.html`
}

/** GitHub pages dalındaki güncel index.html; başarısız olursa URL yeni sekmede açılır. */
export async function downloadAppReleaseIndex(options?: {
  url?: string
  version?: string
}): Promise<AppReleaseDownloadResult> {
  const url = options?.url ?? APP_GITHUB_PAGES_RAW_INDEX_URL
  const fileName = appReleaseFileName(options?.version ?? 'latest')
  try {
    await downloadFileFromUrl(url, fileName)
    return { status: 'downloaded', fileName }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
    return { status: 'fallback-open' }
  }
}

/** Profil adından dosya adı parçası üretir. */
export function profileFileSlug(name: string): string {
  return name.replace(/[^\w\u0080-\uFFFF]+/gu, '-').replace(/^-+|-+$/g, '') || 'profil'
}
