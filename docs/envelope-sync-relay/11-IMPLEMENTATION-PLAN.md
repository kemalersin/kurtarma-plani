# 11 — Uygulama Planı ve Kabul Kriterleri

Bu belge, implementasyon agent'ının sırasıyla ne inşa edeceğini, test beklentilerini ve teslim tanımını tanımlar.

## 1. Hedef teslimat

Çalışan bir **Envelope Sync Relay** monorepo:

- Docker compose ile ayağa kalkan API + Postgres + blob volume
- `@esr/protocol` npm paketi (Zod + verify/build)
- `@esr/client` npm paketi (RelayClient + SyncEngine)
- `@esr/server` veya `packages/server` HTTP API
- `@esr/cli` admin unlock code generator
- Vitest test suite (>80% coverage core paths)
- OpenAPI spec uyumu

**Evrensel:** Hiçbir paket belirli bir uygulama adına referans içermez.

## 2. Faz planı

### Faz 0 — Proje iskeleti (2–3 gün)

- [ ] Monorepo scaffold (npm/pnpm workspaces veya cargo workspace)
- [ ] TypeScript strict, ESLint, Prettier
- [ ] `packages/protocol` — ESR-DOC1 Zod, sha256, fixtures
- [ ] `packages/protocol/src/identity.ts` — `generateNamespaceId`, `isValidNamespaceId`, `generateRecoveryPhrase`, `normalizeRecoveryPhrase`, `buildRecoveryKeyProof`, `verifyRecoveryKeyProof` (doc 05 Argon2id; doc 09)
- [ ] CI: lint + test on push
- [ ] Docker compose postgres only

**Çıktı:** protocol unit tests green

### Faz 1 — Veritabanı ve config (2–3 gün)

- [ ] Migration 001 (doc 10 DDL)
- [ ] Config loader + Zod validate (doc 07)
- [ ] Health endpoint
- [ ] Structured logging (redaction)

**Çıktı:** `GET /health` ok; invalid config fails startup

### Faz 2 — Namespace + devices + pairing (4–5 gün)

- [ ] POST namespace create
- [ ] Recovery hash storage (client-provided salt/hash)
- [ ] device_token issue + auth middleware
- [ ] POST pairing-tokens, POST devices redeem
- [ ] GET devices list, DELETE device revoke
- [ ] Slot limit check (free + purchased)
- [ ] `on_limit_reached.mode` block/payment errors

**Çıktı:** integration test: 2 device pair; 3rd blocked per config

### Faz 3 — Document push/pull (3–4 gün)

- [ ] Blob filesystem driver
- [ ] GET head/meta, GET head
- [ ] PUT primary with expectedRevision
- [ ] 409 REVISION_CONFLICT
- [ ] Envelope validation + sha256

**Çıktı:** two-client push/pull round-trip test

### Faz 4 — Recovery (2 gün)

- [ ] POST recover with Argon2id verify
- [ ] Revoke all devices, preserve slots + head
- [ ] Rate limit recover

**Çıktı:** recovery integration test

### Faz 5 — Unlock / slots (2–3 gün)

- [ ] unlock_codes table + admin CLI generate
- [ ] POST unlock redeem
- [ ] GET limits
- [ ] unlock_events audit

**Çıktı:** unlock + pair 3rd device test (payment mode)

### Faz 6 — Client SDK (4–5 gün)

