import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  importBankingPresetFromJson,
  loadActiveBankingPreset,
  resetBankingPresetToBundled,
  updateBankingPresetFromFeed,
  type ActiveBankingPreset,
} from '@/core/services/banking-preset'
import { BUNDLED_BANKING_PRESET } from '@/data/banking-presets'

export const useBankingPresetStore = defineStore('bankingPreset', () => {
  const active = ref<ActiveBankingPreset>({
    preset: BUNDLED_BANKING_PRESET,
    updatedAt: null,
    source: 'bundled',
  })
  const loaded = ref(false)
  const loading = ref(false)
  const lastError = ref<string | null>(null)

  async function load(): Promise<void> {
    if (loaded.value) return
    loading.value = true
    try {
      active.value = await loadActiveBankingPreset()
      loaded.value = true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.value = false
    }
  }

  async function refreshFromFeed(feedUrl: string): Promise<boolean> {
    loading.value = true
    lastError.value = null
    try {
      active.value = await updateBankingPresetFromFeed(feedUrl)
      return true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function importFromText(text: string): Promise<boolean> {
    loading.value = true
    lastError.value = null
    try {
      active.value = await importBankingPresetFromJson(text)
      return true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function resetToBundled(): Promise<void> {
    loading.value = true
    try {
      active.value = await resetBankingPresetToBundled()
    } finally {
      loading.value = false
    }
  }

  return {
    active,
    loaded,
    loading,
    lastError,
    load,
    refreshFromFeed,
    importFromText,
    resetToBundled,
  }
})
