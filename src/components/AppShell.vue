<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Layout,
  LayoutHeader,
  LayoutContent,
  Menu,
  MenuItem,
  Breadcrumb,
  BreadcrumbItem as AntBreadcrumbItem,
  Button,
  Typography,
} from 'ant-design-vue'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PushpinOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  CreditCardOutlined,
  SwapOutlined,
  LineChartOutlined,
  RobotOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import type { MenuInfo } from 'ant-design-vue/es/menu/src/interface'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'
import { useSyncStore } from '@/stores/sync'
import KpTooltip from '@/components/KpTooltip.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import SyncStatusBadge from '@/components/SyncStatusBadge.vue'
import SyncConflictModal from '@/components/SyncConflictModal.vue'
import { KP_HOVER_CAPABLE_MQ, KP_MOBILE_VIEWPORT_MQ, useMatchMedia } from '@/composables/useMatchMedia'
import BrandMark from '@/components/icons/BrandMark.vue'
import { APP_NAME, APP_VERSION } from '@/core/constants'
import { buildBreadcrumb } from '@/router/breadcrumb'
import { resolvePageLayout, isWidePageLayout } from '@/router/meta'

const ui = useUiStore()
const profileStore = useProfileStore()
const syncStore = useSyncStore()
const route = useRoute()
const router = useRouter()

const isMobileShell = useMatchMedia(KP_MOBILE_VIEWPORT_MQ)
const hoverCapable = useMatchMedia(KP_HOVER_CAPABLE_MQ)

const hoverPeekEnabled = computed(
  () => !isMobileShell.value && hoverCapable.value && !ui.sidebarPinned,
)

const menuOpen = computed(() =>
  isMobileShell.value ? ui.sidebarPeeking : ui.sidebarVisible,
)

const hamburgerTooltip = computed(() => {
  if (isMobileShell.value) {
    return ui.sidebarPeeking ? 'Menüyü kapat' : 'Menüyü aç'
  }
  if (!hoverCapable.value && !ui.sidebarPinned) {
    return ui.sidebarPeeking ? 'Menüyü kapat' : 'Menüyü aç'
  }
  return ui.sidebarPinned ? 'Menüyü gizle' : 'Menüyü sabitle (üzerine gel: aç)'
})

const selectedKeys = computed<string[]>(() => [String(route.name ?? '')])
const breadcrumbTrail = computed(() => buildBreadcrumb(route))
const pageLayoutClasses = computed(() => {
  const layout = resolvePageLayout(route)
  return {
    'kp-page--wide': isWidePageLayout(layout),
    'kp-page--fill': layout === 'wide-fill',
  }
})

/** Uzak pull sonrası aktif sayfayı yeniden mount eder (entity cache temizlenir). */
const pageViewKey = computed(() => `${route.fullPath}::${syncStore.pullRevision}`)

function navigate(info: MenuInfo): void {
  router.push({ name: String(info.key) })
  if (isMobileShell.value) ui.setSidebarPeeking(false)
}

function lock(): void {
  void profileStore.lock().then(() => router.push({ name: 'select' }))
}

function onHamburgerClick(): void {
  if (isMobileShell.value) {
    ui.setSidebarPeeking(!ui.sidebarPeeking)
    return
  }
  if (!hoverCapable.value && !ui.sidebarPinned) {
    ui.setSidebarPeeking(!ui.sidebarPeeking)
    return
  }
  ui.toggleSidebarPin()
}

function onHamburgerEnter(): void {
  if (!hoverPeekEnabled.value) return
  ui.setSidebarPeeking(true)
}

function onSidebarEnter(): void {
  if (!hoverPeekEnabled.value) return
  ui.setSidebarPeeking(true)
}

function onSidebarLeave(): void {
  if (!hoverPeekEnabled.value) return
  ui.setSidebarPeeking(false)
}

function closeSidebarOverlay(): void {
  ui.setSidebarPeeking(false)
}

watch(isMobileShell, (mobile) => {
  if (mobile) ui.setSidebarPeeking(false)
})

watch(
  () => route.fullPath,
  () => {
    if (isMobileShell.value) ui.setSidebarPeeking(false)
  },
)

