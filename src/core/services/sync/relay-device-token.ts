const RELAY_STORAGE_PREFIX = 'esr'

/** Senkronla `EsrStorage` — `{namespaceId}:deviceToken` anahtarı. */
export function relayDeviceTokenStorageKey(namespaceId: string): string {
  return `${RELAY_STORAGE_PREFIX}.${namespaceId}:deviceToken`
}

export function readRelayDeviceToken(namespaceId: string): string | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage.getItem(relayDeviceTokenStorageKey(namespaceId))
}

export function clearRelayDeviceToken(namespaceId: string): void {
  if (typeof globalThis.localStorage === 'undefined') return
  globalThis.localStorage.removeItem(relayDeviceTokenStorageKey(namespaceId))
}

/** Namespace'e ait tüm `esr.{namespaceId}…` localStorage kayıtlarını siler. */
export function clearRelayNamespaceStorage(namespaceId: string): void {
  if (typeof globalThis.localStorage === 'undefined') return
  const prefix = `${RELAY_STORAGE_PREFIX}.${namespaceId}`
  const storage = globalThis.localStorage
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i)
    if (key?.startsWith(prefix)) {
      storage.removeItem(key)
    }
  }
}

export function hasRelayDeviceToken(namespaceId: string): boolean {
  return Boolean(readRelayDeviceToken(namespaceId))
}