- [ ] `@esr/client` RelayClient all API methods
- [ ] SyncEngine: pull/push/conflict/debounce
- [ ] ENV-ENC1 encode/decode in protocol or client
- [ ] Browser + Node export (`package.json` exports`)

**Çıktı:** example app or vitest mock server e2e

### Faz 6c — `EsrSync` facade (3–4 gün)

Bkz. [14-ESR-SYNC-FACADE.md](./14-ESR-SYNC-FACADE.md)

- [ ] `EsrStorage` + `createLocalStorageAdapter` + `createMemoryStorageAdapter`
- [ ] `createDocumentAdapter` factory
- [ ] `EsrSync.connect` — dahili RelayClient + SyncEngine + NotificationClient + scheduler
- [ ] `ensureNamespace`, `startPairing`, `joinPairing`, `recover`, `sync`, `notifyLocalChange`
- [ ] Callback'ler: `onRecoveryPhrase`, `onConflict`, `onDeviceLimit`, `onStatusChange`
- [ ] `EsrError` + protocol kimlik araçları entegrasyonu
- [ ] Vitest: memory storage + mock relay e2e
- [ ] Doc 14 minimal örnek çalışır durumda (example app)

**Çıktı:** v1.2.0 client tag; entegrasyon checklist §10 yeşil

### Faz 7 — Hardening (2–3 gün)

- [ ] Rate limits
- [ ] CORS
- [ ] Metrics endpoint
- [ ] Security test checklist (doc 08)
- [ ] README operator guide
- [ ] OpenAPI final review

**Çıktı:** REST MVP release tag v1.0.0

### Faz 7b — WebSocket bildirimleri (2–3 gün)

Bkz. [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md)

- [ ] `NotificationHub` + `GET /v1/namespaces/:id/notifications` upgrade
- [ ] PUT primary / unlock → `head_changed` / `limits_changed` broadcast
- [ ] Ping/pong, auth, revoke → close 4403
- [ ] `@esr/protocol` WS message Zod schemas
- [ ] `@esr/client` `NotificationClient` + reconnect + poll fallback
- [ ] `SyncEngine` `ws_with_poll_fallback` modu
- [ ] Caddy/nginx WS proxy notları
- [ ] Integration: A push → B WS → B HTTP pull

**Çıktı:** v1.1.0 tag (REST + WS)

### Faz 8 — Opsiyonel (post-MVP)

- [ ] Payment webhook (Stripe)
- [ ] S3 blob driver
- [ ] Revision history table
- [ ] Admin web UI

## 3. Dosya yapısı (detay)

```
envelope-sync-relay/
├── packages/
│   ├── protocol/
│   │   ├── src/
│   │   │   ├── envelope.ts
│   │   │   ├── inner-payload.ts      # ENV-RAW1, ENV-ENC1
│   │   │   ├── crypto.ts             # sha256, aes-gcm, pbkdf2
│   │   │   └── index.ts
│   │   ├── fixtures/
│   │   └── package.json
│   ├── client/
│   │   ├── src/
│   │   │   ├── esr-sync.ts              # facade (doc 14)
│   │   │   ├── esr-sync-scheduler.ts
│   │   │   ├── esr-storage.ts
│   │   │   ├── document-adapter.ts
│   │   │   ├── notification-client.ts
│   │   │   ├── relay-client.ts
│   │   │   ├── sync-engine.ts
│   │   │   ├── sync-scheduler.ts
│   │   │   ├── errors.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   ├── notification-hub.ts
│   │   │   ├── routes/
│   │   │   │   ├── namespaces.ts
│   │   │   │   ├── notifications-ws.ts
│   │   │   │   ├── devices.ts
│   │   │   │   ├── documents.ts
│   │   │   │   ├── unlock.ts
│   │   │   │   ├── admin.ts
│   │   │   │   └── health.ts
│   │   │   ├── services/
│   │   │   │   ├── slot-service.ts
│   │   │   │   ├── pairing-service.ts
│   │   │   │   ├── document-service.ts
│   │   │   │   └── recovery-service.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth-device.ts
│   │   │   │   ├── auth-admin.ts
│   │   │   │   └── rate-limit.ts
│   │   │   └── blob/
│   │   │       └── filesystem.ts
│   │   ├── migrations/
│   │   └── package.json
│   └── cli/
│       ├── src/
│       │   └── generate-unlock-code.ts
│       └── package.json
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile
├── docs/                              # this specification
├── openapi.yaml
├── package.json
└── README.md
```

## 4. Test stratejisi

### 4.1 Unit

- protocol: envelope round-trip, sha256 mismatch
- slot-service: max calculation, canPair
- conflict decision logic (client SyncEngine)

### 4.2 Integration (supertest + testcontainers postgres)

- full pairing flow
- push/pull/conflict 409
- recovery revokes tokens
- unlock adds slots
- rate limit 429

### 4.3 E2E (optional)

- `@esr/client` against running docker stack

### 4.4 Security

- log redaction grep test
- cross-namespace auth rejection

## 5. Kabul kriterleri (Definition of Done)

MVP **tamam** sayılır ancak:

1. Tüm doc 04 API uçları (admin hariç opsiyonel) implement edilmiş
2. OpenAPI ile route uyumu
3. Docker compose `up` → health ok
4. README: operator kurulum + unlock CLI kullanımı
5. Client example: minimal HTML or node script demonstrating create → pair → sync
6. 100% doc 05 + doc 06 test senaryoları geçiyor
7. Payload hiçbir log dosyasında yok (automated test)
8. Config `payment` ve `block` modları switch edilebilir

## 6. Kod kalitesi

- TypeScript strict, no `any` in public API
- Parameterized SQL only
- Errors: typed error classes with `code` field
- Public JSDoc on `@esr/client` exports

## 7. Versiyonlama

- Semver packages
- API `/v1` prefix; breaking → `/v2`
- Envelope `schemaVersion` independent

## 8. README içeriği (operator)

Implementer root README yazmalı:

- Quick start docker
- Config reference link
- Generate unlock code CLI
- Backup/restore blob+postgres
- Security notes (TLS, admin token)
- CORS production warning

## 9. Example minimal client script

```typescript
// examples/node-basic-sync.ts
import { RelayClient, SyncEngine } from '@esr/client'

// DocumentAdapter mock for demo JSON document
// create namespace → push → print limits
```

Agent bu script'i çalışır halde teslim etmeli.

## 10. Bilinen sınırlamalar (v1 release notes)

- Single document `primary` per namespace
- No payment webhook (manual unlock only)
- Filesystem blob only
- No revision history UI
- English/Turkish error messages — implementer picks one for server; client maps codes

## 11. Agent talimatları

Implementasyon agent'ı:

1. **Bu docs/ klasörünü** tek kaynak kabul etmeli
2. Belirsizlikte doc 04 > doc 03 > doc 06 önceliği
3. Uygulama-özel kod yazmamalı
4. Her faz sonunda testler yeşil olmalı
5. CHANGELOG.md tutmalı
6. Sapma varsa `docs/DEVIATIONS.md` dosyasına kaydetmeli
