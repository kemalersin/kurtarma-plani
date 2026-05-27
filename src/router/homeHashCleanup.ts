import type { RouteLocationNormalized, Router } from 'vue-router'

export const HOME_ROUTE_NAME = 'home'

/** Panel rotasında adres çubuğundan hash kaldırılır; diğer sayfalar `#/…` kullanır. */
export function shouldStripHashForRoute(route: RouteLocationNormalized): boolean {
  return route.name === HOME_ROUTE_NAME
}

/** Mevcut konumda hash varsa `replaceState` ile kaldırır (vue-router state korunur). */
export function stripLocationHashIfPresent(): void {
  if (typeof window === 'undefined') return
  const { pathname, search, hash } = window.location
  if (!hash) return
  window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}

export function installHomeHashCleanup(router: Router): void {
  router.afterEach((to) => {
    if (!shouldStripHashForRoute(to)) return
    stripLocationHashIfPresent()
  })
}
