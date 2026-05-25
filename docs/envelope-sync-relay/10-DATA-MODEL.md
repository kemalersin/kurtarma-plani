# 10 — Veri Modeli (PostgreSQL)

## 1. ER diyagramı

```mermaid
erDiagram
  namespaces ||--o{ devices : has
  namespaces ||--o{ pairing_tokens : has
  namespaces ||--o{ unlock_events : has
  namespaces ||--o| document_heads : has
  document_heads ||--o{ document_revisions : optional_history
  unlock_codes ||--o| unlock_events : generates

  namespaces {
    uuid id PK
    text namespace_id UK
    text namespace_label
    int free_device_limit
    int purchased_slots
    text recovery_salt
    text recovery_hash
    timestamptz created_at
    timestamptz updated_at
  }

  devices {
    uuid id PK
    uuid namespace_uuid FK
    text client_device_id
    text label
    text token_hash UK
    boolean is_host
    timestamptz paired_at
    timestamptz last_seen_at
    timestamptz revoked_at
  }

  pairing_tokens {
    uuid id PK
    uuid namespace_uuid FK
    text code_hash
    timestamptz expires_at
    timestamptz redeemed_at
    timestamptz created_at
  }

  document_heads {
    uuid namespace_uuid PK_FK
    text document_id
    text revision
    text blob_key
    text content_sha256
    text content_magic
    bigint size_bytes
    text writer_device_id
    timestamptz written_at
  }

  unlock_codes {
    text code PK
    text namespace_id
    int slots
    timestamptz expires_at
    timestamptz redeemed_at
    text note
  }

  unlock_events {
    uuid id PK
    uuid namespace_uuid FK
    int slots_added
    text source
    text unlock_code
    timestamptz created_at
  }
```

## 2. DDL (referans)

```sql
-- Migration 001_initial.sql

CREATE TABLE namespaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id TEXT NOT NULL UNIQUE,
  namespace_label TEXT NOT NULL,
  free_device_limit INT NOT NULL,
  purchased_slots INT NOT NULL DEFAULT 0,
  recovery_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT namespaces_namespace_id_uuid CHECK (
    namespace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_uuid UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  client_device_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_host BOOLEAN NOT NULL DEFAULT false,
  paired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (namespace_uuid, client_device_id)
);

CREATE INDEX idx_devices_namespace_active
  ON devices(namespace_uuid)
  WHERE revoked_at IS NULL;

CREATE TABLE pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_uuid UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pairing_tokens_namespace
  ON pairing_tokens(namespace_uuid)
  WHERE redeemed_at IS NULL;

CREATE TABLE document_heads (
  namespace_uuid UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL DEFAULT 'primary',
  revision TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_magic TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  writer_device_id TEXT NOT NULL,
  written_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (namespace_uuid, document_id)
);

CREATE TABLE unlock_codes (
  code TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL,
  slots INT NOT NULL CHECK (slots > 0),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unlock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_uuid UUID NOT NULL REFERENCES namespaces(id),
  slots_added INT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('code', 'webhook', 'admin')),
  unlock_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3. namespace_id kuralları

- API path ve envelope `namespaceId` = aynı UUID string
- Create sırasında sunucu UUID formatını doğrular (Zod `.uuid()` veya DB CHECK)
- Global unique — tenant katmanı yok

## 4. Hesaplanan alanlar (uygulama katmanı)

```typescript
function getLimits(ns: NamespaceRow, config: ServerConfig) {
  const free = ns.free_device_limit
  const purchased = ns.purchased_slots
  const maxDevices = free + purchased
  const activeDevices = countDevicesWhere({ namespace_uuid: ns.id, revoked_at: null })
  return { freeDeviceLimit: free, purchasedSlots: purchased, maxDevices, activeDevices }
}
```

## 5. Blob key format

```
{namespace_id}/primary/{revision}.json
```

Örnek: `550e8400-e29b-41d4-a716-446655440000/primary/01JFX....json`

Dosya içeriği: tam `EsrDocEnvelope` JSON UTF-8.

## 6. Token hash

```sql
token_hash = encode(sha256(decode(device_token, 'base64')), 'hex')
```

Implementer base64url kullanıyorsa decode accordingly.

## 7. Pairing code hash

DB'de plaintext code **saklanmaz**:

```
code_hash = SHA-256(normalize(code) + namespace_salt)
```

## 8. Transaction örnekleri

### 8.1 Redeem pairing (serializable)

```sql
BEGIN;
  SELECT active_count, max_devices FROM namespace_limits FOR UPDATE;
  IF active_count >= max_devices THEN ROLLBACK; -- 403
  UPDATE pairing_tokens SET redeemed_at = now() WHERE ... AND redeemed_at IS NULL;
  INSERT INTO devices (...);
COMMIT;
```

### 8.2 Push revision

```sql
BEGIN;
  SELECT revision FROM document_heads WHERE namespace_uuid = $1 FOR UPDATE;
  IF head.revision != expected THEN ROLLBACK; -- 409
  INSERT/UPDATE document_heads;
COMMIT;
-- then write blob (or blob first, then head — implementer: head last safer)
```

**Önerilen sıra:** blob write → head update (orphan blob GC job tolerates).

## 9. İndeks performans

| Sorgu | İndeks |
|-------|--------|
| devices by namespace active | partial index revoked_at IS NULL |
| pairing valid tokens | namespace + redeemed_at IS NULL |
| head by namespace | PK |
| lookup by namespace_id | UNIQUE on namespace_id |

## 10. Silme / GDPR

Namespace DELETE:

- CASCADE devices, pairing_tokens, document_heads
- Blob dosyaları async GC
- unlock_events audit retention policy (operatör)

## 11. Opsiyonel: revision history (v1.1)

```sql
CREATE TABLE document_revisions (
  id UUID PRIMARY KEY,
  namespace_uuid UUID NOT NULL,
  document_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  written_at TIMESTAMPTZ NOT NULL,
  UNIQUE (namespace_uuid, document_id, revision)
);
```

Push sırasında head update + history insert.