watch(
  () => syncStore.conflictPending,
  (pending) => {
    if (pending) syncStore.openConflictModal()
  },
)

function gotoCrumb(name?: string): void {
  if (name) router.push({ name })
}
</script>

<template>
  <div class="kp-shell" :class="{ 'kp-shell--pinned': !isMobileShell && ui.sidebarPinned }">
    <aside
      class="kp-sider"
      :class="{
        'kp-sider--floating': isMobileShell || !ui.sidebarPinned,
        'kp-sider--visible': menuOpen,
      }"
      @mouseenter="hoverPeekEnabled ? onSidebarEnter : undefined"
      @mouseleave="hoverPeekEnabled ? onSidebarLeave : undefined"
    >
      <div class="kp-sider__brand">
        <div class="kp-sider__brand-text">
          <div class="kp-sider__brand-title">
            <BrandMark />
            <span>{{ APP_NAME }}</span>
          </div>
          <Typography.Text class="kp-text-muted kp-sider__brand-tag">
            KİŞİSEL FİNANSAL PLAN
          </Typography.Text>
        </div>
        <KpTooltip v-if="!isMobileShell && !ui.sidebarPinned" title="Menüyü sabitle">
          <Button
            type="text"
            size="small"
            class="kp-sider__pin"
            :aria-label="'Menüyü sabitle'"
            @click="ui.toggleSidebarPin()"
          >
            <PushpinOutlined />
          </Button>
        </KpTooltip>
      </div>

      <div v-if="profileStore.activeProfile" class="kp-sider__profile">
        <div class="kp-sider__profile-avatar">
          {{ profileStore.activeProfile.name.charAt(0).toUpperCase() }}
        </div>
        <div class="kp-sider__profile-info">
          <div class="kp-sider__profile-name">{{ profileStore.activeProfile.name }}</div>
          <div class="kp-sider__profile-meta">
            {{ profileStore.activeProfile.localeSettings.currency }} ·
            {{ profileStore.activeProfile.localeSettings.locale }}
          </div>
        </div>
      </div>

      <Menu
        mode="inline"
        theme="light"
        :selected-keys="selectedKeys"
        style="border-inline-end: 0"
        @click="navigate"
      >
        <MenuItem key="home">
          <template #icon><DashboardOutlined /></template>
          <span>Panel</span>
        </MenuItem>
        <MenuItem key="admin">
          <template #icon><DatabaseOutlined /></template>
          <span>Yönetim</span>
        </MenuItem>
        <MenuItem key="debts">
          <template #icon><CreditCardOutlined /></template>
          <span>Borçlar</span>
        </MenuItem>
        <MenuItem key="cashflow">
          <template #icon><SwapOutlined /></template>
          <span>Nakit akışı</span>
        </MenuItem>
        <MenuItem key="analytics">
          <template #icon><LineChartOutlined /></template>
          <span>Analiz & rapor</span>
        </MenuItem>
        <MenuItem key="ai">
          <template #icon><RobotOutlined /></template>
          <span>AI Asistan</span>
        </MenuItem>
        <MenuItem key="settings">
          <template #icon><SettingOutlined /></template>
          <span>Ayarlar</span>
        </MenuItem>
        <MenuItem key="about">
          <template #icon><InfoCircleOutlined /></template>
          <span>Hakkında</span>
        </MenuItem>
      </Menu>

      <div class="kp-sider__footer kp-text-muted">v{{ APP_VERSION }}</div>
    </aside>

    <div
      v-if="menuOpen && (isMobileShell || !ui.sidebarPinned)"
      class="kp-sider__scrim"
      aria-hidden="true"
      @click="closeSidebarOverlay"
    />

    <Layout class="kp-main">
      <LayoutHeader class="kp-header">
        <KpTooltip :title="hamburgerTooltip">
          <Button
            type="text"
            class="kp-header__hamburger"
            :aria-label="isMobileShell && ui.sidebarPeeking ? 'Menüyü kapat' : 'Menüyü aç'"
            @click="onHamburgerClick"
            @mouseenter="hoverPeekEnabled ? onHamburgerEnter : undefined"
          >
            <MenuFoldOutlined
              v-if="!isMobileShell && ui.sidebarPinned"
              style="font-size: 18px"
            />
            <MenuUnfoldOutlined v-else style="font-size: 18px" />
          </Button>
        </KpTooltip>

        <Breadcrumb separator="/">
          <AntBreadcrumbItem
            v-for="(crumb, idx) in breadcrumbTrail"
            :key="`${idx}-${crumb.label}`"
            :class="{ 'kp-breadcrumb--link': !!crumb.routeName }"
          >
            <a v-if="crumb.routeName" href="#" @click.prevent="gotoCrumb(crumb.routeName)">
              {{ crumb.label }}
            </a>
            <span v-else>{{ crumb.label }}</span>
          </AntBreadcrumbItem>
        </Breadcrumb>

        <div class="kp-spacer" />

        <SyncStatusBadge />

        <ThemeToggle />

        <KpTooltip title="Profili kilitle / değiştir">
          <Button type="text" :aria-label="'Profili kilitle'" @click="lock">
            <LockOutlined />
          </Button>
        </KpTooltip>
      </LayoutHeader>

      <LayoutContent class="kp-content">
        <div class="kp-page" :class="pageLayoutClasses">
          <router-view :key="pageViewKey" />
        </div>
      </LayoutContent>
    </Layout>

    <SyncConflictModal />
  </div>
