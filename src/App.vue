<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ConfigProvider, App as AntApp, theme as antTheme } from 'ant-design-vue'
import trTR from 'ant-design-vue/es/locale/tr_TR'
import dayjs from 'dayjs'
import 'dayjs/locale/tr'
import { useUiStore } from '@/stores/ui'
import { useProfileStore } from '@/stores/profile'

dayjs.locale('tr')

const ui = useUiStore()
const profileStore = useProfileStore()

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
  if (!profileStore.loaded) await profileStore.load()
})
</script>

<template>
  <ConfigProvider :locale="trTR" :theme="themeConfig">
    <AntApp class="kp-fill">
      <router-view />
    </AntApp>
  </ConfigProvider>
</template>
