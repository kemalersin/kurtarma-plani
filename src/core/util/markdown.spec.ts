/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/core/util/markdown'

describe('renderMarkdown json highlighting', () => {
  it('json code fence gets syntax highlight spans', () => {
    const html = renderMarkdown('```json\n{"name": "test", "count": 42}\n```')
    expect(html).toContain('kp-json-block')
    expect(html).toContain('kp-json__key')
    expect(html).toContain('kp-json__string')
    expect(html).toContain('kp-json__number')
  })

  it('non-json code fence stays plain', () => {
    const html = renderMarkdown('```typescript\nconst x = 1\n```')
    expect(html).not.toContain('kp-json__key')
    expect(html).toContain('<pre')
  })
})
