import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { HOME_ROUTE_NAME, shouldStripHashForRoute } from '@/router/homeHashCleanup'

function route(name: string): RouteLocationNormalized {
  return { name } as RouteLocationNormalized
}

describe('homeHashCleanup', () => {
  it('panel rotasında hash kaldırılır', () => {
    expect(shouldStripHashForRoute(route(HOME_ROUTE_NAME))).toBe(true)
  })

  it('diğer rotalarda hash korunur', () => {
    expect(shouldStripHashForRoute(route('debts'))).toBe(false)
    expect(shouldStripHashForRoute(route('onboarding'))).toBe(false)
  })
})
