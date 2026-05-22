import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { EncryptedRepo, type EntityRecord } from '@/core/db/encrypted-repo'
import type { EntityType } from '@/core/db/profile-db'
import { useProfileStore } from '@/stores/profile'
import { newId } from '@/core/util/id'

interface CollectionState<T> {
  items: T[]
  loaded: boolean
  loading: boolean
}

function emptyState<T>(): CollectionState<T> {
  return { items: [], loaded: false, loading: false }
}

/**
 * Profil DB'sindeki tüm entity tiplerini reaktif olarak yöneten generic store.
 * Profil kilitlenince bellekteki kayıtlar temizlenir; tekrar açıldığında reload edilir.
 */
export const useEntitiesStore = defineStore('entities', () => {
  const profileStore = useProfileStore()
  const collections = shallowRef<Partial<Record<EntityType, CollectionState<unknown>>>>({})
  const lastError = ref<string | null>(null)

  function getRepo(): EncryptedRepo {
    if (!profileStore.activeProfileId) {
      throw new Error('Aktif profil yok.')
    }
    return new EncryptedRepo(profileStore.activeProfileId, profileStore.dataKey)
  }

  function ensure<T>(type: EntityType): CollectionState<T> {
    const existing = collections.value[type] as CollectionState<T> | undefined
    if (existing) return existing
    const fresh = emptyState<T>()
    collections.value = { ...collections.value, [type]: fresh as CollectionState<unknown> }
    return fresh
  }

  async function load<T extends { id: string }>(type: EntityType): Promise<T[]> {
    const state = ensure<T>(type)
    state.loading = true
    lastError.value = null
    try {
      const records = await getRepo().list<T>(type)
      state.items = records.map((r) => r.data)
      state.loaded = true
      collections.value = { ...collections.value }
      return state.items
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      state.loading = false
      collections.value = { ...collections.value }
    }
  }

  function list<T extends { id: string }>(type: EntityType) {
    return computed<T[]>(() => {
      const state = collections.value[type] as CollectionState<T> | undefined
      return state?.items ?? []
    })
  }

  function loaded(type: EntityType) {
    return computed<boolean>(() => collections.value[type]?.loaded ?? false)
  }

  function loading(type: EntityType) {
    return computed<boolean>(() => collections.value[type]?.loading ?? false)
  }

  async function save<T extends { id: string; updatedAt: string; createdAt: string }>(
    type: EntityType,
    draft: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    options?: { sensitive?: boolean },
  ): Promise<T> {
    const repo = getRepo()
    const state = ensure<T>(type)
    const now = new Date().toISOString()
    const existing = draft.id
      ? state.items.find((item) => item.id === draft.id)
      : undefined
    const id = draft.id ?? newId()
    const data = {
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } as T

    await repo.put<T>({
      id,
      type,
      updatedAt: now,
      data,
      sensitive: options?.sensitive,
    } satisfies EntityRecord<T>)

    if (existing) {
      state.items = state.items.map((item) => (item.id === id ? data : item))
    } else {
      state.items = [...state.items, data]
    }
    collections.value = { ...collections.value }
    return data
  }

  async function remove(type: EntityType, id: string): Promise<void> {
    await getRepo().delete(id)
    const state = collections.value[type]
    if (state) {
      state.items = state.items.filter((item) => (item as { id: string }).id !== id)
      collections.value = { ...collections.value }
    }
  }

  function reset(): void {
    collections.value = {}
    lastError.value = null
  }

  return {
    collections,
    lastError,
    load,
    list,
    loaded,
    loading,
    save,
    remove,
    reset,
  }
})
