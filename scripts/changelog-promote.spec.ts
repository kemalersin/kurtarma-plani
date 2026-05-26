import { describe, expect, it } from 'vitest'
import { promoteUnreleasedChangelog } from './changelog-promote'

const PREAMBLE = `# Changelog

Format örnek.

`

describe('promoteUnreleasedChangelog', () => {
  it('taşır ve [Unreleased] boşaltır', () => {
    const input = `${PREAMBLE}## [Unreleased]

### Fixed — örnek

- madde 1

## [0.1.25]

### Added

- eski
`

    const { content, promoted, body } = promoteUnreleasedChangelog(input, '0.1.26')

    expect(promoted).toBe(true)
    expect(body).toContain('madde 1')
    expect(content).toContain('## [Unreleased]\n\n## [0.1.26]\n\n### Fixed — örnek')
    expect(content).toContain('## [0.1.25]')
    expect(content).toMatch(/## \[Unreleased\]\n\n## \[0\.1\.26\]/)
  })

  it('boş [Unreleased] için değişiklik yapmaz', () => {
    const input = `${PREAMBLE}## [Unreleased]

## [0.1.25]
`
    const { content, promoted } = promoteUnreleasedChangelog(input, '0.1.26')
    expect(promoted).toBe(false)
    expect(content).toBe(input)
  })

  it('hedef sürüm zaten varsa hata verir', () => {
    const input = `${PREAMBLE}## [Unreleased]

- yeni

## [0.1.26]
`
    expect(() => promoteUnreleasedChangelog(input, '0.1.26')).toThrow(/zaten var/)
  })
})
