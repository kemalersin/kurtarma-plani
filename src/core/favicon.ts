/** Navbar BrandMark ile uyumlu; build'de harici dosya gerektirmez (data URI). */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Kurtarma Planı">
  <rect width="32" height="32" rx="7" fill="#1677ff"/>
  <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 23V15"/>
    <path d="M14 23V9"/>
    <path d="M19 23v-6"/>
    <path d="M26 23H6"/>
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
