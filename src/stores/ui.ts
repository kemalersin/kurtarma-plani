import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'kp.ui'
const STORAGE_VERSION = 2

interface PersistedUiState {
  version: number
  themeMode: ThemeMode
  sidebarPinned: boolean
}

function readPersisted(): Partial<PersistedUiState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedUiState> & Record<string, unknown>
    // M1 öncesi şema (`sidebarCollapsed`) tespit edilirse layout tercihlerini sıfırla;
    // varsayılan "sabit menü" geri gelsin.
    if (parsed.version !== STORAGE_VERSION) {
      const { themeMode } = parsed
      return themeMode ? { themeMode } : {}
    }
    return parsed
  } catch {
    return {}
  }
}

function writePersisted(state: Omit<PersistedUiState, 'version'>): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, ...state }),
    )
  } catch {
    /* ignore */
  }
}

export const useUiStore = defineStore('ui', () => {
  const persisted = readPersisted()
  const themeMode = ref<ThemeMode>(persisted.themeMode ?? 'system')
  const sidebarPinned = ref<boolean>(persisted.sidebarPinned ?? true)
  const sidebarPeeking = ref(false)

  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia
      ? ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
      : ref(false)

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', (event) => {
      prefersDark.value = event.matches
    })
  }

  const isDark = computed(() => {
    if (themeMode.value === 'dark') return true
    if (themeMode.value === 'light') return false
    return prefersDark.value
  })

  function setThemeMode(mode: ThemeMode): void {
    themeMode.value = mode
  }

  function toggleTheme(): void {
    themeMode.value = isDark.value ? 'light' : 'dark'
  }

  const sidebarVisible = computed(() => sidebarPinned.value || sidebarPeeking.value)

  function setSidebarPinned(value: boolean): void {
    sidebarPinned.value = value
    if (value) sidebarPeeking.value = false
  }

  function toggleSidebarPin(): void {
    setSidebarPinned(!sidebarPinned.value)
  }

  function setSidebarPeeking(value: boolean): void {
    sidebarPeeking.value = value
  }

  watch(
    [themeMode, sidebarPinned],
    ([mode, pinned]) => {
      writePersisted({ themeMode: mode, sidebarPinned: pinned })
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
      }
    },
    { immediate: true },
  )

  return {
    themeMode,
    sidebarPinned,
    sidebarPeeking,
    sidebarVisible,
    isDark,
    setThemeMode,
    toggleTheme,
    setSidebarPinned,
    toggleSidebarPin,
    setSidebarPeeking,
  }
})
