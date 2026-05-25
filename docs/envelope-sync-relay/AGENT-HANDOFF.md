# Agent Handoff — Envelope Sync Relay v1

> **Bu dosyayı** implementasyon agent'ına birlikte `docs/envelope-sync-relay/` klasörünün tamamını verin.
> Agent, belirli bir tüketici uygulamasından haberdar olmamalı; yalnızca evrensel sync servisi inşa etmelidir.

## Görev özeti

**Envelope Sync Relay (ESR)** — self-hosted, zero-knowledge, REST tabanlı belge senkron servisi geliştir.

- Offline-first uygulamalar opaque snapshot zarfını (`ESR-DOC1`) cihazlar arasında taşır
- Sunucu içeriği okuyamaz (E2EE payload)
- Kullanıcı hesabı / kayıt **yok**
- Cihaz limiti: yapılandırılabilir ücretsiz slot + tek seferlik unlock paketleri
- Limit dolunca: `payment` (unlock/ödeme) veya `block` (sert tavan) — operatör seçer
- Cihaz kaldırılınca slot boşalır; başka cihazda ücretsiz kullanılır

## Tek kaynak (SSOT)

Tüm tasarım kararları `docs/envelope-sync-relay/` içindedir. Çelişki durumunda öncelik:

1. `04-API-REFERENCE.md`
2. `13-WEBSOCKET-NOTIFICATIONS.md` (WS implementasyonu)
3. `03-PROTOCOL.md`
3. `06-SLOT-LICENSING.md`
4. `05-DEVICE-PAIRING-AND-RECOVERY.md`
5. Diğerleri

Sapma gerekirse `docs/DEVIATIONS.md` oluştur ve gerekçelendir.

## Teslim edilecekler

| Bileşen | Paket / path |
|---------|----------------|
| Protokol (Zod, crypto helpers) | `@esr/protocol` |
| HTTP istemci + SyncEngine | `@esr/client` |
| REST API sunucusu | `packages/server` |
| Admin CLI (unlock code) | `@esr/cli` |
| Docker compose | `docker/docker-compose.yml` |
| Testler | Vitest, integration with testcontainers |
| OpenAPI | `openapi.yaml` uyumu |

## Kritik tasarım kararları (değiştirme)

| Konu | Karar |
|------|--------|
| Protokol magic | `ESR-DOC1` |
| Inner encryption | `ENV-ENC1` (AES-256-GCM + PBKDF2-SHA256) |
| Document id v1 | yalnızca `primary` |
| Identity | UUID v4 `namespaceId` + device_token + recovery hash |
| API prefix | `/v1/namespaces/{namespaceId}` — **tenant yok** |
| Recovery phrase | İstemci üretir; sunucu yalnızca Argon2id hash |
| Conflict | Sunucu merge yapmaz; 409 + istemci UI |
| Slot model | `max = free_device_limit + purchased_slots` |
| Purchased slots | Birikimli; recovery'de korunur |
| Re-pair same clientDeviceId | Eski device revoke, slot sayısı değişmez |
| Last device | Kaldırılamaz (`LAST_DEVICE_PROTECTED`) |
| Blob storage MVP | Filesystem on same server |
| Payment MVP | Manuel unlock code; webhook Faz 8 |
| WebSocket | Bildirim only; `esr-notifications-v1`; polling fallback zorunlu (doc 13) |

## Uygulama faz sırası

`11-IMPLEMENTATION-PLAN.md` — Faz 0'dan 7'ye REST MVP; ardından **Faz 7b WebSocket** (doc 13).

## Kabul kriterleri (kısa)

- [ ] Docker `up` → `/health` ok
- [ ] Create → pair 2 devices → push/pull sync
- [ ] 3rd device: block veya payment modu config'e göre 403
- [ ] Unlock code → slot artışı → pair success
- [ ] Revoke → slot boşalma → yeni pair ödeme yok
- [ ] Recovery → tokens revoke, slots + head korunur
- [ ] 409 revision conflict doğru
- [ ] Loglarda payload yok (test ile doğrula)
- [ ] Example node script çalışır
- [ ] (Faz 7b) A push → B WS notify → B HTTP pull

## Teknoloji

Implementer seçebilir; öneri: **TypeScript, Node 22, Hono/Fastify, PostgreSQL 16, Vitest**.

Public API sözleşmesi (`openapi.yaml`, `ESR-DOC1`) değişmemeli.

## Bilinçli kapsam dışı

- Snapshot over WebSocket (yalnızca meta bildirim)
- CRDT / entity merge
- User accounts / OAuth
- Subscription billing (yalnızca one-time unlock)
- Multi-document per namespace (v2)

## İlk komut (agent)

1. `docs/envelope-sync-relay/README.md` oku
2. `11-IMPLEMENTATION-PLAN.md` Faz 0 ile repo scaffold oluştur
3. `packages/protocol` + fixtures + unit tests
4. Sırayla devam et

## Entegrasyon notu (agent için değil, operatör için)

Tüketici uygulamalar yalnızca `@esr/client` + `DocumentAdapter` implement eder. Bu agent'ın kapsamı dışındadır.
