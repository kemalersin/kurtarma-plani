import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

let hooksInstalled = false

function installDomPurifyHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  hooksInstalled = true
}

/** Güvenli Markdown → HTML (AI sohbet balonları için). */
export function renderMarkdown(source: string): string {
  if (!source.trim()) return ''
  installDomPurifyHooks()
  const raw = marked.parse(source, { async: false }) as string
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
  })
}
