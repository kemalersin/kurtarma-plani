# 03 — Protokol: ESR-DOC1

## 1. Genel

Envelope Sync Relay, uygulama verisini **ESR-DOC1** magic'li JSON zarf ile taşır. Zarf sunucuya yazılır; sunucu yapıyı doğrular ama payload anlamını bilmez.

İki katman:

```
┌─────────────────────────────────────┐
│ ESR-DOC1 — dış zarf (sunucu meta okur) │
│  ┌───────────────────────────────┐  │
│  │ Inner payload — opaque string │  │
│  │ (ENV-RAW1 veya ENV-ENC1)      │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Uygulama belgesi (JSON)  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## 2. ESR-DOC1 şeması

### 2.1 TypeScript / Zod

```typescript
import { z } from 'zod'

export const ESR_DOC_MAGIC = 'ESR-DOC1' as const
export const ESR_SCHEMA_VERSION = 1

export const InnerContentMagic = z.enum(['ENV-RAW1', 'ENV-ENC1'])
export type InnerContentMagic = z.infer<typeof InnerContentMagic>

export const EsrDocEnvelopeSchema = z.object({
  magic: z.literal(ESR_DOC_MAGIC),
  schemaVersion: z.number().int().min(1).max(1),
  /** Namespace kimliği — UUID v4 zorunlu */
  namespaceId: z.string().uuid(),
  /** İnsan okunur etiket — UI'da gösterim; sunucu doğrulamaz */
  namespaceLabel: z.string().min(1).max(256),
  /** Belge slot — v1 yalnızca "primary" */
  documentId: z.literal('primary'),
  /** Monoton benzersiz — ULID önerilir */
  revision: z.string().min(1).max(64),
  /** Yazan cihaz — istemci kalıcı UUID */
  deviceId: z.string().min(1).max(64),
  /** ISO 8601 UTC */
  writtenAt: z.string().datetime(),
  /** Inner payload MIME — serbest metin, uygulama tanımlı */
  contentType: z.string().min(1).max(128),
  /** Inner wrapper tipi */
  contentMagic: InnerContentMagic,
  /** SHA-256 hex (lowercase) of payload string */
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** Opaque inner JSON string (ENV-RAW1 or ENV-ENC1 object serialized) */
  payload: z.string().min(1),
})

