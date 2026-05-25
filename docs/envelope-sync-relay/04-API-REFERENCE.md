# 04 — API Referansı

Base URL: `https://{host}/v1`

Tüm istek/yanıtlar `Content-Type: application/json; charset=utf-8` unless noted.

## 1. Kimlik doğrulama

| Bağlam | Header |
|--------|--------|
| Namespace işlemleri | `Authorization: Bearer {device_token}` |
| Admin işlemleri | `Authorization: Bearer {admin_api_token}` |
| Namespace oluşturma | Kimlik yok (recovery hash ile korunur) |
| Pairing token redeem | Kimlik yok (token tek kullanımlık) |
| Recovery | Kimlik yok (recovery proof body'de) |

`device_token`: opaque string, min 32 byte random, base64url encode önerilir.

## 2. Standart hata gövdesi

```json
{
  "error": {
    "code": "DEVICE_LIMIT_PAYMENT_REQUIRED",
    "message": "Human readable Turkish or English message",
    "details": {}
  }
}
```

HTTP status → `error.code` eşlemesi: [12-ERROR-CODES.md](./12-ERROR-CODES.md).

## 3. Namespace yaşam döngüsü

### 3.1 Namespace oluştur (host)

```http
POST /v1/namespaces
```

**`namespaceId`:** UUID v4 zorunlu (sunucu validate eder).

**Body:**

```json
{
  "namespaceId": "550e8400-e29b-41d4-a716-446655440000",
  "namespaceLabel": "Personal Workspace",
  "recoveryKeyProof": {
    "salt": "<base64url>",
    "hash": "<base64url argon2id hash of recovery phrase>"
  },
  "deviceLabel": "My Laptop",
  "clientDeviceId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Not:** `recoveryKeyProof` — istemci recovery phrase'i sunucuya göndermez; yalnızca salt+hash. Recovery akışında aynı proof tekrarlanır (bkz. doc 05).

**201 Response:**

```json
{
  "namespaceId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceToken": "dvt_xxxxxxxxxxxxxxxx",
  "deviceId": "01JFAAAA...",
  "limits": {
    "freeDeviceLimit": 2,
    "purchasedSlots": 0,
    "maxDevices": 2,
    "activeDevices": 1
  },
  "recoveryKeyDisplay": {
    "phrase": "word1 word2 ... word24",
    "warning": "Store this recovery key securely. It will not be shown again."
  }
}
```

**Not:** `recoveryKeyDisplay.phrase` yalnızca create yanıtında bir kez döner (sunucu phrase üretir veya istemci üretip hash gönderir — **tercih: istemci üretir, sunucuya yalnızca hash gider**).

**Önerilen create akışı (istemci üretir recovery):**

```json
{
  "namespaceId": "...",
  "namespaceLabel": "...",
  "recoveryKeyHash": "<argon2id>",
  "recoveryKeySalt": "<base64url>",
  "deviceLabel": "...",
  "clientDeviceId": "..."
}
```

Sunucu phrase görmez. Create yanıtında `recoveryKeyDisplay` yok; istemci zaten phrase'i gösterdi.

**409:** `namespaceId` zaten var → `NAMESPACE_EXISTS`

### 3.2 Namespace bilgisi

```http
GET /v1/namespaces/{namespaceId}
Authorization: Bearer {device_token}
```

**200:**

```json
{
  "namespaceId": "...",
  "namespaceLabel": "...",
  "limits": {
    "freeDeviceLimit": 2,
    "purchasedSlots": 3,
    "maxDevices": 5,
    "activeDevices": 2
  },
  "head": {
    "revision": "01JF...",
    "writtenAt": "2026-05-25T14:30:00.000Z",
    "deviceId": "...",
    "contentSha256": "...",
    "contentMagic": "ENV-ENC1",
    "sizeBytes": 842016
  },
  "lastSyncAt": "2026-05-25T14:30:00.000Z"
}
```

`head` null ise henüz push yok.

### 3.3 Namespace sil (recovery gerekli)

```http
DELETE /v1/namespaces/{namespaceId}
Authorization: Bearer {device_token}
Body: { "recoveryKeyProof": { "salt", "hash" } }
```

**204** veya recovery ile admin token. MVP: recovery proof zorunlu.

## 4. Cihaz yönetimi

### 4.1 Cihaz listesi

```http
GET /v1/namespaces/{namespaceId}/devices
Authorization: Bearer {device_token}
```

**200:**

```json
{
  "devices": [
    {
      "deviceId": "01JF...",
      "clientDeviceId": "7c9e6679-...",
      "label": "My Laptop",
      "pairedAt": "2026-05-20T10:00:00.000Z",
      "lastSeenAt": "2026-05-25T14:00:00.000Z",
      "isCurrent": true
    }
  ],
  "limits": { "maxDevices": 5, "activeDevices": 2 }
}
```

`isCurrent`: token sahibi cihaz.

### 4.2 Pairing token oluştur (host veya mevcut cihaz)

```http
POST /v1/namespaces/{namespaceId}/pairing-tokens
Authorization: Bearer {device_token}
```

**Body (opsiyonel):**

```json
{ "ttlSeconds": 600 }
```

Varsayılan TTL: 600 (10 dk). Max: 3600.

**201:**

```json
{
  "code": "847291",
  "expiresAt": "2026-05-25T14:40:00.000Z",
  "qrPayload": "esr://pair/v1/{namespaceId}?code=847291&exp=..."
}
```

- `code`: 6 haneli numeric
- Tek kullanımlık; redeem sonrası invalidate

**403 DEVICE_LIMIT_PAYMENT_REQUIRED** veya **403 DEVICE_LIMIT_BLOCKED** — slot yoksa token üretilmez.

### 4.3 Pairing token kullan (yeni cihaz)

```http
POST /v1/namespaces/{namespaceId}/devices
```

**Kimlik yok.**

**Body:**

```json
{
  "pairingCode": "847291",
  "deviceLabel": "Phone",
  "clientDeviceId": "a1b2c3d4-..."
}
```

**201:**

```json
{
  "deviceToken": "dvt_yyyyyyyyyyyyyyyy",
  "deviceId": "01JFBBBB...",
  "limits": { "maxDevices": 5, "activeDevices": 3 }
}
```

**400:** geçersiz/süresi dolmuş kod → `PAIRING_CODE_INVALID`
**403:** slot limit → `DEVICE_LIMIT_*`

### 4.4 Cihaz kaldır

```http
DELETE /v1/namespaces/{namespaceId}/devices/{deviceId}
Authorization: Bearer {device_token}
```

- Herhangi bir eşleşik cihaz kendini veya başkasını kaldırabilir (MVP)
- **İstisna:** Son kalan cihaz kaldırılamaz → `LAST_DEVICE_PROTECTED`
- Host önceliği yok; recovery hariç en az 1 cihaz kalmalı

**204:** slot boşaldı.

## 5. Recovery

```http
POST /v1/namespaces/{namespaceId}/recover
```

**Body:**

```json
{
  "recoveryKeyProof": {
    "salt": "<base64url>",
    "hash": "<base64url>"
  },
  "deviceLabel": "Recovered Laptop",
  "clientDeviceId": "new-uuid"
}
```

**200:**

```json
{
  "deviceToken": "dvt_new...",
  "deviceId": "01JFNEW...",
  "revokedDeviceCount": 2,
  "limits": {
    "freeDeviceLimit": 2,
    "purchasedSlots": 3,
    "maxDevices": 5,
    "activeDevices": 1
  }
}
```

- Tüm eski `device_token` invalidate
- `purchasedSlots` **korunur**
- Blob/head revision **korunur** (veri silinmez)

**401:** `RECOVERY_INVALID`

## 6. Belge sync

### 6.1 Head meta (hafif)

```http
GET /v1/namespaces/{namespaceId}/documents/primary/head/meta
Authorization: Bearer {device_token}
```

**200:**

```json
{
  "revision": "01JF...",
  "writtenAt": "...",
  "deviceId": "...",
  "contentSha256": "...",
  "contentMagic": "ENV-ENC1",
  "sizeBytes": 842016
}
```

**404:** `DOCUMENT_NOT_FOUND` (henüz push yok)

### 6.2 Head tam envelope

```http
GET /v1/namespaces/{namespaceId}/documents/primary/head
Authorization: Bearer {device_token}
```

**200:** Tam `EsrDocEnvelope` JSON.

### 6.3 Push

```http
PUT /v1/namespaces/{namespaceId}/documents/primary
Authorization: Bearer {device_token}
```

**Body:**

```json
{
  "expectedRevision": "01JFOLD..." ,
  "envelope": { "...ESR-DOC1..." }
}
```

- `expectedRevision`: `null` veya omit → yalnızca head yoksa izin ver (ilk push)
- head varsa `expectedRevision` **zorunlu** ve head ile eşleşmeli

**201:**

```json
{
  "revision": "01JFNEW...",
  "writtenAt": "...",
  "contentSha256": "..."
}
```

**409 Conflict:**

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Remote revision differs from expected",
    "details": {
      "expectedRevision": "01JFOLD",
      "actualRevision": "01JFREMOTE",
      "remoteMeta": {
        "revision": "01JFREMOTE",
        "writtenAt": "...",
        "contentSha256": "...",
        "deviceId": "..."
      }
    }
  }
}
```

**422:** envelope validation / sha256 mismatch → `ENVELOPE_INVALID`

### 6.4 Device last seen (opsiyonel heartbeat)

```http
POST /v1/namespaces/{namespaceId}/devices/me/heartbeat
Authorization: Bearer {device_token}
```

**204** — `lastSeenAt` güncelle.

## 7. Slot / Unlock

### 7.1 Limit sorgula

```http
GET /v1/namespaces/{namespaceId}/limits
Authorization: Bearer {device_token}
```

**200:**

```json
{
  "freeDeviceLimit": 2,
  "purchasedSlots": 0,
  "maxDevices": 2,
  "activeDevices": 2,
  "onLimitReached": {
    "mode": "payment",
    "slotPackages": [3, 5, 10]
  },
  "canAddDevice": false
}
```

### 7.2 Unlock kodu uygula

```http
POST /v1/namespaces/{namespaceId}/unlock
Authorization: Bearer {device_token}
```

**Body:**

```json
{
  "unlockCode": "ESR-UNLK-3-XXXXXXXXXXXX"
}
```

**200:**

```json
{
  "slotsAdded": 3,
  "purchasedSlots": 3,
  "maxDevices": 5,
  "canAddDevice": true
}
```

**400:** `UNLOCK_CODE_INVALID` | `UNLOCK_CODE_ALREADY_REDEEMED`

### 7.3 Checkout URL al (opsiyonel — payment modu)

```http
POST /v1/namespaces/{namespaceId}/checkout
Authorization: Bearer {device_token}
```

**Body:**

```json
{
  "packageSize": 3,
  "successRedirectUrl": "myapp://sync/unlock-success",
  "cancelRedirectUrl": "myapp://sync/unlock-cancel"
}
```

**200:**

```json
{
  "checkoutUrl": "https://pay.example.com/...",
  "sessionId": "cs_..."
}
```

Webhook → unlock code veya doğrudan slot artırma (doc 06).

## 8. Admin API (opsiyonel MVP — CLI alternatifi)

Tüm admin uçları `Authorization: Bearer {admin_api_token}`.

### 8.1 Unlock kodu üret

```http
POST /v1/admin/unlock-codes
```

```json
{
  "namespaceId": "550e8400-...",
  "slots": 3,
  "expiresAt": "2027-05-25T00:00:00.000Z",
  "note": "Manual payment #1234"
}
```

**201:**

```json
{
  "unlockCode": "ESR-UNLK-3-K7M9P2Q4R6T8",
  "slots": 3,
  "expiresAt": "..."
}
```

### 8.2 Namespace slot manuel ayarla

```http
PATCH /v1/admin/namespaces/{namespaceId}/slots
```

```json
{ "purchasedSlotsDelta": 3 }
```

### 8.3 Sunucu config oku (read-only)

```http
GET /v1/admin/config
```

## 9. Sağlık

```http
GET /health
```

```json
{ "status": "ok", "version": "1.1.0", "db": "ok", "blob": "ok", "websocket": "enabled" }
```

WebSocket uçları: [13-WEBSOCKET-NOTIFICATIONS.md](./13-WEBSOCKET-NOTIFICATIONS.md) — OpenAPI kapsamı dışındadır.

## 10. Rate limiting

| Endpoint grubu | Limit |
|----------------|-------|
| POST recover | 5 / saat / namespace |
| POST devices (pair) | 20 / saat / namespace |
| POST pairing-tokens | 30 / saat / namespace |
| PUT primary | 120 / saat / device |
| Genel | 300 req / dk / IP |

Aşım: **429** `RATE_LIMIT_EXCEEDED`, `Retry-After` header.

## 11. CORS

Self-host SPA istemcileri için:

```
Access-Control-Allow-Origin: configurable (default *)
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

Production'da operatör origin whitelist kullanmalı.

Hata kodlarının tam listesi: [12-ERROR-CODES.md](./12-ERROR-CODES.md).
