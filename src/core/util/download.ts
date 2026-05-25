/** Metin dosyasını tarayıcıda indirir. */
export function downloadTextFile(
  contents: string,
  fileName: string,
  mimeType = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Profil adından dosya adı parçası üretir. */
export function profileFileSlug(name: string): string {
  return name.replace(/[^\w\u0080-\uFFFF]+/gu, '-').replace(/^-+|-+$/g, '') || 'profil'
}
