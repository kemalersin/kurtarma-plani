import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchModelsDevCatalog } from '../src/features/ai/catalog-extract'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../src/data/models-catalog')
const BUNDLED_PATH = join(OUT_DIR, 'bundled.json')
const GENERATED_PATH = join(OUT_DIR, 'generated.json')

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  const writeGenerated = process.env.FETCH_MODELS === '1'

  try {
    const catalog = await fetchModelsDevCatalog()
    const json = JSON.stringify(catalog, null, 2)

    if (writeGenerated) {
      writeFileSync(GENERATED_PATH, json)
      console.log(`[models] generated → ${GENERATED_PATH}`)
    }

    if (!existsSync(BUNDLED_PATH)) {
      writeFileSync(BUNDLED_PATH, json)
      console.log(`[models] initial bundled → ${BUNDLED_PATH}`)
    }
  } catch (error) {
    if (writeGenerated) {
      console.error('[models] fetch failed:', error instanceof Error ? error.message : error)
      process.exitCode = 1
    } else if (!existsSync(BUNDLED_PATH)) {
      console.error('[models] no bundled.json and fetch skipped')
      process.exitCode = 1
    } else {
      console.warn('[models] fetch skipped; using existing bundled.json')
    }
  }
}

void main()
