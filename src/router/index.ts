import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useProfileStore } from '@/stores/profile'
import { useSyncStore } from '@/stores/sync'
import { ensureSyncBootstrap } from '@/core/services/sync/sync-scheduler'
import { isOnboardingCompleted, postOnboardingRoute } from '@/core/onboarding'

const routes: RouteRecordRaw[] = [
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/features/profile/OnboardingView.vue'),
    meta: { gate: 'onboarding' },
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/features/profile/SetupView.vue'),
    meta: { gate: 'setup' },
  },
  {
    path: '/select',
    name: 'select',
    component: () => import('@/features/profile/SelectView.vue'),
    meta: { gate: 'select' },
  },
  {
    path: '/',
    component: () => import('@/components/AppShell.vue'),
    meta: { requiresProfile: true },
    children: [
      { path: '', redirect: { name: 'home' } },
      {
        path: 'home',
        name: 'home',
        component: () => import('@/features/home/HomeView.vue'),
        meta: { pageLayout: 'wide' },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/features/admin/AdminView.vue'),
        meta: { pageLayout: 'wide-fill' },
      },
      {
        path: 'debts',
        name: 'debts',
        component: () => import('@/features/debts/DebtsView.vue'),
        meta: { pageLayout: 'wide-fill' },
      },
      {
        path: 'cashflow',
        name: 'cashflow',
        component: () => import('@/features/cashflow/CashflowView.vue'),
        meta: { pageLayout: 'wide-fill' },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/features/analytics/AnalyticsView.vue'),
        meta: { pageLayout: 'wide' },
      },
      {
        path: 'ai',
        name: 'ai',
        component: () => import('@/features/ai/AiView.vue'),
        meta: { pageLayout: 'wide-fill' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/features/settings/SettingsView.vue'),
      },
      {
        path: 'about',
        name: 'about',
        component: () => import('@/features/about/AboutView.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'home' },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const profileStore = useProfileStore()
  const syncStore = useSyncStore()
  // Senkron ayarları profil unlock hook'larından önce yüklenmeli (race → enabled=false yazılmasın).
  if (!syncStore.loaded) await syncStore.load()
  if (!profileStore.loaded) await profileStore.load()

  const onboardingDone = isOnboardingCompleted()

  if (!onboardingDone) {
    if (to.name !== 'onboarding') return { name: 'onboarding' }
    return true
  }

  if (to.name === 'onboarding') {
    return postOnboardingRoute({
      hasAnyProfile: profileStore.hasAnyProfile,
      unlocked: profileStore.unlocked,
    })
  }

  if (!profileStore.hasAnyProfile) {
    if (to.name !== 'setup') return { name: 'setup' }
    return true
  }

  if (!profileStore.unlocked) {
    if (to.name !== 'select' && to.name !== 'setup') return { name: 'select' }
    return true
  }

  if (to.name === 'select' || to.name === 'setup') {
    return { name: 'home' }
  }

  if (profileStore.unlocked && to.matched.some((r) => r.meta.requiresProfile)) {
    await ensureSyncBootstrap()
  }

  return true
})
