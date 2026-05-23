/** BrandMark ile uyumlu; build'de harici dosya gerektirmez (data URI). */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Kurtarma Planı">
  <rect width="32" height="32" rx="8" fill="#1677ff"/>
  <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7 22V16"/>
    <path d="M13 22V10"/>
    <path d="M19 22v-5"/>
    <path d="M6 22H26"/>
    <path d="M20 10.5 23.5 7"/>
    <path d="M23.5 7H21"/>
    <path d="M23.5 7V9"/>
  </g>
</svg>`

export const FAVICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`

export function applyEmbeddedFavicon(): void {
  if (typeof document === 'undefined') return

  for (const rel of ['icon', 'apple-touch-icon'] as const) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement('link')
      link.rel = rel
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = FAVICON_DATA_URL
  }
}
