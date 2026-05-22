import type { CatalogModel } from '@/core/types/ai-catalog'
import type { TokenUsage } from '@/core/types/ai'

const M = 1_000_000

/**
 * models.dev maliyet alanları USD / 1M token.
 * Cache token'ları ayrı birim fiyatla hesaplanır.
 */
export function computeCostUsd(model: CatalogModel | undefined, usage: TokenUsage): number {
  if (!model?.cost) return 0
  const { input = 0, output = 0, cache_read = 0, cache_write = 0 } = model.cost
  const billableInput = Math.max(0, usage.inputTokens - (usage.cacheReadTokens ?? 0))
  let total =
    (billableInput / M) * input +
    (usage.outputTokens / M) * output +
    ((usage.cacheReadTokens ?? 0) / M) * cache_read +
    ((usage.cacheWriteTokens ?? 0) / M) * cache_write
  if (!Number.isFinite(total) || total < 0) return 0
  return Math.round(total * 1_000_000) / 1_000_000
}

export function formatCostUsd(value: number): string {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
