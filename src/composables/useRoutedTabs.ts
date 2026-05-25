import { computed, watch, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface UseRoutedTabsOptions {
  /** URL query anahtarı; varsayılan `tab` */
  queryKey?: string
  /** Geçersiz `tab` değerinde URL'i varsayılana düzelt */
  fixInvalid?: boolean
}

function queryValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

/**
 * Sekmeli sayfalarda aktif sekmeyi URL query ile senkronlar.
 * Hash router ile örnek: `#/settings?tab=banking` — yenilemede aynı sekme açılır.
 */
export function useRoutedTabs<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  options: UseRoutedTabsOptions = {},
): { activeTab: WritableComputedRef<T> } {
  const { queryKey = 'tab', fixInvalid = true } = options
  const route = useRoute()
  const router = useRouter()
  const allowed = validTabs as readonly string[]

  function readTab(): T {
    const value = queryValue(route.query[queryKey])
    if (value && allowed.includes(value)) return value as T
    return defaultTab
  }

  function replaceQuery(tab: T): void {
    const query = { ...route.query }
    if (tab === defaultTab) {
      delete query[queryKey]
    } else {
      query[queryKey] = tab
    }
    void router.replace({ path: route.path, query })
  }

  const activeTab = computed<T>({
    get: () => readTab(),
    set: (tab: T) => replaceQuery(tab),
  })

  if (fixInvalid) {
    watch(
      () => route.query[queryKey],
      () => {
        const value = queryValue(route.query[queryKey])
        if (value && !allowed.includes(value)) {
          replaceQuery(defaultTab)
        }
      },
      { immediate: true },
    )
  }

  return { activeTab }
}
