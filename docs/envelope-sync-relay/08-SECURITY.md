# 08 — Güvenlik

## 1. Tehdit modeli

### 1.1 Korunan varlıklar

| Varlık | Hedef |
|--------|--------|
| Payload (uygulama belgesi) | Gizlilik, bütünlük |
| device_token | Yetkisiz API erişimi |
| recovery phrase | Namespace ele geçirme |
| unlock codes | Bedava slot |

### 1.2 Güvenilen taraflar

| Taraf | Güven |
|-------|-------|
| İstemci cihaz | Kullanıcı kontrolünde |
| Operatör (sunucu) | Metadata görür; içerik okuyamaz (E2EE) |

### 1.3 Güvenilmeyen

- Ağ (TLS dışında)
- Diğer namespace'ler (UUID izolasyonu)
- Brute force pairing/recovery denemeleri

## 2. Zero-knowledge sınırları

Sunucu **göremez:**

- Decrypted payload
- Recovery phrase
- Encryption password
- Uygulama entity içeriği

Sunucu **görür (metadata):**

- namespaceId, namespaceLabel
- revision, writtenAt, deviceId
- contentSha256, contentMagic, sizeBytes
- active device count, slot purchases
- IP, request timestamps (access log)

**Kullanıcı bilgilendirilmeli:** Self-host operatör metadata erişimine sahiptir.

## 3. Transport

- TLS 1.2+ zorunlu production'da
- HSTS önerilir
- `file://` istemciler relay'e HTTPS ile bağlanır (CORS config)

## 4. Kimlik doğrulama

### 4.1 device_token

```
token = random(32 bytes) → base64url
store = SHA-256(token)
compare = constant-time
```

Bearer header; query string'te **asla** taşınmaz.

### 4.2 admin_api_token

- Config/env'den; min 64 char önerilir
- Yalnızca admin uçları
- Rotation: operatör config değiştirir

### 4.3 Recovery

- Argon2id hash (params config)
- Phrase normalize: NFKD, lowercase, trim, single spaces
- Rate limit + exponential backoff IP

## 5. Envelope bütünlüğü

Push:

1. JSON schema validate
2. SHA-256(payload) == contentSha256
3. namespaceId/documentId path match
4. maxEnvelopeBytes limit
5. contentMagic allowed enum

Manipülasyon tespiti istemci pull'da da tekrarlanır.

## 6. Pairing güvenliği

| Risk | Mitigation |
|------|------------|
| Code brute force | 6 digit + rate limit + lockout |
| Code interception | Kısa TTL; kullanıcı eğitimi |
| MITM | TLS |

Host pairing kodunu güvenilir kanaldan paylaşır (QR yakın alan).

## 7. Slot / unlock güvenliği

- Unlock kodları tahmin edilemez (crypto random veya HMAC)
- Redeem idempotent değil — ikinci redeem 409
- Admin token leak → tüm admin uçları risk; ayrı network/VPN önerilir

## 8. Logging ve gizlilik

**Asla loglanmaz:**

- `envelope.payload`
- `deviceToken` (plaintext)
- recovery phrase veya proof input
- encryption password
- admin token

**Loglanabilir:**

- request id, namespaceId, deviceId (server), endpoint, status, duration
- error codes

Redaction middleware zorunlu test ile doğrulanmalı.

## 9. CORS ve CSRF

- SPA bearer token kullanır → cookie CSRF yok
- CORS origin whitelist production'da
- Admin API ayrı origin veya VPN

## 10. Blob storage

- Filesystem: path traversal koruması — blob key sanitize
- Namespace prefix isolation (blob path)
- S3: bucket policy private; presigned URL MVP'de gerekmez

## 11. Dependency güvenliği

- Lockfile commit
- CI: `npm audit` / `cargo audit`
- Minimal dependency prensibi

## 12. Güvenlik test checklist

- [ ] Invalid token → 401
- [ ] Cross-namespace token → 401
- [ ] Tampered payload sha256 → 422
- [ ] Oversized envelope → 413
- [ ] Recovery rate limit → 429
- [ ] Pairing brute force → 429
- [ ] Logs contain no payload (grep test)
- [ ] SQL injection fuzz (parameterized queries)
- [ ] Path traversal blob key
- [ ] WS cross-namespace token rejected
- [ ] WS frames contain no envelope payload

## 13. İstemci güvenlik önerileri (integration guide)

- Recovery phrase ekran görüntüsü uyarısı
- device_token secure storage
- Sync password session-only option
- Certificate pinning (opsiyonel, mobile)

## 14. WebSocket (v1.1)

- Auth: REST ile aynı `device_token`; namespace path eşleşmesi zorunlu
- Veri: yalnızca meta (`head_changed`); **envelope/payload WS üzerinden asla gitmez**
- Token query string'te taşınmaz (log sızıntısı)
- Device revoke → WS close `4403`
- Rate limit: namespace başına max eşzamanlı bağlantı

Ayrıntı: [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md)

## 15. Incident response (operatör)

1. admin token rotate
2. Şüpheli namespace recovery zorunlu kıl (manual)
3. Blob backup restore
4. Audit unlock_events