</template>

<style scoped>
.kp-shell {
  position: relative;
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.kp-sider {
  display: flex;
  flex-direction: column;
  width: 240px;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  z-index: 50;
}

[data-theme='dark'] .kp-sider {
  background: #1f1f1f;
  border-right-color: rgba(255, 255, 255, 0.08);
}

.kp-sider--floating {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  height: 100%;
  transform: translateX(-100%);
  box-shadow: 4px 0 16px rgba(0, 0, 0, 0.08);
}

.kp-sider--floating.kp-sider--visible {
  transform: translateX(0);
}

.kp-sider__brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .kp-sider__brand {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.kp-sider__brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.kp-sider__brand-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 600;
  color: var(--kp-brand, #1677ff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.kp-sider__brand-title :deep(.kp-brand-mark) {
  font-size: 26px;
}

.kp-sider__brand-title > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.kp-sider__brand-tag {
  font-size: 10px;
  letter-spacing: 0.08em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.kp-sider__pin {
  font-size: 14px;
}

.kp-sider__profile {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px;
  padding: 10px 12px;
  border-radius: var(--kp-radius);
  background: rgba(22, 119, 255, 0.06);
}

[data-theme='dark'] .kp-sider__profile {
  background: rgba(22, 119, 255, 0.12);
}

.kp-sider__profile-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.kp-sider__profile-info {
  min-width: 0;
}

.kp-sider__profile-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kp-sider__profile-meta {
  font-size: 11px;
  opacity: 0.65;
}

.kp-sider__footer {
  margin-top: auto;
  padding: 12px 16px;
  font-size: 11px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .kp-sider__footer {
  border-top-color: rgba(255, 255, 255, 0.06);
}

.kp-sider__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.18);
  z-index: 40;
  animation: kp-fade-in 0.15s ease;
}

[data-theme='dark'] .kp-sider__scrim {
  background: rgba(0, 0, 0, 0.35);
}

@keyframes kp-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.kp-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.kp-header {
  background: #fff;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  height: 56px;
  line-height: normal;
  overflow: hidden;
  min-width: 0;
}

[data-theme='dark'] .kp-header {
  background: #1f1f1f;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.kp-header :deep(.ant-breadcrumb) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-theme='dark'] .kp-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.kp-header__hamburger {
  padding: 4px 10px;
}

.kp-breadcrumb--link a {
  color: inherit;
  text-decoration: none;
}

.kp-breadcrumb--link a:hover {
  color: #1677ff;
}

.kp-content {
  padding: var(--kp-content-padding-top) var(--kp-content-padding-x)
    var(--kp-content-padding-bottom);
  overflow: auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 768px) {
  .kp-sider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    height: 100%;
    width: 240px;
    flex: none;
    transform: translateX(-100%);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  }

  .kp-sider--visible {
    transform: translateX(0);
  }

  .kp-sider__scrim {
    cursor: pointer;
  }
}
</style>
