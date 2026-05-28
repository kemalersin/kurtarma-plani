# Kurtarma Planı — Envelope Sync Relay (ESR) Entegrasyonu

Bu belge, **Kurtarma Planı** uygulamasının evrensel [Envelope Sync Relay](../envelope-sync-relay/README.md) servisi ile nasıl entegre edileceğini tanımlar.

ESR spesifikasyonu uygulama-bağımsızdır; bu belge yalnızca KP tarafındaki eşleme, migration ve geliştirme planını içerir.

---

## 1. Eşleme tablosu

| Kurtarma Planı | ESR |
|----------------|-----|
| Aktif profil (`ProfileMeta.id`) | `namespaceId` |
| Profil adı (`ProfileMeta.name`) | `namespaceLabel` |
| `buildSnapshot` / `importSnapshot` | `DocumentAdapter` içeriği |
| `deviceId` (AppMeta) | Envelope `deviceId` + ESR `clientDeviceId` |
| `SyncConfig` (AppMeta.sync) | KP sync ayarları + yeni `transport` alanı |
| Mevcut dosya sync (`KP-SYNC1`) | Alternatif transport; ESR ile birlikte veya yerine |
| Ayarlar → Senkron (`SyncSettingsSection`) | UI genişletmesi |
| `useSyncStore` | Relay transport + mevcut file transport |

**Namespace:** Aktif profil UUID'si (`ProfileMeta.id`) — ESR'de global benzersiz `namespaceId`. KP `generateNamespaceId()` **kullanmaz** (profil zaten UUID); doğrulama için `isValidNamespaceId(profile.id)` yeterli.

**Recovery phrase:** `@esr/protocol.generateRecoveryPhrase()` + `buildRecoveryKeyProof()` — KP içinde BIP39/Argon2 kopyası yok.

**Document:**

```
documentId: primary   (ESR v1 — profil başına tek belge)
```

**contentType:**

```
application/vnd.kurtarma-plani.snapshot+json
```

Operatör isteğe bağlı olarak ESR config'de `allowedContentTypes` ile yalnızca bu MIME'ı kabul edebilir.

---

## 2. Mimari (KP + ESR)

```
┌─────────────────────────────────────────────────────────┐
│ Kurtarma Planı (Vue + Dexie)                            │
│  buildSnapshot / importSnapshot  ← mevcut, değişmez     │
│  KpDocumentAdapter               ← yeni ince katman     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│ src/core/services/sync/ (mevcut sync-engine mantığı)  │
│  + RelayTransport (@esr/client veya yerel kopya)        │
│  + FileTransport (mevcut sync-file — korunur)           │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
   ESR HTTP Relay                   KP-SYNC1 dosya
   (self-hosted)                    (iCloud / FS Access)
```

**Kural:** Aynı profil aynı anda **yalnızca bir** head kaynağı kullanmalı (`transport: 'relay' | 'file'`).

---

## 3. DocumentAdapter (KP implementasyonu)

ESR client SDK'sının beklediği arayüzün KP karşılığı:

```typescript
// src/core/services/sync/kp-document-adapter.ts

import { buildSnapshot, importSnapshot } from '@/core/services/snapshot'
import type { ProfileMeta } from '@/core/types/profile'
import { EXPORT_FILE_TYPE } from '@/core/constants'

export const KP_CONTENT_TYPE = 'application/vnd.kurtarma-plani.snapshot+json'

export interface KpDocumentAdapterContext {
  profile: ProfileMeta
  dataKey: CryptoKey | null
  syncConfig: Pick<SyncConfig, 'includeSensitive' | 'includeSecrets' | 'encryptFile' | 'useProfilePassword'>
  resolveSyncPassword: () => string | undefined
}

export function createKpDocumentAdapter(ctx: KpDocumentAdapterContext) {
  return {
    namespaceId: () => ctx.profile.id,
    namespaceLabel: () => ctx.profile.name,
    contentType: () => KP_CONTENT_TYPE,

    encryption: () => ({
      enabled: ctx.syncConfig.encryptFile,
      useProfilePassword: ctx.syncConfig.useProfilePassword,
      resolvePassword: () => ctx.resolveSyncPassword(),
    }),

    async buildDocument(): Promise<string> {
      const snapshot = await buildSnapshot(
        {
          includeSensitive: ctx.syncConfig.includeSensitive,
          includeSecrets: ctx.syncConfig.includeSecrets,
          encryptFile: false, // inner ENV-ENC1 ayrı katmanda
        },
        { profile: ctx.profile, key: ctx.dataKey },
      )
      return JSON.stringify(snapshot)
    },

    async importDocument(documentJson: string): Promise<void> {
      const snapshot = JSON.parse(documentJson)
      // ExportSnapshotSchema validate (snapshot-import ile aynı)
      await importSnapshot(snapshot, {
        overwriteProfileId: ctx.profile.id,
        dataKey: ctx.dataKey,
      })
    },
  }
}
```

Snapshot şeması (`kurtarma-plani-export`) ESR'den bağımsız kalır; ESR yalnızca şifreli `ENV-ENC1` wrapper taşır.

---

## 4. Zarf dönüşümü: KP-SYNC1 ↔ ESR-DOC1

Mevcut dosya sync `KP-SYNC1` kullanır. ESR relay `ESR-DOC1` kullanır. Alan eşlemesi:

| KP-SYNC1 | ESR-DOC1 |
|----------|----------|
| `magic: KP-SYNC1` | `magic: ESR-DOC1` |
| `profileId` | `namespaceId` |
| `profileName` | `namespaceLabel` |
| — | `documentId: primary` |
| `contentMagic: KP-RAW1 \| KP-ENC1` | `contentMagic: ENV-RAW1 \| ENV-ENC1` |
| `payload` | `payload` (aynı inner encode mantığı) |

**Öneri:** `@esr/protocol` inner `ENV-ENC1` kullanır; KP mevcut `encodeSnapshotFile` / `decodeSnapshotFile` fonksiyonlarını adapter içinde ENV formatına sarmalayın veya ortak bir `encodeInnerPayload` çıkarın.

Dosya transport (`KP-SYNC1`) **korunur** — mevcut kullanıcılar etkilenmez. Relay transport yeni zarf üretir.

---

## 5. SyncConfig genişlemesi

`src/core/types/sync.ts` — AppMeta migration v5:

```typescript
export type SyncTransport = 'file' | 'relay'

export const SyncConfigSchema = z.object({
  // ... mevcut alanlar
  transport: z.enum(['file', 'relay']).default('file'),
  relayUrl: z.string().url().optional(),
  // file transport: mevcut syncMode, fileNameByProfile, ...
  // relay transport: deviceToken ESR tarafında namespace başına
  relayDeviceTokenByProfile: z.record(z.string(), z.string()).optional(),
  relayKnownRevisionByProfile: z.record(z.string(), z.string()).optional(),
})
```

| Transport | Handle / pairing |
|-----------|------------------|
| `file` | Mevcut FS Access + manual mod |
| `relay` | ESR pairing + device token; `relayUrl` zorunlu |

`enabled: false` iken transport fark etmez; I/O yok.

---

## 6. useSyncStore değişiklikleri

Mevcut store korunur; transport delegasyonu eklenir:

```typescript
// Pseudocode
async function pushOnly() {
  if (config.transport === 'relay') {
    return relayPush(...)
  }
  return filePush(...) // mevcut runPushSync
}

async function pullIfEnabled() {
  if (config.transport === 'relay') {
    return relayPull(...)
  }
  return filePull(...)
}
```

**Relay-specific state (Pinia veya AppMeta):**

- `relayDeviceToken` — profil başına
- ESR limits (cihaz listesi) — UI için `GET .../devices`

**Mevcut korunan:**

- `markLocalMutation`, debounce scheduler
- Conflict modal (`SyncConflictModal`)
- `pullRevision`, store reload after pull

