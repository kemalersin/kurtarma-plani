import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useProfileStore } from '@/stores/profile'

const routes: RouteRecordRaw[] = [
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
  if (!profileStore.loaded) await profileStore.load()

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

  return true
})
