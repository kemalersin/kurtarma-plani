# 01 — Genel Bakış

## 1. Problem

Offline-first uygulamalar veriyi yerelde tutar (IndexedDB, SQLite, dosya). Kullanıcı aynı veriyi birden fazla cihazda görmek istediğinde:

- Manuel export/import yüksek sürtünme
- Dosya tabanlı sync (iCloud klasörü) tarayıcı/platform kısıtları
- Merkezi backend finans/sağlık gibi gizlilik odaklı uygulamalarda istenmeyebilir

**Envelope Sync Relay (ESR)**, uygulamanın ürettiği **opaque (anlamsız) şifreli belge zarfını** self-hosted sunucuda saklayarak cihazlar arası senkron sağlar. Sunucu içeriği okuyamaz.

## 2. Çözüm özeti

ESR üç katmandan oluşur:

| Katman | Sorumluluk | Kim bilir? |
|--------|------------|------------|
| **Uygulama** | Snapshot üretme, import, iş kuralları | Uygulama geliştiricisi |
| **ESR Client SDK** | Push/pull, pairing, conflict, offline queue | Entegrasyon |
| **ESR Server** | Blob depolama, revizyon index, cihaz/slot | Operatör |

Sunucu **belge biriminde** çalışır; entity/record seviyesinde değil.

## 3. Terimler sözlüğü

| Terim | Tanım |
|-------|--------|
| **Namespace** | Senkronize edilen mantıksal kapsayıcı. Genelde bir workspace, vault veya profil. **UUID v4 zorunlu** (global benzersizlik). |
| **Document** | Namespace içindeki tek belge. v1'de yalnızca `primary` desteklenir. |
| **Envelope (ESR-DOC1)** | Sunucuya yazılan dış JSON zarf; metadata + opaque payload. |
| **Payload** | Uygulamanın ürettiği iç JSON string (plain veya uygulama tarafından şifrelenmiş). |
| **Revision** | Monoton benzersiz sürüm kimliği (ULID önerilir). Her başarılı push yeni revision. |
| **Device** | Namespace'e eşleşmiş istemci. `device_token` ile kimlik doğrular. |
| **Host device** | Namespace'i oluşturan ilk cihaz; pairing token üretir. |
| **Pairing token** | Kısa ömürlü, tek kullanımlık eşleştirme kodu. |
| **Recovery key** | Namespace sahipliğini kanıtlayan istemci tarafı giz (sunucuda yalnızca hash). |
| **Slot** | Aynı anda eşleşik olabilecek cihaz hakkı. |
| **Free limit** | Ödeme olmadan izin verilen eşzamanlı cihaz sayısı (operatör ayarı). |
| **Purchased slots** | Unlock kodu / ödeme ile namespace'e eklenen ek slot (birikimli). |
| **Operatör** | Relay sunucusunu işleten kişi/kurum. |
| **Notification (WS)** | Sunucudan istemciye meta bildirim; veri taşımaz. Pull tetikler. |

## 4. Tasarım ilkeleri

1. **Zero-knowledge varsayılan:** Payload E2EE; sunucu şifre çözmez.
2. **Offline-first uyumlu:** Ağ yokken istemci yerel çalışır; sync online olunca devam eder.
3. **Sunucu aptal, istemci akıllı:** Merge, conflict çözümü, snapshot mantığı istemcide.
4. **Kayıt yok:** Kullanıcı hesabı zorunlu değil; namespace + token yeterli.
5. **Self-hosted:** API ve blob aynı deployment'ta; harici SaaS zorunlu değil.
6. **Evrensel protokol:** Namespace/document soyutlaması; uygulama şeması `contentType` ile tanınır.
7. **Yapılandırılabilir ticari model:** Slot limiti ve ödeme/block modu operatör config'i.
8. **Push-to-pull:** WebSocket yalnızca bildirim; snapshot her zaman HTTP (doc 13).

## 5. Kullanıcı hikâyeleri (v1)

### US-1: İlk kurulum
Kullanıcı uygulamada sync'i açar → host cihaz namespace oluşturur → recovery key gösterilir → kullanıcı key'i kaydeder.

### US-2: İkinci cihaz (limit içinde)
Host pairing kodu/QR üretir → ikinci cihaz kodu girer → device token alır → pull/push başlar.

### US-3: Limit dolunca (payment modu)
Üçüncü cihaz eklenmek istenir → API `DEVICE_LIMIT_PAYMENT_REQUIRED` → istemci slot paketi satın alma / unlock kodu UI → slot artar → pairing devam eder.

### US-4: Limit dolunca (block modu)
API `DEVICE_LIMIT_BLOCKED` → kullanıcıya "daha fazla cihaz eklenemez" mesajı; ödeme sunulmaz.

### US-5: Cihaz kaldırma
Host veya aynı cihaz "Bu cihazı kaldır" → slot boşalır → yeni cihaz aynı slot'u ücretsiz kullanır.

### US-6: Cihaz kaybı
Recovery key ile tüm cihazlar iptal → yeni host → purchased slot korunur → yeniden pairing.

### US-7: Çakışma
İki cihaz offline düzenler → ikisi push dener → biri 409 alır veya pull'da conflict → istemci yerel/uzak seçer.

### US-8: Anlık uzak güncelleme (v1.1)
Client A push eder → relay `head_changed` WS yayınlar → Client B HTTP pull → UI güncellenir.

## 6. Non-goals (v1)

- Çoklu document per namespace (v2)
- WebDAV/S3 transport (ayrı client transport; server her zaman HTTP)
- Federasyon (çoklu relay birleşimi)
- Admin web UI (v1: config dosyası + CLI yeterli; admin API opsiyonel)

## 7. Başarı kriterleri (MVP)

- [ ] Host namespace + recovery oluşturabilir
- [ ] 2+ cihaz pairing ile sync eder
- [ ] Push/pull revision ile çalışır; 409 conflict doğru döner
- [ ] Config ile free limit ve payment/block modu değişir
- [ ] Unlock kodu slot ekler; revoke slot boşaltır
- [ ] Recovery tüm device token'ları iptal eder, slot korunur
- [ ] Payload sunucu loglarında görünmez
- [ ] Docker compose `up` → health ok
- [ ] OpenAPI spec ile uyumlu REST API
- [ ] Vitest/integration test suite geçer
- [ ] (v1.1) WS `head_changed` → client HTTP pull
