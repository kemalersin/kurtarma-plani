# Envelope Sync Relay (ESR) — Geliştirici Dokümantasyonu

> **Implementasyon agent'ı:** Önce [AGENT-HANDOFF.md](./AGENT-HANDOFF.md) dosyasını okuyun.

Bu klasör, **Envelope Sync Relay** adlı evrensel, self-hosted, zero-knowledge belge senkronizasyon servisinin tam spesifikasyonunu ve geliştirici kılavuzunu içerir.

Servis, herhangi bir offline-first uygulamanın **şifreli snapshot zarfını** cihazlar arasında taşımak için tasarlanmıştır. Uygulama şemasını bilmez; yalnızca revizyon, cihaz ve slot metadata yönetir.

---

## Okuma sırası (implementasyon agent'ı için)

| # | Belge | İçerik |
|---|--------|--------|
| 1 | [01-OVERVIEW.md](./01-OVERVIEW.md) | Vizyon, kapsam, terimler, tasarım ilkeleri |
| 2 | [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) | Bileşenler, veri akışı, deployment |
| 3 | [03-PROTOCOL.md](./03-PROTOCOL.md) | `ESR-DOC1` zarf formatı, iç payload kuralları |
| 4 | [04-API-REFERENCE.md](./04-API-REFERENCE.md) | REST API — tüm uçlar, istek/yanıt, hata kodları |
| 5 | [05-DEVICE-PAIRING-AND-RECOVERY.md](./05-DEVICE-PAIRING-AND-RECOVERY.md) | Cihaz eşleştirme, kaldırma, recovery key |
| 6 | [06-SLOT-LICENSING.md](./06-SLOT-LICENSING.md) | Slot modeli, ödeme, unlock kodları (kayıt yok) |
| 7 | [07-SERVER-CONFIGURATION.md](./07-SERVER-CONFIGURATION.md) | Sunucu ayarları, env, docker |
| 8 | [08-SECURITY.md](./08-SECURITY.md) | Tehdit modeli, kripto, rate limit |
| 9 | [09-CLIENT-INTEGRATION-GUIDE.md](./09-CLIENT-INTEGRATION-GUIDE.md) | Herhangi bir uygulama nasıl entegre eder |
| 10 | [10-DATA-MODEL.md](./10-DATA-MODEL.md) | PostgreSQL şeması, indeksler |
| 11 | [11-IMPLEMENTATION-PLAN.md](./11-IMPLEMENTATION-PLAN.md) | Fazlar, repo yapısı, test, kabul kriterleri |
| 12 | [12-ERROR-CODES.md](./12-ERROR-CODES.md) | HTTP hata kodları ve istemci retry politikası |
| 13 | [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md) | WebSocket push-to-pull bildirimleri (v1.1) |
| 14 | [openapi.yaml](./openapi.yaml) | Makine okunur REST API tanımı |

---

## Hızlı özet

```
┌─────────────┐     ESR-DOC1 envelope      ┌──────────────────────────┐
│  Client A   │ ─────── HTTP PUT ─────────▶│  Envelope Sync Relay     │
│  (any app)  │ ◀────── HTTP GET ──────────│  Postgres + blob store   │
└─────────────┘                            │  WS: head_changed (v1.1) │
┌─────────────┐         ▲                  └────────────┬─────────────┘
│  Client B   │ ── WS notify ── pull HTTP ────────────┘
└─────────────┘
```

**Temel özellikler:**

- Zero-knowledge: sunucu payload içeriğini okuyamaz
- Kayıt/hesap yok: kimlik = namespace + device token + recovery key
- Cihaz slot modeli: ücretsiz limit + satın alınan slotlar (birikimli)
- Limit dolunca: `payment` (paket satın al) veya `block` (sert tavan)
- Cihaz kaldırılınca slot boşalır; başka cihazda ücretsiz kullanılır
- Çakışma: sunucu merge yapmaz; istemci yerel/uzak seçer
- **WebSocket (v1.1):** `head_changed` bildirimi → HTTP pull (veri WS üzerinden gitmez)

**Bilinçli kapsam dışı (v1):**

- Kullanıcı hesabı / e-posta / OAuth
- Abonelik / recurring billing
- Snapshot / envelope over WebSocket
- Entity-level CRDT merge
- Sunucu tarafı içerik arama veya sorgu

---

## Consumer application integration

This specification is application-agnostic. Each consumer app should maintain its own integration guide **outside** this folder (mapping local profile/workspace UUID to `namespaceId`, implementing `DocumentAdapter`, UI wiring). Do not add app-specific references to files in `envelope-sync-relay/`.

**v1.0.1:** Tenant katmanı kaldırıldı — API `/v1/namespaces/{namespaceId}`; `namespaceId` UUID v4 zorunlu.

**v1.1.0:** WebSocket bildirim kanalı — bkz. [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md).

---

| Alan | Değer |
|------|--------|
| Spec sürümü | 1.1.0 |
| Protokol magic | `ESR-DOC1` |
| API prefix | `/v1` |
| Min. TLS | 1.2 |

---

## Lisans ve dağıtım notu

Servis evrensel bir OSS/self-host ürün olarak tasarlanmıştır. Operatör (sunucu sahibi) slot paketleri ve `on_limit_reached.mode` ile gelir modelini kendi deployment'ında yapılandırır.
