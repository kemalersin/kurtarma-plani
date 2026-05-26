const UNRELEASED_HEADING = '## [Unreleased]'
const UNRELEASED_HEADING_RE = /^## \[Unreleased\]$/m

export function promoteUnreleasedChangelog(
  content: string,
  version: string,
): { content: string; promoted: boolean; body: string } {
  const headingMatch = content.match(UNRELEASED_HEADING_RE)
  if (!headingMatch || headingMatch.index === undefined) {
    throw new Error('CHANGELOG.md: ## [Unreleased] bölümü bulunamadı.')
  }
  const unreleasedIdx = headingMatch.index

  if (content.includes(`## [${version}]`)) {
    throw new Error(`CHANGELOG.md: ## [${version}] zaten var.`)
  }

  const afterHeading = unreleasedIdx + UNRELEASED_HEADING.length
  const rest = content.slice(afterHeading)
  const nextSection = rest.search(/^## \[/m)
  const unreleasedEnd = nextSection === -1 ? rest.length : nextSection
  const body = rest.slice(0, unreleasedEnd).trim()

  if (!body) {
    return { content, promoted: false, body: '' }
  }

  const tail = rest.slice(unreleasedEnd).replace(/^\s+/, '')
  const head = content.slice(0, afterHeading).replace(/\s+$/, '')
  const promotedContent = `${head}\n\n## [${version}]\n\n${body}\n\n${tail}`

  return { content: promotedContent, promoted: true, body }
}
