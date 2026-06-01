/** Relay namespace cihaz listesi — `@senkronla/client` ile uyumlu. */
export interface RelayDeviceInfo {
  deviceId: string
  clientDeviceId: string
  label: string
  pairedAt: string
  lastSeenAt: string | null
  isCurrent: boolean
}

export interface RelayNamespaceLimits {
  freeDeviceLimit: number
  purchasedSlots: number
  maxDevices: number
  activeDevices: number
  canAddDevice?: boolean
}

export interface RelayDevicesSnapshot {
  devices: RelayDeviceInfo[]
  limits: RelayNamespaceLimits
}

export type RelayDeviceLimitCode = 'DEVICE_LIMIT_PAYMENT_REQUIRED' | 'DEVICE_LIMIT_BLOCKED'

export interface RelayDeviceLimitContext {
  namespaceId: string
  code: RelayDeviceLimitCode
  limits: RelayNamespaceLimits
  slotPackages?: number[]
}
