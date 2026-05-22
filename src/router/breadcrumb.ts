import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface BreadcrumbItem {
  label: string
  routeName?: string
}

const ROUTE_LABELS: Record<string, string> = {
  setup: 'Kurulum',
  select: 'Profil Seç',
  home: 'Panel',
  admin: 'Yönetim',
  debts: 'Borçlar',
  cashflow: 'Nakit akışı',
  analytics: 'Analiz & rapor',
  settings: 'Ayarlar',
}

const HOME_ROUTE = 'home'

export function buildBreadcrumb(route: RouteLocationNormalizedLoaded): BreadcrumbItem[] {
  const name = String(route.name ?? '')
  const items: BreadcrumbItem[] = []

  if (name && name !== HOME_ROUTE) {
    items.push({ label: ROUTE_LABELS[HOME_ROUTE] ?? 'Panel', routeName: HOME_ROUTE })
  }

  if (name) {
    items.push({ label: ROUTE_LABELS[name] ?? name })
  }

  if (items.length === 0) {
    items.push({ label: ROUTE_LABELS[HOME_ROUTE] ?? 'Panel' })
  }

  return items
}
