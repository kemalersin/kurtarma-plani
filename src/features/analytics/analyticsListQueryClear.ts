import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import type { ListFilter } from '@/components/EntityListPage.vue'

function readQueryStr(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return ''
}

/** URL'de varsayılandan farklı analiz tarih aralığı seçilmiş mi? */
export function analyticsRangeQueryActive(route: RouteLocationNormalizedLoaded): boolean {
  return Boolean(readQueryStr(route.query.from) || readQueryStr(route.query.to))
}

/**
 * Liste (prefiksli) + paylaşılan analiz query anahtarlarını tek `router.replace` ile temizler.
 * Ardışık replace çağrıları birbirinin patch'ini ezer.
 */
export function clearAnalyticsListRouteQuery<T>(params: {
  route: RouteLocationNormalizedLoaded
  router: Router
  stateKey: string
  listFilters: ListFilter<T>[]
  sharedQueryKeys: string[]
}): void {
  const query = { ...params.route.query }
  const suffix = params.stateKey ? `_${params.stateKey}` : ''
  const full = (name: string) => `${name}${suffix}`

  for (const f of params.listFilters) {
    if (f.kind === 'select') delete query[full(f.key)]
    else {
      delete query[full(`${f.key}From`)]
      delete query[full(`${f.key}To`)]
    }
  }
  delete query[full('page')]

  for (const key of params.sharedQueryKeys) delete query[key]

  void params.router.replace({
    path: params.route.path,
    hash: params.route.hash,
    query,
  })
}
