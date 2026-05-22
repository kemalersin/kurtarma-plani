import {
  clearActiveModelsCatalogRow,
  getActiveModelsCatalogRow,
  putActiveModelsCatalogRow,
} from '@/core/db/meta'
import type { ModelsCatalog, ModelsCatalogSource } from '@/core/types/ai-catalog'
import { EMBEDDED_MODELS_CATALOG } from '@/data/models-catalog'
import { fetchModelsDevCatalog } from '@/features/ai/catalog-extract'

export interface ActiveModelsCatalog {
  catalog: ModelsCatalog
  updatedAt: string | null
  source: ModelsCatalogSource
}

/**
 * Okuma önceliği: IndexedDB > derleme gömülü katalog.
 */
export async function loadActiveModelsCatalog(): Promise<ActiveModelsCatalog> {
  const row = await getActiveModelsCatalogRow()
  if (row) {
    return {
      catalog: row.catalog,
      updatedAt: row.updatedAt,
      source: 'remote',
    }
  }
  return {
    catalog: EMBEDDED_MODELS_CATALOG,
    updatedAt: null,
    source: 'bundled',
  }
}

export async function updateModelsCatalogFromRemote(): Promise<ActiveModelsCatalog> {
  const catalog = await fetchModelsDevCatalog()
  const updatedAt = new Date().toISOString()
  await putActiveModelsCatalogRow({ id: 'active', catalog, updatedAt })
  return { catalog, updatedAt, source: 'remote' }
}

export async function resetModelsCatalogToEmbedded(): Promise<ActiveModelsCatalog> {
  await clearActiveModelsCatalogRow()
  return {
    catalog: EMBEDDED_MODELS_CATALOG,
    updatedAt: null,
    source: 'bundled',
  }
}
