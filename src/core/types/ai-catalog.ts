import { z } from 'zod'
import type { AiProviderId } from '@/core/types/ai-settings'

export const CatalogModelCostSchema = z.object({
  input: z.number().optional(),
  output: z.number().optional(),
  cache_read: z.number().optional(),
  cache_write: z.number().optional(),
})

export const CatalogModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost: CatalogModelCostSchema,
  limit: z.object({ context: z.number() }).optional(),
})

export type CatalogModel = z.infer<typeof CatalogModelSchema>

export const CatalogProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.record(z.string(), CatalogModelSchema),
})

export const ModelsCatalogSchema = z.object({
  fetchedAt: z.string(),
  source: z.string(),
  providers: z.record(z.string(), CatalogProviderSchema),
})

export type ModelsCatalog = z.infer<typeof ModelsCatalogSchema>

export type ModelsCatalogSource = 'bundled' | 'remote'

export interface ModelsCatalogRow {
  id: 'active'
  catalog: ModelsCatalog
  updatedAt: string
}

export type CloudCatalogProviderId = Extract<AiProviderId, 'anthropic' | 'openai' | 'gemini' | 'deepseek'>

export function isCloudCatalogProvider(id: AiProviderId): id is CloudCatalogProviderId {
  return id === 'anthropic' || id === 'openai' || id === 'gemini' || id === 'deepseek'
}
