/** Relay cihaz eşleştirme drawer sekmesi. */
export type RelayPairingMode = 'host' | 'guest' | 'recover'

export interface RelayPairingHostState {
  code: string
  qrPayload: string
  expiresAt: string
  allowedAppIds?: string[]
}
