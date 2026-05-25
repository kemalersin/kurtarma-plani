# 09 — İstemci Entegrasyon Kılavuzu

Bu belge, **herhangi bir uygulamanın** Envelope Sync Relay ile nasıl entegre olacağını adım adım açıklar. Uygulama-özel iş mantığı yalnızca `DocumentAdapter` içinde kalır.

## 1. Entegrasyon mimarisi

```
┌─────────────────────────────────────────┐
│ Your Application                        │
│  ├─ Local database (IndexedDB, SQLite)│
│  ├─ DocumentAdapter (YOU implement)     │
│  │    buildDocument() / importDocument()│
│  └─ UI (sync settings, devices, conflict)│
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ @esr/client                             │
│  RelayClient — HTTP transport           │
│  SyncEngine — pull/push/conflict/sched  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ @esr/protocol — ESR-DOC1                │
└─────────────────────────────────────────┘
```

## 2. DocumentAdapter (uygulama implement eder)

```typescript
export interface DocumentAdapter {
  /** Uygulama snapshot'ını JSON string olarak üret */
  buildDocument(): Promise<string>

  /** Uzak snapshot'ı yerel store'a uygula (merge/replace uygulama kararı) */
  importDocument(documentJson: string): Promise<void>

  /** İçerik MIME — envelope contentType */
  contentType(): string

  /** Şifreleme tercihleri */
  encryption(): {
    enabled: boolean
    /** Parola çözücü — profil parolası, sync parolası vb. */
    resolvePassword(): Promise<string | undefined>
  }

  /** Namespace kimliği — uygulama workspace/profil UUID */
  namespaceId(): string

  /** UI etiketi */
  namespaceLabel(): string
}
```

ESR SDK uygulama entity şemasını **bilmez**.

## 3. RelayClient yapılandırması

```typescript
import { RelayClient } from '@esr/client'

const client = new RelayClient({
  baseUrl: 'https://sync.example.com/v1',
  getDeviceToken: () => localStorage.getItem('esr.deviceToken'),
  onDeviceToken: (token) => localStorage.setItem('esr.deviceToken', token),
  clientDeviceId: getOrCreateClientDeviceId(),
})
```

## 4. İlk kurulum akışı

```typescript
async function setupSync(adapter: DocumentAdapter): Promise<SetupResult> {
  // 1. Recovery phrase üret (istemci)
  const recoveryPhrase = generateRecoveryPhrase24Words()
  const { salt, hash } = await hashRecoveryPhrase(recoveryPhrase)

  // 2. Namespace oluştur
  const result = await client.createNamespace({
    namespaceId: adapter.namespaceId(),
    namespaceLabel: adapter.namespaceLabel(),
    recoveryKeySalt: salt,
    recoveryKeyHash: hash,
    deviceLabel: getDeviceName(),
    clientDeviceId: client.clientDeviceId,
  })

  // 3. Token sakla
  client.setDeviceToken(result.deviceToken)

  // 4. Kullanıcıya recovery phrase göster (bir kez)
  await ui.showRecoveryPhrase(recoveryPhrase)

  // 5. İlk push
  await syncEngine.push()

  return { recoveryPhrase }
}
```

## 5. İkinci cihaz pairing

**Cihaz A (host):**

```typescript
const { code, qrPayload, expiresAt } = await client.createPairingToken(
  adapter.namespaceId()
)
ui.showPairingCode(code, qrPayload, expiresAt)
```

**Cihaz B:**

```typescript
await ui.promptPairingCode(async (code) => {
  const result = await client.redeemPairingCode({
    namespaceId: adapter.namespaceId(),
    pairingCode: code,
    deviceLabel: getDeviceName(),
  })
  client.setDeviceToken(result.deviceToken)
  await syncEngine.pull() // uzak veriyi al
})
```

**Limit hatası:**

```typescript
catch (e) {
  if (e.code === 'DEVICE_LIMIT_PAYMENT_REQUIRED') {
    ui.showUnlockModal(e.details.slotPackages)
  }
  if (e.code === 'DEVICE_LIMIT_BLOCKED') {
    ui.showBlockedMessage()
  }
}
```

## 6. SyncEngine davranışı

SDK sağlar veya uygulama kopyalar:

```typescript
class SyncEngine {
  constructor(
    private client: RelayClient,
    private adapter: DocumentAdapter,
    private state: SyncStateStore,
  ) {}

  /** Tam döngü: pull → conflict check → push */
  async syncFull(): Promise<SyncResult> {
    const meta = await this.client.getHeadMeta(this.adapter.namespaceId())
    const known = this.state.knownRemoteRevision

    if (meta && meta.revision !== known) {
      const decision = this.decidePull(meta.revision)
      if (decision === 'conflict') {
        return { status: 'conflict', remoteMeta: meta }
      }
      if (decision === 'pull') {
        const envelope = await this.client.getHead(this.adapter.namespaceId())
        await this.applyRemote(envelope)
      }
    }

    if (this.state.hasLocalChanges()) {
      await this.push()
    }

    return { status: 'ok' }
  }

  private decidePull(remoteRevision: string): 'none' | 'pull' | 'conflict' {
    if (remoteRevision === this.state.knownRemoteRevision) return 'none'
    if (this.state.hasLocalChangesSinceLastPush()) return 'conflict'
    return 'pull'
  }

  async push(): Promise<void> {
    const doc = await this.adapter.buildDocument()
    const password = this.adapter.encryption().enabled
      ? await this.adapter.encryption().resolvePassword()
      : undefined

    const envelope = await buildEnvelope({
      namespaceId: this.adapter.namespaceId(),
      namespaceLabel: this.adapter.namespaceLabel(),
      documentJson: doc,
      encrypt: this.adapter.encryption().enabled,
      password,
      deviceId: client.clientDeviceId,
      contentType: this.adapter.contentType(),
      expectedRevision: this.state.knownRemoteRevision,
    })

    try {
      const result = await this.client.pushDocument({
        namespaceId: this.adapter.namespaceId(),
        expectedRevision: this.state.knownRemoteRevision,
        envelope,
      })
      this.state.setKnownRemoteRevision(result.revision)
      this.state.clearLocalMutation()
    } catch (e) {
      if (e.code === 'REVISION_CONFLICT') {
        return { status: 'conflict', remoteMeta: e.details.remoteMeta }
      }
      throw e
    }
  }

  /** Entity save sonrası — 2s debounce */
  notifyLocalChange(): void { /* debounce push */ }
}
```

