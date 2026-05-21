import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { hashPassword, verifyPassword } from '@/core/crypto/password'
import {
  getAppMeta,
  getProfile,
  listProfiles,
  saveProfile,
  updateAppMeta,
} from '@/core/db/meta'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type { AppMeta, LocaleSettings, ProfileMeta } from '@/core/types/profile'
import { newId } from '@/core/util/id'

export interface CreateProfileInput {
  name: string
  localeSettings?: LocaleSettings
  password?: string
}

export const useProfileStore = defineStore('profile', () => {
  const profiles = ref<ProfileMeta[]>([])
  const appMeta = ref<AppMeta | null>(null)
  const activeProfileId = ref<string | null>(null)
  const unlocked = ref(false)
  const loaded = ref(false)

  const activeProfile = computed<ProfileMeta | null>(() => {
    if (!activeProfileId.value) return null
    return profiles.value.find((p) => p.id === activeProfileId.value) ?? null
  })

  const hasAnyProfile = computed(() => profiles.value.length > 0)

  async function load(): Promise<void> {
    appMeta.value = await getAppMeta()
    profiles.value = await listProfiles()
    if (appMeta.value.activeProfileId) {
      const exists = await getProfile(appMeta.value.activeProfileId)
      if (exists) {
        activeProfileId.value = exists.id
        // Parolasız profil sayfa yenilemede otomatik açılır.
        // Parolalı profilde kullanıcı yine `/select`'e düşürülür ve parola sorulur.
        if (!exists.password.enabled) {
          unlocked.value = true
        }
      } else {
        await updateAppMeta({ activeProfileId: undefined })
      }
    }
    loaded.value = true
  }

  async function createProfile(input: CreateProfileInput): Promise<ProfileMeta> {
    const now = new Date().toISOString()
    const passwordInfo = input.password
      ? { enabled: true as const, ...(await hashPassword(input.password)) }
      : { enabled: false as const }

    const profile: ProfileMeta = {
      id: newId(),
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now,
      localeSettings: input.localeSettings ?? { ...DEFAULT_LOCALE_SETTINGS },
      password: passwordInfo,
    }

    await saveProfile(profile)
    profiles.value = await listProfiles()
    return profile
  }

  async function selectProfile(id: string, password?: string): Promise<boolean> {
    const profile = await getProfile(id)
    if (!profile) return false

    if (profile.password.enabled) {
      if (!password) return false
      const ok = await verifyPassword(
        password,
        profile.password.hash ?? '',
        profile.password.salt ?? '',
        profile.password.iterations ?? 0,
      )
      if (!ok) return false
    }

    const now = new Date().toISOString()
    const updated: ProfileMeta = { ...profile, lastOpenedAt: now, updatedAt: now }
    await saveProfile(updated)
    profiles.value = await listProfiles()
    activeProfileId.value = id
    unlocked.value = true
    appMeta.value = await updateAppMeta({ activeProfileId: id })
    return true
  }

  async function lock(): Promise<void> {
    unlocked.value = false
    activeProfileId.value = null
    appMeta.value = await updateAppMeta({ activeProfileId: undefined })
  }

  /**
   * Aktif profile parola ata veya değiştir.
   * - Profilin halihazırda parolası varsa `currentPassword` gerekli.
   * - Yeni parola en az 6 karakter olmalı.
   *
   * NOT (M2): Profil verisi şifreli store'a taşındığında parola değişiminde
   * mevcut anahtarla decrypt → yeni anahtarla re-encrypt çağrısı buraya eklenir.
   */
  async function setPassword(
    currentPassword: string | null,
    newPassword: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!activeProfileId.value) return { ok: false, error: 'Aktif profil yok.' }
    const profile = await getProfile(activeProfileId.value)
    if (!profile) return { ok: false, error: 'Profil bulunamadı.' }

    if (profile.password.enabled) {
      if (!currentPassword) return { ok: false, error: 'Mevcut parola gerekli.' }
      const ok = await verifyPassword(
        currentPassword,
        profile.password.hash ?? '',
        profile.password.salt ?? '',
        profile.password.iterations ?? 0,
      )
      if (!ok) return { ok: false, error: 'Mevcut parola yanlış.' }
    }

    if (newPassword.length < 6) {
      return { ok: false, error: 'Yeni parola en az 6 karakter olmalı.' }
    }

    const passwordInfo = { enabled: true as const, ...(await hashPassword(newPassword)) }

    const updated: ProfileMeta = {
      ...profile,
      password: passwordInfo,
      updatedAt: new Date().toISOString(),
    }
    await saveProfile(updated)
    profiles.value = await listProfiles()
    return { ok: true }
  }

  /**
   * Aktif profilden parolayı kaldır. Mevcut parola doğrulaması gereklidir.
   *
   * NOT (M2): Profil verisi şifreliyken parola kaldırılırsa veri düz JSON'a
   * dönüştürülmelidir. Şu an profil verisi şifrelenmediği için ek iş yoktur.
   */
  async function clearPassword(
    currentPassword: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!activeProfileId.value) return { ok: false, error: 'Aktif profil yok.' }
    const profile = await getProfile(activeProfileId.value)
    if (!profile) return { ok: false, error: 'Profil bulunamadı.' }
    if (!profile.password.enabled) return { ok: false, error: 'Profilin parolası zaten yok.' }

    const ok = await verifyPassword(
      currentPassword,
      profile.password.hash ?? '',
      profile.password.salt ?? '',
      profile.password.iterations ?? 0,
    )
    if (!ok) return { ok: false, error: 'Mevcut parola yanlış.' }

    const updated: ProfileMeta = {
      ...profile,
      password: { enabled: false },
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
    load,
    createProfile,
    selectProfile,
    lock,
    setPassword,
    clearPassword,
  }
})
