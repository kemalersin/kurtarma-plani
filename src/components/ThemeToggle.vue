<script setup lang="ts">
import { computed } from 'vue'
import { Dropdown, Menu, MenuItem, Button } from 'ant-design-vue'
import { DesktopOutlined } from '@ant-design/icons-vue'
import type { MenuInfo } from 'ant-design-vue/es/menu/src/interface'
import { useUiStore, type ThemeMode } from '@/stores/ui'
import SunIcon from '@/components/icons/SunIcon.vue'
import MoonIcon from '@/components/icons/MoonIcon.vue'

const ui = useUiStore()

const tooltip = computed(() => {
  switch (ui.themeMode) {
    case 'light':
      return 'Açık tema'
    case 'dark':
      return 'Koyu tema'
    default:
      return 'Sistem teması'
  }
})

function onSelect(info: MenuInfo): void {
  ui.setThemeMode(String(info.key) as ThemeMode)
}
</script>

<template>
  <Dropdown :trigger="['click']" placement="bottomRight">
    <Button type="text" :aria-label="tooltip">
      <DesktopOutlined v-if="ui.themeMode === 'system'" />
      <SunIcon v-else-if="ui.themeMode === 'light'" />
      <MoonIcon v-else />
    </Button>
    <template #overlay>
      <Menu :selected-keys="[ui.themeMode]" @click="onSelect">
        <MenuItem key="system">
          <DesktopOutlined />
          <span style="margin-left: 8px">Sistem</span>
        </MenuItem>
        <MenuItem key="light">
          <SunIcon />
          <span style="margin-left: 8px">Açık</span>
        </MenuItem>
        <MenuItem key="dark">
          <MoonIcon />
          <span style="margin-left: 8px">Koyu</span>
        </MenuItem>
      </Menu>
    </template>
  </Dropdown>
</template>