## 7. Conflict çözümü (istemci UI)

```typescript
async function resolveConflict(choice: 'remote' | 'local'): Promise<void> {
  if (choice === 'remote') {
    const envelope = await client.getHead(namespaceId)
    await applyRemote(envelope)
    state.clearLocalMutation()
  } else {
    // force push — expectedRevision remote head ile güncelle veya overwrite policy
    const meta = await client.getHeadMeta(namespaceId)
    state.setKnownRemoteRevision(meta.revision)
    await syncEngine.push() // may still 409 — then show error
  }
}
```

Sunucu merge yapmaz; **local wins** = push ile uzak ezilir.

## 8. Cihaz yönetimi UI

```typescript
const { devices, limits } = await client.listDevices(namespaceId)

// Kaldır
await client.revokeDevice(namespaceId, deviceId)

// Limit gösterimi
ui.render(`${devices.length} / ${limits.maxDevices} cihaz`)
```

## 9. Unlock kodu

```typescript
await client.redeemUnlockCode(namespaceId, unlockCode)
// retry pairing
```

## 10. Recovery

```typescript
async function recoverNamespace(
  namespaceId: string,
  recoveryPhrase: string,
): Promise<void> {
  const proof = await hashRecoveryPhrase(recoveryPhrase)
  const result = await client.recover({
    namespaceId,
    recoveryKeySalt: proof.salt,
    recoveryKeyHash: proof.hash,
    deviceLabel: getDeviceName(),
    clientDeviceId: newClientDeviceId(), // or reuse
  })
  client.setDeviceToken(result.deviceToken)
  await syncEngine.pull()
}
```

## 11. Offline davranış

| Durum | Davranış |
|-------|----------|
| Offline | Uygulama normal; `notifyLocalChange` queue işaretler |
| Online | WS `head_changed` veya visibility/focus/interval → HTTP pull |
| WS kopuk | Poll fallback (45 sn veya config) |
| Push fail network | Retry exponential backoff |
| Pull fail | Rozet hata; yerel veri korunur |

## 12. WebSocket bildirimleri (v1.1)

```typescript
import { NotificationClient } from '@esr/client'

const notifications = new NotificationClient({
  baseUrl: 'https://sync.example.com/v1',
  namespaceId: adapter.namespaceId(),
  getDeviceToken: () => client.getDeviceToken(),
  onHeadChanged: (meta) => syncEngine.handleRemoteHeadMeta(meta),
  pollIntervalMs: 45_000,       // WS connected iken seyrekleştirilebilir (örn. 300_000)
  pauseWhenHidden: true,
})

notifications.connect()
```

Tam spesifikasyon: [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md)

**Kurallar:**

- WS yalnızca tetikler; veri **her zaman HTTP pull**
- Reconnect sonrası `GET head/meta` zorunlu
- Conflict: `onHeadChanged` → conflict UI, kör pull yok

## 13. Scheduler hook'ları

Uygulama mount:

```typescript
initSyncScheduler({
  onVisibility: () => syncEngine.syncFull(),
  onFocus: () => syncEngine.syncFull(),
  pullIntervalMs: 300_000,  // WS connected; disconnected ise 45_000
  pushDebounceMs: 2_000,
  notificationClient,      // opsiyonel — doc 13
})

// Her local DB write sonrası:
entitiesStore.afterSave(() => syncEngine.notifyLocalChange())

// App lock / logout öncesi:
await syncEngine.flushPush()
```

## 14. Durum rozeti

| Durum | Koşul |
|-------|--------|
| disabled | sync kapalı |
| idle | güncel |
| pending_push | debounce queue |
| remote_pending | meta.revision != known, no local changes |
| conflict | conflict flag |
| error | lastError set |
| limit_blocked | DEVICE_LIMIT_BLOCKED |
| ws_connected | NotificationClient connected (opsiyonel UI) |

## 15. Paket bağımlılıkları (referans)

```json
{
  "dependencies": {
    "@esr/protocol": "^1.0.0",
    "@esr/client": "^1.0.0"
  }
}
```

Browser: native `fetch`, `crypto.subtle` (PBKDF2, AES-GCM, SHA-256).

Node: `undici` fetch, `crypto` module.

## 16. Test (uygulama tarafı)

- Mock RelayClient ile adapter round-trip
- Conflict simulation: two revisions
- Limit modal trigger codes
- Recovery flow integration test against testcontainers ESR

## 17. Checklist — entegrasyon tamamlandı mı?

- [ ] DocumentAdapter implement edildi
- [ ] Create namespace + recovery UX
- [ ] Pairing QR/code UX
- [ ] Device list + revoke
- [ ] Pull on startup / focus
- [ ] Debounced push on save
- [ ] Conflict modal
- [ ] Unlock / limit blocked UX
- [ ] Recovery flow
- [ ] device_token secure storage
- [ ] Error messages kullanıcı dostu
- [ ] (v1.1) NotificationClient + WS disconnect poll fallback
- [ ] Offline disabled state + açıklama