---

## 7. UI: SyncSettingsSection

Mevcut kart korunur; üstte transport seçimi:

```
Senkron yöntemi:
  ( ) Dosya (iCloud / Dropbox klasörü)   ← mevcut
  ( ) Envelope Sync Relay                ← yeni

[Relay seçiliyse]
  Sunucu adresi: [https://sync.example.com/v1]
  [Bağlan / Namespace oluştur]
  Eşleşik cihazlar (2 / 5)  … mevcut cihaz listesi pattern
  [+ Cihaz ekle] → pairing kodu
  [Slot paketi / Unlock kodu]  → ESR 403 handling
```

**ESR hata kodları → KP UI:**

| ESR code | KP mesaj / aksiyon |
|----------|-------------------|
| `DEVICE_LIMIT_PAYMENT_REQUIRED` | Modal: paket listesi + unlock kodu alanı |
| `DEVICE_LIMIT_BLOCKED` | Alert: limit doldu, cihaz kaldırın |
| `REVISION_CONFLICT` | Mevcut `SyncConflictModal` |
| `DEVICE_TOKEN_INVALID` | Senkronu sıfırla / recovery yönlendir |

Şifreleme, hassas veri, AI anahtarı seçenekleri **her iki transport'ta aynı** kalır (`buildSnapshot` options).

---

## 8. Recovery

| | Dosya sync | ESR relay |
|--|------------|-----------|
| KP recovery | Export dosyası / ProfileRestorePanel | ESR `POST .../recover` + KP recovery phrase |
| Phrase | Profil kurulumunda (parolalı profil) | ESR namespace create'te **ayrı** 24 kelime veya KP phrase'i hash'leyip ESR'ye gönder |

**Öneri (basit):** ESR recovery için KP kurulum akışında ayrı ESR recovery phrase üret ve göster; profil parolasından bağımsız. Alternatif: aynı phrase'in hash'ini hem KP hem ESR'de kullan (daha riskli UX — tek phrase iki amaç).

MVP entegrasyon: **ESR recovery phrase ayrı** — Ayarlar → Senkron → «Recovery anahtarını göster». Üretim yalnızca `@esr/protocol` (veya `@esr/client` re-export).

---

## 9. Profil başına izolasyon

KP çoklu profil destekler; ESR namespace = profil id:

```
Profil A (uuid-a) → namespace uuid-a, ayrı device tokens, ayrı relay head
Profil B (uuid-b) → namespace uuid-b, ...
```

Profil değişiminde `syncStore.onActiveProfileChanged()` mevcut mantık + relay token/handle switch.

---

## 10. Bağımlılıklar

```json
{
  "dependencies": {
    "@esr/protocol": "^1.0.0",
    "@esr/client": "^1.0.0"
  }
}
```

ESR henüz npm'de yoksa geçici: `packages/esr-client` vendor copy veya git submodule — entegrasyon fazında karar verilir.

KP build kısıtları korunur: tek HTML bundle, hash routing, offline-first.

---

## 11. Geliştirme fazları (KP tarafı)

ESR servisi ayrı repo/agent'ta geliştirilir. KP entegrasyonu ESR v1 hazır olduktan sonra:

