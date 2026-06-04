import { computed, onActivated, onMounted, type ComputedRef, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import {
  defaultAnalyticsDateRange,
  isLegacyDefaultAnalyticsDateRange,
} from '@/features/analytics/defaultDateRange'
import type { AnalyticsDateRange, AnalyticsFilters, CardDebtDueMode } from '@/features/analytics/reports'

export interface AnalyticsFilterState {
  range: WritableComputedRef<AnalyticsDateRange>
  bankId: WritableComputedRef<string>
  endpointId: WritableComputedRef<string>
  categoryId: WritableComputedRef<string>
  cardDueMode: WritableComputedRef<CardDebtDueMode>
  hideCashAdvanceLimit: WritableComputedRef<boolean>
  filters: ComputedRef<AnalyticsFilters>
  patch(patch: Partial<{
    from: string
    to: string
    bank: string
    endpoint: string
    category: string
    cardDue: CardDebtDueMode | ''
    caHideLimit: boolean | ''
  }>): void
  reset(): void
}

function readStr(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

/**
 * Analiz sayfası filtrelerini URL query ile senkronlar.
 * Anahtarlar: `from`, `to`, `bank`, `endpoint`, `category`, `cardDue`.
 * Varsayılan aralık URL'e yazılmaz.
 */
export function useAnalyticsFilters(): AnalyticsFilterState {
  const route = useRoute()
  const router = useRouter()
  const profileStore = useProfileStore()
  const defaults = computed(() =>
    defaultAnalyticsDateRange(profileStore.activeProfile?.localeSettings.timeZone),
  )

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
      from: readStr(route.query.from) || defaults.value.from,
      to: readStr(route.query.to) || defaults.value.to,
    }),
    set: (next) => {
      replaceQuery({
        from: next.from === defaults.value.from ? undefined : next.from,
        to: next.to === defaults.value.to ? undefined : next.to,
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

  const cardDueMode = computed<CardDebtDueMode>({
    get: () => (readStr(route.query.cardDue) === 'min' ? 'min' : 'statement'),
    set: (v) => replaceQuery({ cardDue: v === 'statement' ? undefined : v }),
  })

  const hideCashAdvanceLimit = computed<boolean>({
    get: () => readStr(route.query.caHideLimit) === '1',
    set: (v) => replaceQuery({ caHideLimit: v ? '1' : undefined }),
  })

  const filters = computed<AnalyticsFilters>(() => ({
    range: range.value,
    bankId: bankId.value || undefined,
    endpointId: endpointId.value || undefined,
    categoryId: categoryId.value || undefined,
    cardDueMode: cardDueMode.value,
    hideCashAdvanceLimit: hideCashAdvanceLimit.value || undefined,
  }))

  function patch(p: Partial<{
    from: string
    to: string
    bank: string
    endpoint: string
    category: string
    cardDue: CardDebtDueMode | ''
    caHideLimit: boolean | ''
  }>): void {
    const next: Record<string, string | undefined> = {}
    if ('from' in p) {
      next.from = p.from === defaults.value.from ? undefined : p.from
    }
    if ('to' in p) {
      next.to = p.to === defaults.value.to ? undefined : p.to
    }
    if ('bank' in p) next.bank = p.bank || undefined
    if ('endpoint' in p) next.endpoint = p.endpoint || undefined
    if ('category' in p) next.category = p.category || undefined
    if ('cardDue' in p) {
      next.cardDue = !p.cardDue || p.cardDue === 'statement' ? undefined : p.cardDue
    }
    if ('caHideLimit' in p) {
      next.caHideLimit = p.caHideLimit ? '1' : undefined
    }
    if (Object.keys(next).length) replaceQuery(next)
  }

  function reset(): void {
    replaceQuery({
      from: undefined,
      to: undefined,
      bank: undefined,
      endpoint: undefined,
      category: undefined,
      cardDue: undefined,
      caHideLimit: undefined,
    })
  }

  function migrateLegacyRangeQuery(): void {
    const from = readStr(route.query.from)
    const to = readStr(route.query.to)
    if (from && to && isLegacyDefaultAnalyticsDateRange(from, to)) {
      replaceQuery({ from: undefined, to: undefined })
    }
  }

  onMounted(migrateLegacyRangeQuery)
  onActivated(migrateLegacyRangeQuery)

  return { range, bankId, endpointId, categoryId, cardDueMode, hideCashAdvanceLimit, filters, patch, reset }
}
