import { buildPasswordInfo } from '@/core/crypto/profile-key'
import { getProfile, saveProfile } from '@/core/db/meta'
import { openProfileDb } from '@/core/db/profile-db'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type { ProfileMeta } from '@/core/types/profile'
import { hasRelayDeviceToken } from '@/core/services/sync/relay-device-token'

/** Kurulum Senkronla iskelet profil varsayılan adı. */
export const SETUP_PROFILE_STUB_LABEL = 'Senkronla'

/** Başarısız kurulumdan kalan boş iskelet (relay token yok, kayıt yok). */
export async function isEmptySetupProfileStub(namespaceId: string): Promise<boolean> {
  const profile = await getProfile(namespaceId)
  if (!profile) return false
  if (hasRelayDeviceToken(namespaceId)) return false
  return isRemovableSetupProfileStub(namespaceId)
}

/** Veri içe aktarılmamış «Senkronla» iskeleti (token alınmış olsa bile silinebilir). */
export async function isRemovableSetupProfileStub(namespaceId: string): Promise<boolean> {
  const profile = await getProfile(namespaceId)
  if (!profile) return false
  if (profile.name !== SETUP_PROFILE_STUB_LABEL) return false
  const count = await openProfileDb(namespaceId).entities.count()
  return count === 0
}

/** Kurulum Senkronla: relay namespace = profil kimliği; yerel kayıt yoksa iskelet profil oluşturur. */
export async function ensureSetupProfileStub(
  namespaceId: string,
  label = SETUP_PROFILE_STUB_LABEL,
): Promise<ProfileMeta> {
  const existing = await getProfile(namespaceId)
  if (existing) return existing

  const now = new Date().toISOString()
  const { info } = await buildPasswordInfo(undefined)
  const profile: ProfileMeta = {
    id: namespaceId,
    name: label,
    createdAt: now,
    updatedAt: now,
    localeSettings: { ...DEFAULT_LOCALE_SETTINGS },
    password: info,
  }
  await saveProfile(profile)
  return profile
}
