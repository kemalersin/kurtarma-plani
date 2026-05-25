import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BankingPresetSchema } from '../src/core/types/banking-preset'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BUNDLED = join(ROOT, 'src/data/banking-presets/tr-2026-01.json')
const FEED = join(ROOT, 'banking-presets/tr-latest.json')

function main(): void {
  const raw = JSON.parse(readFileSync(BUNDLED, 'utf-8')) as unknown
  const parsed = BankingPresetSchema.parse(raw)
  const { source: _source, fetchedAt: _fetchedAt, ...feed } = parsed
  writeFileSync(FEED, `${JSON.stringify(feed, null, 2)}\n`)
  console.log(`[banking-preset] feed → ${FEED}`)
}

main()
