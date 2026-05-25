import {
  ModelsCatalogSchema,
  type CatalogModel,
  type CloudCatalogProviderId,
  type ModelsCatalog,
} from '@/core/types/ai-catalog'

export const MODELS_DEV_API_URL = 'https://models.dev/api.json'

/** Uygulama AiProviderId → models.dev provider anahtarı */
export const MODELS_DEV_PROVIDER_MAP: Record<CloudCatalogProviderId, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  gemini: 'google',
  deepseek: 'deepseek',
}

function num(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function slimModel(raw: unknown): CatalogModel | null {
  if (!raw || typeof raw !== 'object') return null
  const model = raw as Record<string, unknown>
  const costRaw =
    model.cost && typeof model.cost === 'object' ? (model.cost as Record<string, unknown>) : {}
  const limitRaw =
    model.limit && typeof model.limit === 'object' ? (model.limit as Record<string, unknown>) : null

  const id = String(model.id ?? '')
  if (!id) return null

  const slim: CatalogModel = {
    id,
    name: String(model.name ?? id),
    cost: {
      input: num(costRaw.input),
      output: num(costRaw.output),
      cache_read: num(costRaw.cache_read),
      cache_write: num(costRaw.cache_write),
    },
  }
  if (limitRaw?.context != null) {
    slim.limit = { context: Number(limitRaw.context) }
  }
  return slim
}

/** models.dev ham API yanıtından desteklenen provider'ları çıkarır. */
export function extractCatalogFromApiJson(raw: unknown, fetchedAt = new Date().toISOString()): ModelsCatalog {
  if (!raw || typeof raw !== 'object') {
    throw new Error('models.dev yanıtı geçersiz.')
  }
  const root = raw as Record<string, unknown>
  const providers: ModelsCatalog['providers'] = {}

  for (const [appId, devId] of Object.entries(MODELS_DEV_PROVIDER_MAP)) {
    const block = root[devId]
    if (!block || typeof block !== 'object') continue
    const blockObj = block as Record<string, unknown>
    const modelsRaw = blockObj.models
    if (!modelsRaw || typeof modelsRaw !== 'object') continue

    const models: Record<string, CatalogModel> = {}
    for (const [key, model] of Object.entries(modelsRaw as Record<string, unknown>)) {
      const slim = slimModel(model)
      if (slim) models[key] = slim
    }

    providers[appId] = {
      id: appId,
      name: String(blockObj.name ?? appId),
      models,
    }
  }

  return ModelsCatalogSchema.parse({
    fetchedAt,
    source: 'models.dev',
    providers,
  })
}

export async function fetchModelsDevCatalog(): Promise<ModelsCatalog> {
  const response = await fetch(MODELS_DEV_API_URL, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`models.dev isteği başarısız: HTTP ${response.status}`)
  }
  const json = (await response.json()) as unknown
  return extractCatalogFromApiJson(json)
}