| Faz | KP iş | Bağımlılık |
|-----|-------|------------|
| **KP-R1** | `@esr/client` + `KpDocumentAdapter` + unit test; recovery `@esr/protocol` araçları | ESR protocol paketi (kimlik export'ları dahil) |
| **KP-R2** | `SyncConfig.transport`, `relayUrl`, meta migration | — |
| **KP-R3** | `RelayTransport` in sync-engine; push/pull/conflict | ESR server docker |
| **KP-R4** | `SyncSettingsSection` relay UI, cihaz listesi, pairing | ESR pairing API |
| **KP-R5** | Limit / unlock modal (ESR error codes) | ESR slot API |
| **KP-R6** | Recovery UX, ProfileRestorePanel ESR namespace adopt | ESR recover API |
| **KP-R7** | E2E: 2 cihaz relay sync; regression file sync | — |
| **KP-R8** | `NotificationClient`; relay'de WS + poll fallback; dosya sync'te mevcut 45 sn | ESR Faz 7b |

**Minimal diff ilkesi:** Mevcut `sync-file`, `KP-SYNC1`, manual mod **silinmez**; relay alternatif transport.

### Relay transport: pull tetikleme

| Transport | Uzak değişiklik algılama |
|-----------|--------------------------|
| `file` (handle) | visibility / focus / **45 sn poll** (tarayıcı dosya watch yok) |
| `relay` | WS `head_changed` → HTTP pull; kopukken **45 sn poll** fallback |

Dosya sync'e WebSocket uygulanmaz (harici dosya olayı yok). Relay seçiliyken `NotificationClient` `sync-scheduler` ile birlikte çalışır; WS bağlıyken poll aralığı seyrekleştirilebilir (örn. 5 dk).

---

## 12. Test planı (KP)

- [ ] File transport regression (mevcut vitest + manuel)
- [ ] Relay: mock `@esr/client` → push/pull round-trip
- [ ] `importSnapshot` after relay pull — entity store reload
- [ ] Conflict modal relay 409
- [ ] Profil switch — doğru namespace/token
- [ ] `encryptFile` + ENV-ENC1 round-trip via relay
- [ ] Limit modal `DEVICE_LIMIT_PAYMENT_REQUIRED`
- [ ] (KP-R8) A push → B WS notify → B pull

---

## 13. Dosya planı (KP)

```
src/core/services/sync/
  kp-document-adapter.ts      # NEW
  relay-transport.ts          # NEW — wraps @esr/client
  relay-notifications.ts      # NEW — NotificationClient wrapper (KP-R8)
  sync-engine.ts              # extend — transport branch
  sync-file.ts                # unchanged (file transport)
  sync-scheduler.ts           # unchanged hooks

src/core/types/sync.ts        # transport + relay fields

src/stores/sync.ts            # relay methods, device list

src/components/
  SyncSettingsSection.vue     # transport toggle, relay UI
  SyncDeviceList.vue          # NEW optional extract
  SyncUnlockModal.vue         # NEW — slot/unlock

docs/ESR-INTEGRATION.md       # this file
```

---

## 14. Operatör / self-host notu

KP kullanıcısı relay URL'ini Ayarlar'da girer. Varsayılan URL **boş** (file transport). Operatör:

1. ESR docker compose deploy eder
2. `default_free_device_limit`, `on_limit_reached.mode` ayarlar
3. (Opsiyonel) `allowedContentTypes` ile KP MIME whitelist
4. Unlock kodları admin CLI ile üretir

KP uygulaması operatör config'ini bilmez; yalnızca API yanıtlarını gösterir.

---

## 15. Bilinçli kapsam dışı (KP entegrasyon v1)

- Dosya + relay hibrit sync (aynı profilde çift head)
- ESR ödeme webhook UI (yalnızca unlock kodu MVP)
- KP içinde ESR sunucusu barındırma
- Çoklu document (ESR v2)

---

## 16. Referanslar

| Konu | Belge |
|------|--------|
| ESR tam spec | [docs/envelope-sync-relay/](../envelope-sync-relay/README.md) |
| KP mevcut dosya sync | [docs/SYNC.md](./SYNC.md) |
| Snapshot format | `src/core/services/snapshot.ts` |
| Mevcut sync store | `src/stores/sync.ts` |
| Sync UI | `src/components/SyncSettingsSection.vue` |

---

## 17. Agent handoff (KP entegrasyon agent'ı)

1. ESR servisi ve `@esr/client` v1 hazır olmalı (ayrı agent teslimi).
2. Bu belgeyi ve `docs/SYNC.md` oku.
3. Faz KP-R1'den başla; file transport'a dokunma.
4. Her faz sonunda mevcut sync testleri yeşil kalsın.
5. CHANGELOG.md güncelle.
