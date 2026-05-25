import { computed, type ComputedRef, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AnalyticsDateRange, AnalyticsFilters } from '@/features/analytics/reports'

export interface AnalyticsFilterState {
  range: WritableComputedRef<AnalyticsDateRange>
  bankId: WritableComputedRef<string>
  endpointId: WritableComputedRef<string>
  categoryId: WritableComputedRef<string>
  filters: ComputedRef<AnalyticsFilters>
  patch(patch: Partial<{
    from: string
    to: string
    bank: string
    endpoint: string
    category: string
  }>): void
  reset(): void
}

function readStr(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

function defaultRange(): AnalyticsDateRange {
  const today = new Date()
  const back = new Date(today)
  back.setMonth(back.getMonth() - 6)
  const fwd = new Date(today)
  fwd.setMonth(fwd.getMonth() + 6)
  return {
    from: back.toISOString().slice(0, 10),
    to: fwd.toISOString().slice(0, 10),
  }
}

/**
 * Analiz sayfası filtrelerini URL query ile senkronlar.
 * Anahtarlar: `from`, `to`, `bank`, `endpoint`, `category`.
 * Varsayılan aralık URL'e yazılmaz.
 */
export function useAnalyticsFilters(): AnalyticsFilterState {
  const route = useRoute()
  const router = useRouter()
  const defaults = defaultRange()

  function replaceQuery(patch: Record<string, string | undefined>): void {
    const query = { ...route.query }
    for (const [key, value] of Object.entries(patch)) {
      if (!value) delete query[key]
      else query[key] = value
    }
    void router.replace({ path: route.path, query })
  }

  const range = computed<AnalyticsDateRange>({
    get: () => ({
      from: readStr(route.query.from) || defaults.from,
      to: readStr(route.query.to) || defaults.to,
    }),
    set: (next) => {
      replaceQuery({
        from: next.from === defaults.from ? undefined : next.from,
        to: next.to === defaults.to ? undefined : next.to,
      })
    },
  })

  const bankId = computed<string>({
    get: () => readStr(route.query.bank),
    set: (v) => replaceQuery({ bank: v || undefined }),
  })

  const endpointId = computed<string>({
    get: () => readStr(route.query.endpoint),
    set: (v) => replaceQuery({ endpoint: v || undefined }),
  })

  const categoryId = computed<string>({
    get: () => readStr(route.query.category),
    set: (v) => replaceQuery({ category: v || undefined }),
  })

  const filters = computed<AnalyticsFilters>(() => ({
    range: range.value,
    bankId: bankId.value || undefined,
    endpointId: endpointId.value || undefined,
    categoryId: categoryId.value || undefined,
  }))

  function patch(p: Partial<{
    from: string
    to: string
    bank: string
    endpoint: string
    category: string
  }>): void {
    replaceQuery({
      from: p.from === defaults.from ? undefined : p.from,
      to: p.to === defaults.to ? undefined : p.to,
      bank: p.bank,
      endpoint: p.endpoint,
      category: p.category,
    })
  }

  function reset(): void {
    replaceQuery({
      from: undefined,
      to: undefined,
      bank: undefined,
      endpoint: undefined,
      category: undefined,
    })
  }

  return { range, bankId, endpointId, categoryId, filters, patch, reset }
}
