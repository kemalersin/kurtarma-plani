import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promoteUnreleasedChangelog } from './changelog-promote'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CHANGELOG = join(ROOT, 'CHANGELOG.md')
const PACKAGE_JSON = join(ROOT, 'package.json')

function main(): void {
  const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as { version: string }
  const source = readFileSync(CHANGELOG, 'utf-8')
  const { content, promoted, body } = promoteUnreleasedChangelog(source, version)

  if (!promoted) {
    console.warn(`[changelog] [Unreleased] boş; CHANGELOG.md değiştirilmedi (${version}).`)
    return
  }

  writeFileSync(CHANGELOG, content)
  const lines = body.split('\n').filter((line) => line.trim()).length
  console.log(`[changelog] [Unreleased] → [${version}] (${lines} satır taşındı)`)
}

main()
