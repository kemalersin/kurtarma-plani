import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  exportRawKey,
  importRawKey,
  unwrapDataKey,
  wrapDataKey,
  type WrappedKey,
} from '@/core/crypto/aes'
import { buildPasswordInfo, unlockProfileKey } from '@/core/crypto/profile-key'
import {
  getAppMeta,
  getProfile,
  listProfiles,
  saveProfile,
  updateAppMeta,
} from '@/core/db/meta'
import { closeProfileDb, deleteProfileDb } from '@/core/db/profile-db'
import {
  migratePasswordlessEncryptedRows,
  profileHasPlainEntityRows,
  reencryptAll,
  repoEncryptionKey,
} from '@/core/db/encrypted-repo'
import { seedSampleProfileData } from '@/core/services/sample-data'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type {
  AppMeta,
  LocaleSettings,
  ProfileMeta,
  ProfilePasswordInfo,
} from '@/core/types/profile'
import { newId } from '@/core/util/id'

export interface CreateProfileInput {
  name: string
  localeSettings?: LocaleSettings
  password?: string
}

export type PasswordChangeResult = { ok: true } | { ok: false; error: string }

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<ProfileMeta[]>([])
  const appMeta = ref<AppMeta | null>(null)
  const activeProfileId = ref<string | null>(null)
  const unlocked = ref(false)
  const loaded = ref(false)
  /** Aktif profilin AES dataKey'i — şifreli kayıtları okumak/yazmak için kullanılır. */
  const dataKey = shallowRef<CryptoKey | null>(null)

  const activeProfile = computed<ProfileMeta | null>(() => {
    if (!activeProfileId.value) return null
    return profiles.value.find((p) => p.id === activeProfileId.value) ?? null
  })

  /** Parolasız profillerde null — IndexedDB düz JSON; parolalı profillerde AES dataKey. */
  const encryptionKey = computed<CryptoKey | null>(() =>
    repoEncryptionKey(activeProfile.value?.password.enabled ?? false, dataKey.value),
  )

  const hasAnyProfile = computed(() => profiles.value.length > 0)

  async function load(): Promise<void> {
    appMeta.value = await getAppMeta()
    profiles.value = await listProfiles()
    if (appMeta.value.activeProfileId) {
      const exists = await getProfile(appMeta.value.activeProfileId)
      if (exists) {
        activeProfileId.value = exists.id
        if (!exists.password.enabled) {
          // Parolasız profil sayfa yenilemede otomatik açılır; dataKey'i de hazırla.
          await openWithoutPassword(exists)
        }
      } else {
        await updateAppMeta({ activeProfileId: undefined })
      }
    }
    loaded.value = true
  }

  async function openWithoutPassword(profile: ProfileMeta): Promise<void> {
    const result = await unlockProfileKey(profile.password, undefined)
    if (!result) {
      // Parolasız profilde unlock asla null dönmemeli ama güvenlik için sessiz kal.
      unlocked.value = false
      dataKey.value = null
      return
    }
    if (result.migratedInfo) {
      const updated: ProfileMeta = {
        ...profile,
        password: result.migratedInfo,
        updatedAt: new Date().toISOString(),
      }
      await saveProfile(updated)
      profiles.value = await listProfiles()
    }
    dataKey.value = result.key
    if (!profile.password.enabled) {
      await migratePasswordlessEncryptedRows(profile.id, result.key)
    }
    unlocked.value = true
    const { onProfileUnlocked } = await import('@/core/services/sync/sync-scheduler')
    void onProfileUnlocked()
  }

  async function createProfile(input: CreateProfileInput): Promise<ProfileMeta> {
    const now = new Date().toISOString()
    const { info } = await buildPasswordInfo(input.password)

    const profile: ProfileMeta = {
      id: newId(),
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
      localeSettings: input.localeSettings ?? { ...DEFAULT_LOCALE_SETTINGS },
      password: info,
    }

    await saveProfile(profile)
    profiles.value = await listProfiles()
    return profile
  }

  async function selectProfile(id: string, password?: string): Promise<boolean> {
    const profile = await getProfile(id)
    if (!profile) return false

    const result = await unlockProfileKey(profile.password, password)
    if (!result) return false

    let stored = profile
    if (result.migratedInfo) {
      stored = {
        ...profile,
        password: result.migratedInfo,
        updatedAt: new Date().toISOString(),
      }
    }

    const now = new Date().toISOString()
    const updated: ProfileMeta = { ...stored, lastOpenedAt: now, updatedAt: now }
    await saveProfile(updated)
    profiles.value = await listProfiles()

    dataKey.value = result.key
    if (!stored.password.enabled) {
      await migratePasswordlessEncryptedRows(id, result.key)
    }
    activeProfileId.value = id
    unlocked.value = true
    appMeta.value = await updateAppMeta({ activeProfileId: id })
    const { onProfileUnlocked } = await import('@/core/services/sync/sync-scheduler')
    void onProfileUnlocked()
    return true
  }

  async function lock(): Promise<void> {
    const { flushSyncPushNow } = await import('@/core/services/sync/sync-scheduler')
    try {
      await flushSyncPushNow()
    } catch {
      // Hata sync store'da kayıtlı kalır
    }
    if (activeProfileId.value) {
      await closeProfileDb(activeProfileId.value)
    }
    unlocked.value = false
    dataKey.value = null
    activeProfileId.value = null
    appMeta.value = await updateAppMeta({ activeProfileId: undefined })
    const { useSyncStore } = await import('@/stores/sync')
    void useSyncStore().onActiveProfileChanged()
    // Profil önbelleklerini sıfırla; başka profile geçildiğinde reload tetiklenir.
    const { useEntitiesStore } = await import('@/stores/entities')
    useEntitiesStore().reset()
    const { useAiStore } = await import('@/stores/ai')
    useAiStore().reset()
  }

  async function removeProfile(id: string): Promise<void> {
    if (activeProfileId.value === id) {
      await lock()
    } else {
      await closeProfileDb(id)
    }
    await deleteProfileDb(id)
    await import('@/core/db/meta').then((m) => m.deleteProfile(id))
    profiles.value = await listProfiles()
  }

  async function seedActiveProfileSampleData(): Promise<number> {
    if (!activeProfileId.value) throw new Error('Aktif profil yok.')
    const currency = activeProfile.value?.localeSettings.currency ?? 'TRY'
    const count = await seedSampleProfileData(
      activeProfileId.value,
      encryptionKey.value,
      currency,
    )
    const { useEntitiesStore } = await import('@/stores/entities')
    useEntitiesStore().reset()
    return count
  }

  /**
   * Aktif profile parola ata veya değiştir. Profil DB'sindeki tüm kayıtlar
   * yeni anahtarla yeniden şifrelenir (dataKey yeniden üretilmez; yalnız
   * wrappedKey değişebilir).
   */
  async function setPassword(
    currentPassword: string | null,
    newPassword: string,
  ): Promise<PasswordChangeResult> {
    if (!activeProfileId.value) return { ok: false, error: 'Aktif profil yok.' }
    if (!dataKey.value) return { ok: false, error: 'Profil kilitli; mevcut anahtar yok.' }
    const profile = await getProfile(activeProfileId.value)
    if (!profile) return { ok: false, error: 'Profil bulunamadı.' }

    if (profile.password.enabled && !currentPassword) {
      return { ok: false, error: 'Mevcut parola gerekli.' }
    }
    if (newPassword.length < 6) {
      return { ok: false, error: 'Yeni parola en az 6 karakter olmalı.' }
    }

    // Mevcut parolayı (varsa) doğrulamak için unwrap dene; eski anahtarı kıyasla.
    if (profile.password.enabled && currentPassword) {
      const verify = await unlockProfileKey(profile.password, currentPassword)
      if (!verify) return { ok: false, error: 'Mevcut parola yanlış.' }
    }

    // Parolasız profilde kayıtlar meta'daki dataKey ile zaten AES'li olabilir; yalnızca
    // düz kayıtlar varsa mevcut anahtarla şifrele. Parola wrap'i aynı dataKey'i korur.
    const wasEncrypted = profile.password.enabled
    const newWrapped = await wrapDataKey(dataKey.value, newPassword)
    const newInfo: ProfilePasswordInfo = {
      enabled: true,
      wrappedKey: newWrapped.wrappedKey,
      wrapIv: newWrapped.wrapIv,
      salt: newWrapped.salt,
      iterations: newWrapped.iterations,
    }

    if (!wasEncrypted) {
      if (await profileHasPlainEntityRows(activeProfileId.value)) {
        await reencryptAll(activeProfileId.value, dataKey.value, dataKey.value)
      }
    }

    const updated: ProfileMeta = {
      ...profile,
      password: newInfo,
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(updated)
    profiles.value = await listProfiles()
    return { ok: true }
  }

  /**
   * Aktif profilden parolayı kaldır. Profil DB'sindeki tüm şifreli kayıtlar
   * düz JSON formatına çözülerek yeniden yazılır.
   */
  async function clearPassword(currentPassword: string): Promise<PasswordChangeResult> {
    if (!activeProfileId.value) return { ok: false, error: 'Aktif profil yok.' }
    if (!dataKey.value) return { ok: false, error: 'Profil kilitli; mevcut anahtar yok.' }
    const profile = await getProfile(activeProfileId.value)
    if (!profile) return { ok: false, error: 'Profil bulunamadı.' }
    if (!profile.password.enabled) return { ok: false, error: 'Profilin parolası zaten yok.' }

    const verify = await unlockProfileKey(profile.password, currentPassword)
    if (!verify) return { ok: false, error: 'Mevcut parola yanlış.' }

    await reencryptAll(activeProfileId.value, dataKey.value, null)

    const raw = await exportRawKey(dataKey.value)
    const updated: ProfileMeta = {
      ...profile,
      password: { enabled: false, dataKey: raw },
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(updated)
    profiles.value = await listProfiles()
    return { ok: true }
  }

  return {
    profiles,
    appMeta,
    activeProfileId,
    activeProfile,
    unlocked,
    loaded,
    hasAnyProfile,
    dataKey,
    encryptionKey,
    load,
    createProfile,
    selectProfile,
    lock,
    removeProfile,
    seedActiveProfileSampleData,
    setPassword,
    clearPassword,
  }
})

// Yardımcı: parola wrap altyapısı dışarıya açılmaz; ileride doğrudan AES servisi kullanılabilir.
export type { WrappedKey }
export { importRawKey, unwrapDataKey }
