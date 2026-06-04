import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { highlightJson } from '@/core/util/json-highlight'

marked.setOptions({
  gfm: true,
  breaks: true,
})

function isJsonFenceLang(lang: string | undefined): boolean {
  const normalized = (lang ?? '').toLowerCase()
  return normalized === 'json' || normalized === 'kp-proposals'
}

marked.use({
  renderer: {
    code({ text, lang }) {
      if (!isJsonFenceLang(lang)) return false
      return `<pre class="kp-json-block"><code>${highlightJson(text)}</code></pre>\n`
    },
  },
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
