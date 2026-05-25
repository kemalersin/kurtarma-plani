/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/core/util/markdown'

describe('renderMarkdown', () => {
  it('bold ve liste render eder', () => {
    const html = renderMarkdown('- **Toplam borç:** 12.000 TL')
    expect(html).toContain('<strong>Toplam borç:</strong>')
    expect(html).toContain('<ul>')
  })

  it('ham script etiketlerini temizler', () => {
    const html = renderMarkdown('Merhaba<script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).toContain('Merhaba')
  })
})
