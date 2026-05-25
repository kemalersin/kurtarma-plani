import type { RouteLocationNormalized } from 'vue-router'

export type PageLayout = 'narrow' | 'wide' | 'wide-fill'

declare module 'vue-router' {
  interface RouteMeta {
    gate?: 'setup' | 'select'
    requiresProfile?: boolean
    /**
     * - `narrow`: 800px sütun (ayarlar, kurulum)
     * - `wide`: tam genişlik, doğal yükseklik (panel — kaydırılabilir)
     * - `wide-fill`: tam genişlik + viewport doldurma (liste sekmeli sayfalar)
     */
    pageLayout?: PageLayout
  }
}

/** En derin eşleşmeden pageLayout okur; yoksa narrow. */
export function resolvePageLayout(route: RouteLocationNormalized): PageLayout {
  for (let i = route.matched.length - 1; i >= 0; i--) {
    const layout = route.matched[i]?.meta.pageLayout
    if (layout === 'wide' || layout === 'wide-fill' || layout === 'narrow') return layout
  }
  return 'narrow'
}

export function isWidePageLayout(layout: PageLayout): boolean {
  return layout === 'wide' || layout === 'wide-fill'
}
