<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'ant-design-vue'
import trTR from 'ant-design-vue/es/locale/tr_TR'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'
import { useSyncStore } from '@/stores/sync'
import { useUpdateStore } from '@/stores/update'
import { initSyncScheduler } from '@/core/services/sync/sync-scheduler'
import { initMobileScrollbars } from '@/composables/initMobileScrollbars'
import UpdateAvailableNotice from '@/components/UpdateAvailableNotice.vue'

dayjs.locale('tr')

const ui = useUiStore()
const profileStore = useProfileStore()
const syncStore = useSyncStore()
const updateStore = useUpdateStore()

let stopSyncScheduler: (() => void) | undefined
let stopMobileScrollbars: (() => void) | undefined

const themeConfig = computed(() => ({
  algorithm: ui.isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
}))

onMounted(async () => {
  if (!syncStore.loaded) await syncStore.load()
  if (!profileStore.loaded) await profileStore.load()
  if (!updateStore.loaded) await updateStore.load()
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void updateStore.checkOnLaunch()
  }
  stopSyncScheduler = initSyncScheduler()
  stopMobileScrollbars = initMobileScrollbars()
})

onUnmounted(() => {
  stopSyncScheduler?.()
  stopMobileScrollbars?.()
})
</script>

<template>
  <ConfigProvider :locale="trTR" :theme="themeConfig">
    <AntApp class="kp-fill">
      <router-view />
      <UpdateAvailableNotice />
    </AntApp>
  </ConfigProvider>
</template>
