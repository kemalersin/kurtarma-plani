import bundled from './bundled.json'
import type { ModelsCatalog } from '@/core/types/ai-catalog'

const generatedModules = import.meta.glob('./generated.json', {
  eager: true,
  import: 'default',
}) as Record<string, ModelsCatalog>

const generated = generatedModules['./generated.json']

/** Build ile derlemeye gömülü katalog (generated.json varsa o, yoksa bundled.json). */
export const EMBEDDED_MODELS_CATALOG: ModelsCatalog = generated ?? (bundled as ModelsCatalog)

/** @deprecated Aktif katalog için `useModelsCatalogStore` kullanın. */
export const MODELS_CATALOG: ModelsCatalog = EMBEDDED_MODELS_CATALOG

export function catalogProvider(providerId: keyof ModelsCatalog['providers']) {
  return EMBEDDED_MODELS_CATALOG.providers[providerId]
}

export function catalogModel(providerId: keyof ModelsCatalog['providers'], modelId: string) {
  return EMBEDDED_MODELS_CATALOG.providers[providerId]?.models[modelId]
}
