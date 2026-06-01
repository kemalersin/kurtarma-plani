import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  clearRelayDeviceToken,
  clearRelayNamespaceStorage,
  readRelayDeviceToken,
  relayDeviceTokenStorageKey,
} from '@/core/services/sync/relay-device-token'

describe('relay-device-token', () => {
  const profileId = 'profile-abc'
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.stubGlobal('localStorage', {
      get length() {
        return storage.size
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => storage.clear(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('storage key Senkronla ile uyumlu', () => {
    expect(relayDeviceTokenStorageKey(profileId)).toBe('esr.profile-abc:deviceToken')
  })

  it('okur ve temizler', () => {
    storage.set(relayDeviceTokenStorageKey(profileId), 'token-1')
    expect(readRelayDeviceToken(profileId)).toBe('token-1')
    clearRelayDeviceToken(profileId)
    expect(readRelayDeviceToken(profileId)).toBeNull()
  })

  it('clearRelayNamespaceStorage namespace önekini temizler', () => {
    storage.set(relayDeviceTokenStorageKey(profileId), 'token-1')
    storage.set(`esr.${profileId}:primary:knownRemoteRevision`, 'rev-1')
    storage.set('esr.global:clientDeviceId', 'device-global')
    clearRelayNamespaceStorage(profileId)
    expect(readRelayDeviceToken(profileId)).toBeNull()
    expect(storage.has(`esr.${profileId}:primary:knownRemoteRevision`)).toBe(false)
    expect(storage.get('esr.global:clientDeviceId')).toBe('device-global')
  })
})
