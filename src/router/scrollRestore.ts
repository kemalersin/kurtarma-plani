import { nextTick } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'

type ScrollPosition = { top: number; left: number }

const scrollPositions = new Map<string, ScrollPosition>()

let lastHistoryPosition = readHistoryPosition()

/** Aynı route adında yalnızca query/hash değişiminde kaydırmayı koru (sekme, liste URL). */
export function shouldResetScrollOnNavigate(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): boolean {
  return to.name !== from.name
}

export function scrollPositionKey(route: RouteLocationNormalized): string {
  return route.fullPath
}

export function isHistoryBack(currentPosition: number, previousPosition: number): boolean {
  return currentPosition < previousPosition
}

function readHistoryPosition(): number {
  if (typeof history === 'undefined') return 0
  const position = history.state?.position
  return typeof position === 'number' ? position : 0
}

function getMainScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.kp-content') ??
    document.querySelector<HTMLElement>('.kp-center-page')
  )
}

function readMainScrollPosition(): ScrollPosition {
  const container = getMainScrollContainer()
  if (!container) return { top: 0, left: 0 }
  return { top: container.scrollTop, left: container.scrollLeft }
}

/** AppShell ve gate sayfalarının kaydırma konteynerleri. */
export function resetMainScrollContainers(): void {
  document.querySelector<HTMLElement>('.kp-content')?.scrollTo({ top: 0, left: 0 })
  document.querySelector<HTMLElement>('.kp-center-page')?.scrollTo({ top: 0, left: 0 })
}

export function saveScrollPosition(route: RouteLocationNormalized): void {
  scrollPositions.set(scrollPositionKey(route), readMainScrollPosition())
}

export function restoreScrollPosition(route: RouteLocationNormalized): void {
  const saved = scrollPositions.get(scrollPositionKey(route))
  const container = getMainScrollContainer()
  if (!saved || !container) {
    resetMainScrollContainers()
    return
  }
  container.scrollTo({ top: saved.top, left: saved.left })
}

export function installScrollRestore(router: Router): void {
  router.beforeEach((to, from) => {
    if (from.name && shouldResetScrollOnNavigate(to, from)) {
      saveScrollPosition(from)
    }
    return true
  })

  router.afterEach(async (to, from) => {
    if (!shouldResetScrollOnNavigate(to, from)) return

    const currentHistoryPosition = readHistoryPosition()
    const back = isHistoryBack(currentHistoryPosition, lastHistoryPosition)

    await nextTick()
    if (back) {
      restoreScrollPosition(to)
    } else {
      resetMainScrollContainers()
    }

    lastHistoryPosition = currentHistoryPosition
  })
}