export type EsrDocEnvelope = z.infer<typeof EsrDocEnvelopeSchema>
```

### 2.2 JSON örneği

```json
{
  "magic": "ESR-DOC1",
  "schemaVersion": 1,
  "namespaceId": "550e8400-e29b-41d4-a716-446655440000",
  "namespaceLabel": "Personal Workspace",
  "documentId": "primary",
  "revision": "01JFXYZABCDEF1234567890ABCD",
  "deviceId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "writtenAt": "2026-05-25T14:30:00.000Z",
  "contentType": "application/vnd.example.myapp.snapshot+json",
  "contentMagic": "ENV-ENC1",
  "contentSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "payload": "{\"magic\":\"ENV-ENC1\",\"kdf\":\"PBKDF2-SHA256\",\"iterations\":600000,\"salt\":\"...\",\"nonce\":\"...\",\"ciphertext\":\"...\"}"
}
```

## 3. Inner payload: ENV-RAW1 / ENV-ENC1

Sunucu bu katmanı **parse etmez**. İstemci SDK referans implementasyonu sağlar.

### 3.1 ENV-RAW1 (şifresiz — önerilmez production'da)

```json
{
  "magic": "ENV-RAW1",
  "data": "<application document JSON string or embedded object>"
}
```

`payload` alanı = bu objenin `JSON.stringify` hali.

### 3.2 ENV-ENC1 (önerilen)

```json
{
  "magic": "ENV-ENC1",
  "kdf": "PBKDF2-SHA256",
  "iterations": 600000,
  "salt": "<base64url, 16+ bytes>",
  "nonce": "<base64url, 12 bytes for AES-GCM>",
  "ciphertext": "<base64url>"
}
```

- Şifreleme: AES-256-GCM
- Anahtar: PBKDF2-SHA256(parola, salt, iterations) → 256 bit
- `ciphertext` decrypt sonrası uygulama belgesi (UTF-8 JSON string)

**Parola kaynağı uygulamaya aittir** (master password, sync password, vb.). ESR sunucusu parola görmez.

### 3.3 contentType

Uygulama serbest tanımlar. Örnekler:

- `application/vnd.example.notes.snapshot+json`
- `application/octet-stream`

Sunucu yalnızca saklar; routing yapmaz.

## 4. Revision kuralları

| Kural | Açıklama |
|-------|----------|
| Üretim | Her push yeni ULID; önceki revision tekrar kullanılmaz |
| Karşılaştırma | String equality (ULID lexicographic ≈ zaman sırası) |
| Head | Sunucu namespace+document başına tek head tutar |
| Geçmiş | MVP'de zorunlu değil; opsiyonel `revisions` tablosu |

## 5. Bütünlük doğrulama

Push sırasında sunucu **zorunlu**:

1. `EsrDocEnvelopeSchema` Zod/JSON Schema validate
2. `magic === ESR-DOC1`
3. `namespaceId`, `documentId` URL path ile eşleşmeli
4. `contentSha256 === SHA256(payload)` (hex lowercase)
5. `revision` daha önce head olarak kayıtlı olmamalı (replay koruması — opsiyonel strict)

Pull sırasında istemci **zorunlu**:

1. Aynı sha256 verify
2. Decrypt + import

## 6. Serialize

- UTF-8 JSON
- MVP: pretty-print (`null, 2`) veya compact — sunucu ikisini kabul eder; karşılaştırma canonical değil, sha256 payload string üzerinden

## 7. Conflict semantiği

Sunucu merge yapmaz.

```
PUT expectedRevision=R1, head=R2  → 409 Conflict
```

409 yanıt gövdesi remote head meta içerir (bkz. API doc).

İstemci conflict algılama (pull tarafı):

```
IF remote.revision != knownRemoteRevision
AND localHasChangesSinceLastPush
THEN conflict → user chooses remote | local
```

## 8. deviceId

- İstemci kurulumda `crypto.randomUUID()` üretir; localStorage/secure storage'da saklar
- Envelope `deviceId` = bu kalıcı cihaz kimliği
- ESR server `devices.id` (DB) farklı olabilir; eşleme istemci sorumluluğu

## 9. Versiyon yükseltme (gelecek)

| schemaVersion | Değişiklik |
|---------------|------------|
| 1 | İlk sürüm |
| 2+ | Ayrı migration doc; v1 sunucu v2 zarfı reddeder (`415` veya `422`) |

## 10. Test vektörleri (implementer oluşturmalı)

`packages/protocol/fixtures/`:

- `valid-raw-envelope.json`
- `valid-enc-envelope.json`
- `invalid-sha256.json`
- `invalid-magic.json`

Her fixture için beklenen `verifyEnvelope()` sonucu dokümante edilmeli.

## 11. Referans fonksiyonlar (pseudocode)

```typescript
async function buildEnvelope(input: BuildInput): Promise<EsrDocEnvelope> {
  const innerJson = await encodeInnerPayload(input.document, input.encryption)
  const contentSha256 = await sha256Hex(innerJson)
  return {
    magic: 'ESR-DOC1',
    schemaVersion: 1,
    namespaceId: input.namespaceId,
    namespaceLabel: input.namespaceLabel,
    documentId: 'primary',
    revision: newUlid(),
    deviceId: input.deviceId,
    writtenAt: new Date().toISOString(),
    contentType: input.contentType,
    contentMagic: input.encrypt ? 'ENV-ENC1' : 'ENV-RAW1',
    contentSha256,
    payload: innerJson,
  }
}

async function verifyEnvelope(env: EsrDocEnvelope): Promise<boolean> {
  const hash = await sha256Hex(env.payload)
  return hash === env.contentSha256.toLowerCase()
}
```
