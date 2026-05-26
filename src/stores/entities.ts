import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { EncryptedRepo, type EntityRecord } from '@/core/db/encrypted-repo'
import type { EntityType } from '@/core/db/profile-db'
import { useProfileStore } from '@/stores/profile'
import { newId } from '@/core/util/id'
import { notifySyncLocalChange } from '@/core/services/sync/sync-scheduler'

interface CollectionState<T> {
  items: T[]
  sensitiveById: Record<string, boolean>
  loaded: boolean
  loading: boolean
}

function emptyState<T>(): CollectionState<T> {
  return { items: [], sensitiveById: {}, loaded: false, loading: false }
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
    return new EncryptedRepo(profileStore.activeProfileId, profileStore.encryptionKey)
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
      const sensitiveById: Record<string, boolean> = {}
      for (const record of records) {
        if (record.sensitive) sensitiveById[record.id] = true
      }
      state.items = records.map((r) => r.data)
      state.sensitiveById = sensitiveById
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

  function isSensitive(type: EntityType, id: string): boolean {
    const state = collections.value[type]
    return !!state?.sensitiveById[id]
  }

  function isSensitiveById(id: string): boolean {
    for (const state of Object.values(collections.value)) {
      if (state?.sensitiveById[id]) return true
    }
    return false
  }

  async function save<T extends { id: string; updatedAt: string; createdAt: string }>(
    type: EntityType,
    draft: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    options?: { sensitive?: boolean },
  ): Promise<T> {
    const [saved] = await saveMany<T>(type, [draft], options)
    return saved
  }

  async function saveMany<T extends { id: string; updatedAt: string; createdAt: string }>(
    type: EntityType,
    drafts: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }>,
    options?: { sensitive?: boolean },
  ): Promise<T[]> {
    if (drafts.length === 0) return []

    const repo = getRepo()
    const state = ensure<T>(type)
    const now = new Date().toISOString()
    const existingById = new Map(state.items.map((item) => [item.id, item]))

    const saved: T[] = drafts.map((draft) => {
      const existing = draft.id ? existingById.get(draft.id) : undefined
      const id = draft.id ?? newId()
      return {
        ...draft,
        id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      } as T
    })

    await repo.putMany<T>(
      saved.map(
        (data) =>
          ({
            id: data.id,
            type,
            updatedAt: now,
            data,
            sensitive: options?.sensitive ? true : undefined,
          }) satisfies EntityRecord<T>,
      ),
    )

    const sensitiveById = { ...state.sensitiveById }
    const updatedById = new Map(saved.map((item) => [item.id, item]))
    const seen = new Set<string>()
    const items: T[] = []
    for (const item of state.items) {
      if (updatedById.has(item.id)) {
        items.push(updatedById.get(item.id)!)
        seen.add(item.id)
      } else {
        items.push(item)
      }
    }
    for (const item of saved) {
      if (!seen.has(item.id)) items.push(item)
    }

    if (options?.sensitive) {
      for (const item of saved) sensitiveById[item.id] = true
    } else {
      for (const item of saved) delete sensitiveById[item.id]
    }

    state.items = items
    state.sensitiveById = sensitiveById
    collections.value = { ...collections.value }
    notifySyncLocalChange()
    return saved
  }

  async function remove(type: EntityType, id: string): Promise<void> {
    await getRepo().delete(id)
    const state = collections.value[type]
    if (state) {
      state.items = state.items.filter((item) => (item as { id: string }).id !== id)
      if (state.sensitiveById[id]) {
        const { [id]: _removed, ...rest } = state.sensitiveById
        state.sensitiveById = rest
      }
      collections.value = { ...collections.value }
    }
    notifySyncLocalChange()
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
    saveMany,
    remove,
    reset,
    isSensitive,
    isSensitiveById,
  }
})
