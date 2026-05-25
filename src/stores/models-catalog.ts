import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  loadActiveModelsCatalog,
  resetModelsCatalogToEmbedded,
  updateModelsCatalogFromRemote,
  type ActiveModelsCatalog,
} from '@/core/services/models-catalog'
import type { CloudCatalogProviderId, ModelsCatalog } from '@/core/types/ai-catalog'
import { EMBEDDED_MODELS_CATALOG } from '@/data/models-catalog'

export const useModelsCatalogStore = defineStore('modelsCatalog', () => {
  const active = ref<ActiveModelsCatalog>({
    catalog: EMBEDDED_MODELS_CATALOG,
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
      active.value = await loadActiveModelsCatalog()
      loaded.value = true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.value = false
    }
  }

  async function refreshFromRemote(): Promise<boolean> {
    loading.value = true
    lastError.value = null
    try {
      active.value = await updateModelsCatalogFromRemote()
      loaded.value = true
      return true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      loading.value = false
    }
  }

  async function resetToEmbedded(): Promise<void> {
    loading.value = true
    try {
      active.value = await resetModelsCatalogToEmbedded()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function providerCatalog(providerId: CloudCatalogProviderId) {
    return active.value.catalog.providers[providerId]
  }

  function modelCatalog(providerId: CloudCatalogProviderId, modelId: string) {
    return active.value.catalog.providers[providerId]?.models[modelId]
  }

  function listModelOptions(providerId: CloudCatalogProviderId): { value: string; label: string }[] {
    const block = providerCatalog(providerId)
    if (!block) return []
    return Object.values(block.models)
      .map((m) => ({ value: m.id, label: m.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'))
  }

  return {
    active,
    loaded,
    loading,
    lastError,
    load,
    refreshFromRemote,
    resetToEmbedded,
    providerCatalog,
    modelCatalog,
    listModelOptions,
  }
})

export type { ModelsCatalog }
