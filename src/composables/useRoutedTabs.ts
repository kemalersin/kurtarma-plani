import { computed, ref, watch, type WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface UseRoutedTabsOptions {
  /** URL query anahtarı; varsayılan `tab` */
  queryKey?: string
  /** Geçersiz `tab` değerinde URL'i varsayılana düzelt */
  fixInvalid?: boolean
  /**
   * Aktif route adı (`route.name`). KeepAlive ile cache'lenen sayfalarda **zorunlu** —
   * yalnızca bu route görünürken URL okunur/yazılır; aksi halde diğer sayfaların
   * `?tab=` değişikliği bu sekmenin watcher'ı tarafından sıfırlanır.
   */
  routeName?: string | symbol
}

function queryValue(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

/**
 * Sekmeli sayfalarda aktif sekmeyi URL query ile senkronlar.
 * Hash router ile örnek: `#/settings?tab=banking` — yenilemede aynı sekme açılır.
 *
 * KeepAlive ile sayfa remount olmadığından sekme tıklamasında URL güncellenene kadar
 * optimistic `pendingTab` kullanılır; aksi halde kontrollü `<Tabs>` eski anahtarda kalır.
 */
export function useRoutedTabs<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  options: UseRoutedTabsOptions = {},
): { activeTab: WritableComputedRef<T> } {
  const { queryKey = 'tab', fixInvalid = true, routeName } = options
  const route = useRoute()
  const router = useRouter()
  const allowed = validTabs as readonly string[]
  /** `router.replace` tamamlanana kadar UI'da gösterilecek sekme. */
  const pendingTab = ref<T | null>(null)
  /** Route dışındayken (KeepAlive deactivate) son bilinen sekme. */
  const lastActiveTab = ref<T>(defaultTab)

  function isOwnerRoute(): boolean {
    return routeName === undefined || route.name === routeName
  }

  function readTabFromRoute(): T {
    if (!isOwnerRoute()) return lastActiveTab.value
    const value = queryValue(route.query[queryKey])
    if (value && allowed.includes(value)) return value as T
    return defaultTab
  }

  function readTab(): T {
    if (pendingTab.value !== null && allowed.includes(pendingTab.value)) {
      return pendingTab.value
    }
    return readTabFromRoute()
  }

  function replaceQuery(tab: T): void {
    if (!isOwnerRoute()) return
    const query = { ...route.query }
    if (tab === defaultTab) {
      delete query[queryKey]
    } else {
      query[queryKey] = tab
    }
    void router.replace({ path: route.path, hash: route.hash, query })
  }

  const activeTab = computed<T>({
    get: () => readTab(),
    set: (tab: T) => {
      if (!isOwnerRoute()) return
      lastActiveTab.value = tab
      pendingTab.value = tab
      replaceQuery(tab)
    },
  })

  watch(
    () => route.query[queryKey],
    () => {
      if (!isOwnerRoute()) return
      pendingTab.value = null
      const fromRoute = readTabFromRoute()
      lastActiveTab.value = fromRoute
      if (!fixInvalid) return
      const value = queryValue(route.query[queryKey])
      if (value && !allowed.includes(value)) {
        replaceQuery(defaultTab)
      }
    },
    { immediate: true },
  )

  watch(
    () => route.name,
    () => {
      if (!isOwnerRoute()) return
      pendingTab.value = null
      lastActiveTab.value = readTabFromRoute()
    },
  )

  return { activeTab }
}
