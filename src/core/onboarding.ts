export const ONBOARDING_STORAGE_KEY = 'kp.onboardingCompleted.v1'

export function isOnboardingCompleted(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
}

export function completeOnboarding(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
}
