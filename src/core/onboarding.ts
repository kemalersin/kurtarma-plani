import type { RouteLocationRaw } from 'vue-router'

export const ONBOARDING_STORAGE_KEY = 'kp.onboardingCompleted.v1'

export interface PostOnboardingRouteContext {
  hasAnyProfile: boolean
  unlocked: boolean
}

export function isOnboardingCompleted(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
}

export function completeOnboarding(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
}

/** Onboarding bittikten sonra gidilecek rota (profil / kilit durumuna göre). */
export function postOnboardingRoute(ctx: PostOnboardingRouteContext): RouteLocationRaw {
  if (!ctx.hasAnyProfile) return { name: 'setup' }
  if (!ctx.unlocked) return { name: 'select' }
  return { name: 'home' }
}
