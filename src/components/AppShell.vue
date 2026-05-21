<script setup lang="ts">
import { computed } from 'vue'
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
  Tooltip,
  Typography,
} from 'ant-design-vue'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PushpinOutlined,
  DashboardOutlined,
  SettingOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import type { MenuInfo } from 'ant-design-vue/es/menu/src/interface'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'
import ThemeToggle from '@/components/ThemeToggle.vue'
import BrandMark from '@/components/icons/BrandMark.vue'
import { APP_NAME, APP_VERSION } from '@/core/constants'
import { buildBreadcrumb } from '@/router/breadcrumb'

const ui = useUiStore()
const profileStore = useProfileStore()
const route = useRoute()
const router = useRouter()

const selectedKeys = computed<string[]>(() => [String(route.name ?? '')])
const breadcrumbTrail = computed(() => buildBreadcrumb(route))

function navigate(info: MenuInfo): void {
  router.push({ name: String(info.key) })
}

function lock(): void {
  void profileStore.lock().then(() => router.push({ name: 'select' }))
}

function onHamburgerClick(): void {
  ui.toggleSidebarPin()
}

function onHamburgerEnter(): void {
  if (!ui.sidebarPinned) ui.setSidebarPeeking(true)
}

function onSidebarEnter(): void {
  if (!ui.sidebarPinned) ui.setSidebarPeeking(true)
}

function onSidebarLeave(): void {
  if (!ui.sidebarPinned) ui.setSidebarPeeking(false)
}

function gotoCrumb(name?: string): void {
  if (name) router.push({ name })
}
</script>

<template>
  <div class="kp-shell" :class="{ 'kp-shell--pinned': ui.sidebarPinned }">
    <aside
      class="kp-sider"
      :class="{
        'kp-sider--floating': !ui.sidebarPinned,
        'kp-sider--visible': ui.sidebarVisible,
      }"
      @mouseenter="onSidebarEnter"
      @mouseleave="onSidebarLeave"
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
        <Tooltip v-if="!ui.sidebarPinned" title="Menüyü sabitle">
          <Button
            type="text"
            size="small"
            class="kp-sider__pin"
            :aria-label="'Menüyü sabitle'"
            @click="ui.toggleSidebarPin()"
          >
            <PushpinOutlined />
          </Button>
        </Tooltip>
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
        <MenuItem key="settings">
          <template #icon><SettingOutlined /></template>
          <span>Ayarlar</span>
        </MenuItem>
      </Menu>

      <div class="kp-sider__footer kp-text-muted">v{{ APP_VERSION }}</div>
    </aside>

    <div
      v-if="!ui.sidebarPinned && ui.sidebarPeeking"
      class="kp-sider__scrim"
      aria-hidden="true"
    />

    <Layout class="kp-main">
      <LayoutHeader class="kp-header">
        <Tooltip
          :title="ui.sidebarPinned ? 'Menüyü gizle' : 'Menüyü sabitle (üzerine gel: aç)'"
        >
          <Button
            type="text"
            class="kp-header__hamburger"
            :aria-label="'Menü'"
            @click="onHamburgerClick"
            @mouseenter="onHamburgerEnter"
          >
            <MenuFoldOutlined v-if="ui.sidebarPinned" style="font-size: 18px" />
            <MenuUnfoldOutlined v-else style="font-size: 18px" />
          </Button>
        </Tooltip>

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

        <ThemeToggle />

        <Tooltip title="Profili kilitle / değiştir">
          <Button type="text" :aria-label="'Profili kilitle'" @click="lock">
            <LockOutlined />
          </Button>
        </Tooltip>
      </LayoutHeader>

      <LayoutContent class="kp-content">
        <router-view />
      </LayoutContent>
    </Layout>
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
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--kp-brand, #1677ff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
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
  padding: 16px;
  overflow: auto;
}

@media (max-width: 768px) {
  .kp-sider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    height: 100%;
    transform: translateX(-100%);
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.12);
  }

  .kp-sider--visible {
    transform: translateX(0);
  }

  .kp-shell--pinned .kp-content {
    padding: 12px;
  }
}
</style>
