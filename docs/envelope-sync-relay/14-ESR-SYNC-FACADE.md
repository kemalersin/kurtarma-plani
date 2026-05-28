# 14 — `EsrSync` Facade (`@esr/client`)

> **Varsayılan entegrasyon yolu.** Uygulamalar önce bu belgeyi okur; düşük seviye `RelayClient` yalnızca özel araçlar için (doc 09 § Advanced).

`EsrSync`, `RelayClient` + `SyncEngine` + `NotificationClient` + yerel state + scheduler'ı tek oturumda birleştirir. Uygulama **yalnızca** belge adapter'ı, depolama adapter'ı ve birkaç UI callback sağlar.

---

## 1. Tasarım hedefleri

| Hedef | Açıklama |
|-------|----------|
| Tek giriş | `EsrSync.connect()` — token, revision, WS, debounce dahili |
| İnce uygulama yüzeyi | ~30–50 satır entegrasyon (adapter + hook'lar) |
| Zero-knowledge korunur | Recovery phrase / şifre sunucuya gitmez; SDK `@esr/protocol` kullanır |
| Gelişmiş erişim | `sync.relay` veya `RelayClient` export — debug, CLI, test |

---

## 2. Paket ve export

```typescript
// @esr/client — önerilen public API
export { EsrSync } from './esr-sync'
export type {
  DocumentAdapter,
  EsrStorage,
  EsrSyncConnectOptions,
  EsrSyncStatus,
  ConflictContext,
  DeviceLimitContext,
  PairingHostResult,
} from './types'

// Gelişmiş / test
export { RelayClient, SyncEngine, NotificationClient } from './advanced'
export * from '@esr/protocol' // re-export kimlik + zarf araçları
```

---

## 3. `EsrStorage`

SDK, `localStorage` örneği dayatmaz. Anahtar isimlendirmesi SDK içindedir (`esr.*` prefix).

```typescript
/** Async key-value — IndexedDB, SQLite, memory, Electron safeStorage wrapper */
export interface EsrStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Tarayıcı MVP */
export function createLocalStorageAdapter(): EsrStorage

/** Test / Node */
export function createMemoryStorageAdapter(): EsrStorage
```

SDK saklar (namespace başına scope `namespaceId` ile):

| Anahtar (mantıksal) | İçerik |
|---------------------|--------|
| `deviceToken` | Bearer token |
| `knownRemoteRevision` | Son uzak head revision |
| `recoveryPhrase` | Opsiyonel — yalnızca `persistRecoveryPhrase: true` ise |
| Global `clientDeviceId` | Kalıcı cihaz UUID |

---

## 4. `DocumentAdapter`

Doc 09 ile aynı sözleşme; değişmez.

```typescript
export interface DocumentAdapter {
  buildDocument(): Promise<string>
  importDocument(documentJson: string): Promise<void>
  contentType(): string
  encryption(): {
    enabled: boolean
    resolvePassword(): Promise<string | undefined>
  }
  namespaceId(): string
  namespaceLabel(): string
}
```

**Callback kısayolu** (opsiyonel factory):

```typescript
export function createDocumentAdapter(opts: {
  namespaceId: string
  namespaceLabel: string
  contentType: string
  exportDocument: () => Promise<unknown>
  importDocument: (data: unknown) => Promise<void>
  encrypt?: boolean
  resolvePassword?: () => Promise<string | undefined>
}): DocumentAdapter
```

---

## 5. `EsrSync.connect()`

```typescript
export interface EsrSyncConnectOptions {
  /** Örn. https://sync.example.com/v1 — sondaki slash yok */
  relayUrl: string

  document: DocumentAdapter

  storage: EsrStorage

  /** Sync kapalı başlat; enable() ile açılır */
  enabled?: boolean // default true

  /** Cihaz listesi / pairing etiketi */
  deviceLabel?: string // default: navigator.userAgent veya 'ESR Device'

  /** Scheduler */
  pushDebounceMs?: number      // default 2000
  pullIntervalConnectedMs?: number   // default 300_000 (WS açık)
  pullIntervalDisconnectedMs?: number // default 45_000
  pauseSchedulerWhenHidden?: boolean // default true

  /** WS bildirimleri (v1.1) */
  notificationsEnabled?: boolean // default true

  /** Recovery phrase'i storage'a yaz (güvenli depo sorumluluğu uygulamada) */
  persistRecoveryPhrase?: boolean // default false

  // --- UI / uygulama callback'leri (zorunlu olanlar *) ---

  /** Namespace create sonrası — phrase bir kez gösterilir * */
  onRecoveryPhrase: (ctx: {
    phrase: string
    namespaceId: string
  }) => void | Promise<void>

  /** İki tarafta da yerel + uzak değişiklik — kullanıcı seçimi * */
  onConflict: (ctx: ConflictContext) => Promise<'remote' | 'local' | 'cancel'>

  /** 403 DEVICE_LIMIT_* */
  onDeviceLimit?: (ctx: DeviceLimitContext) => void | Promise<void>

  /** Genel hata rozeti / log */
  onError?: (err: EsrError) => void

  /** Durum rozeti (opsiyonel) */
  onStatusChange?: (status: EsrSyncStatus) => void
}

export interface ConflictContext {
  namespaceId: string
  knownRevision: string | null
  remoteRevision: string
  remoteMeta: HeadMeta
}

export interface DeviceLimitContext {
  namespaceId: string
  code: 'DEVICE_LIMIT_PAYMENT_REQUIRED' | 'DEVICE_LIMIT_BLOCKED'
  limits: NamespaceLimits
  slotPackages?: number[]
}

export type EsrSyncStatus =
  | 'disabled'
  | 'idle'
  | 'syncing'
  | 'pending_push'
  | 'remote_pending'
  | 'conflict'
  | 'error'
  | 'offline'
  | 'ws_connected'

export class EsrSync {
  static async connect(options: EsrSyncConnectOptions): Promise<EsrSync>

  /** Mevcut namespace + token ile bağlan; yoksa ensureNamespace gerekir */
  readonly namespaceId: string
  readonly relayUrl: string

  /** Gelişmiş: doğrudan HTTP istemci */
  readonly relay: RelayClient

  // --- Yaşam döngüsü ---

  enable(): void
  disable(): void
  destroy(): void // WS kapat, timer temizle

  // --- Namespace (ilk kurulum) ---

  /**
   * Namespace yoksa oluşturur (recovery phrase üretir, onRecoveryPhrase çağırır).
   * Varsa token doğrular; geçersizse hata veya recover akışına yönlendirme.
   */
  ensureNamespace(opts?: {
    /** Yoksa generateNamespaceId(); varsa adapter.namespaceId() */
    namespaceId?: string
    namespaceLabel?: string
  }): Promise<EnsureNamespaceResult>

  // --- Pairing ---

  /** Host: pairing kodu + QR */
  startPairing(): Promise<PairingHostResult>

  /** Guest: kod ile katıl, ardından pull */
  joinPairing(pairingCode: string): Promise<void>

  // --- Senkron ---

  /** pull → conflict? → push — tam döngü */
  sync(): Promise<SyncRunResult>

  /** Yerel veri değişti (debounce push) */
  notifyLocalChange(): void

  /** Bekleyen push'u hemen gönder (logout öncesi) */
  flushPush(): Promise<void>

  // --- Cihaz / limit ---

  listDevices(): Promise<{ devices: DeviceInfo[]; limits: NamespaceLimits }>
  revokeDevice(deviceId: string): Promise<void>
  redeemUnlockCode(code: string): Promise<void>

  // --- Recovery ---

  recover(recoveryPhrase: string): Promise<void>

  // --- Conflict (manuel; onConflict yeterli çoğu zaman) ---

  resolveConflict(choice: 'remote' | 'local'): Promise<void>

  getStatus(): EsrSyncStatus
  getLastError(): EsrError | null
}

export interface EnsureNamespaceResult {
  namespaceId: string
  created: boolean
  recoveryPhrase?: string // yalnızca created === true
}

export interface PairingHostResult {
  code: string
  qrPayload: string
  expiresAt: string
}

export type SyncRunResult =
  | { status: 'ok' }
  | { status: 'conflict'; ctx: ConflictContext }
  | { status: 'offline' }
  | { status: 'error'; error: EsrError }
```

### 5.1 `ensureNamespace` davranışı

```
IF storage'da deviceToken AND GET namespace ok:
  → { created: false }
ELSE IF POST createNamespace başarılı:
  → generateRecoveryPhrase + buildRecoveryKeyProof (protocol)
  → onRecoveryPhrase(phrase)
  → opsiyonel storage'a phrase (persistRecoveryPhrase)
  → ilk push
  → { created: true, recoveryPhrase }
ELSE IF 409 NAMESPACE_EXISTS AND token yok:
  → hata: "Bu namespace başka cihazda oluşturulmuş; pairing veya recovery gerekir"
```

`namespaceId` kaynağı:

1. `opts.namespaceId`
2. yoksa `document.namespaceId()`
3. ikisi de geçersiz/boşsa `generateNamespaceId()` — uygulama dönen id'yi kalıcı kaydetmeli

---

## 6. Scheduler (dahili)

`connect()` sonrası SDK otomatik bağlar ( `enabled !== false` ise):

| Tetikleyici | Aksiyon |
|-------------|---------|
| `notifyLocalChange()` | debounce → `push()` |
| WS `head_changed` | `sync()` veya meta-only conflict check |
| `document.visibilitychange` → visible | `sync()` |
| `window.focus` | `sync()` |
| interval (WS kopuk / yok) | `sync()` — `pullIntervalDisconnectedMs` |
| interval (WS bağlı) | seyrek `sync()` — `pullIntervalConnectedMs` |

Uygulama `initSyncScheduler` çağırmaz.

---

## 7. Minimal entegrasyon örneği

```typescript
import { EsrSync, createLocalStorageAdapter, createDocumentAdapter } from '@esr/client'

const document = createDocumentAdapter({
  namespaceId: workspace.id, // veya create öncesi generateNamespaceId ile doldurulmuş
  namespaceLabel: workspace.name,
  contentType: 'application/vnd.example.snapshot+json',
  exportDocument: () => db.exportAll(),
  importDocument: (data) => db.importAll(data as ExportShape),
  encrypt: true,
  resolvePassword: () => promptSyncPassword(),
})

const sync = await EsrSync.connect({
  relayUrl: settings.relayUrl,
  document,
  storage: createLocalStorageAdapter(),

  onRecoveryPhrase: async ({ phrase }) => {
    await ui.showRecoveryModal(phrase)
  },

  onConflict: async (ctx) => {
    return ui.askConflict(ctx.remoteMeta.writtenAt)
  },

  onDeviceLimit: async (ctx) => {
    if (ctx.code === 'DEVICE_LIMIT_PAYMENT_REQUIRED') {
      await ui.showUnlockModal(ctx.slotPackages)
    } else {
      ui.toast('Cihaz limiti doldu')
    }
  },

  onStatusChange: (s) => ui.setSyncBadge(s),
})

// İlk kurulum (ayarlar sayfası)
await sync.ensureNamespace()

// İkinci cihaz — host
const pairing = await sync.startPairing()
ui.showCode(pairing.code, pairing.qrPayload)

// İkinci cihaz — guest
await sync.joinPairing(userEnteredCode)

// Günlük
db.onAfterCommit(() => sync.notifyLocalChange())
window.addEventListener('focus', () => void sync.sync())

// Kapatma
onLogout(() => sync.destroy())
```

---

## 8. Hata modeli

```typescript
export class EsrError extends Error {
  readonly code: string // API error code veya ESR_CLIENT_*
  readonly status?: number
  readonly details?: unknown
}

// İstemci kodları (örnek)
// ESR_CLIENT_OFFLINE
// ESR_CLIENT_NO_TOKEN
// ESR_CLIENT_NAMESPACE_REQUIRED
// ESR_CLIENT_CONFLICT_CANCELLED
```

`onDeviceLimit` çağrılmazsa limit hataları `onError` + `status: 'error'` olur.

---

## 9. Test

```typescript
import { EsrSync, createMemoryStorageAdapter } from '@esr/client'

const sync = await EsrSync.connect({
  relayUrl: mockServer.url,
  storage: createMemoryStorageAdapter(),
  document: mockAdapter,
  onRecoveryPhrase: () => {},
  onConflict: async () => 'remote',
})
```

Vitest: mock relay veya testcontainers; uygulama yalnızca adapter + callback mock'lar.

---

## 10. Uygulama checklist (facade)

- [ ] `DocumentAdapter` veya `createDocumentAdapter`
- [ ] `EsrStorage` (veya `createLocalStorageAdapter`)
- [ ] `EsrSync.connect` + `onRecoveryPhrase` + `onConflict`
- [ ] `ensureNamespace` / `startPairing` / `joinPairing` UX
- [ ] `notifyLocalChange` + `sync` hook'ları
- [ ] (Opsiyonel) `onDeviceLimit`, `redeemUnlockCode` UI

---

## 11. Advanced — `RelayClient` doğrudan

Doc [09-CLIENT-INTEGRATION-GUIDE.md](./09-CLIENT-INTEGRATION-GUIDE.md) §4–§14: özel scheduler, çoklu namespace oturumu, CLI, entegrasyon testleri düşük seviye.

**Kural:** Yeni uygulama entegrasyonları `EsrSync` ile başlar; `RelayClient` yalnızca facade'nin yetmediği durumlarda.

---

## 12. Implementasyon notu (`packages/client`)

```
packages/client/src/
  esr-sync.ts           # facade
  esr-sync-scheduler.ts
  esr-storage.ts        # adapters
  document-adapter.ts   # createDocumentAdapter
  relay-client.ts       # advanced
  sync-engine.ts        # EsrSync iç kullanım
  notification-client.ts
  index.ts              # public exports
```

Faz: [11-IMPLEMENTATION-PLAN.md](./11-IMPLEMENTATION-PLAN.md) — Faz 6c.
