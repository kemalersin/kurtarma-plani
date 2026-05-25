# 07 — Sunucu Yapılandırması

## 1. Config dosyası

Varsayılan path: `/etc/esr/config.yaml` veya `./config.yaml`

Environment override: `ESR_*` prefix (nested `__` veya `.` — implementer dokümante eder).

## 2. Tam şema

```yaml
# Envelope Sync Relay — Server Configuration v1

server:
  host: "0.0.0.0"
  port: 8080
  publicUrl: "https://sync.example.com"   # checkout redirect, QR
  trustProxy: true                         # behind reverse proxy

database:
  url: "postgresql://esr:secret@postgres:5432/esr"
  poolSize: 10
  ssl: false

blob:
  driver: "filesystem"                     # filesystem | s3
  filesystem:
    path: "/data/blobs"
  s3:
    endpoint: ""
    bucket: "esr-blobs"
    accessKey: ""
    secretKey: ""
    region: "auto"

auth:
  adminApiToken: "${ESR_ADMIN_TOKEN}"      # min 32 char random
  deviceTokenBytes: 32

recovery:
  argon2:
    memoryCost: 65536
    timeCost: 3
    parallelism: 4

limits:
  # İlk kaç cihaz ücretsiz (namespace create anında kopyalanır)
  defaultFreeDeviceLimit: 2

  # Limit dolunca: payment | block
  onLimitReached:
    mode: payment
    slotPackages: [3, 5, 10]

  # Rate limits (see API doc)
  rateLimit:
    enabled: true
    recoverPerHour: 5
    pairingPerHour: 20

pairing:
  codeTtlSeconds: 600
  codeLength: 6
  maxTtlSeconds: 3600

sync:
  maxEnvelopeBytes: 52428800             # 50 MB
  allowedContentTypes: []                # empty = all allowed; örn. application/vnd.*.snapshot+json

unlock:
  codePrefix: "ESR-UNLK"
  defaultExpiryDays: 365
  hmacSecret: "${ESR_UNLOCK_HMAC_SECRET}"

payment:                                     # optional phase 2
  enabled: false
  provider: "stripe"
  webhookSecret: ""
  priceByPackage:
    "3": "price_xxx"
    "5": "price_yyy"
    "10": "price_zzz"

cors:
  allowedOrigins:
    - "*"
  # production: ["https://app.example.com"]

logging:
  level: "info"
  format: "json"
  redactPaths:
    - "envelope.payload"
    - "deviceToken"
    - "recoveryKeyProof"

metrics:
  enabled: true
  path: "/metrics"

websocket:
  enabled: true
  pingIntervalSeconds: 30
  pongTimeoutSeconds: 10
  maxConnectionsPerNamespace: 20
  maxConnectionsPerDevice: 3
```

## 3. Ortam değişkenleri (minimum docker)

```bash
ESR_DATABASE_URL=postgresql://esr:esr@postgres:5432/esr
ESR_ADMIN_TOKEN=change-me-long-random
ESR_UNLOCK_HMAC_SECRET=change-me-long-random
ESR_BLOB_PATH=/data/blobs
ESR_PUBLIC_URL=https://sync.example.com
ESR_DEFAULT_FREE_DEVICE_LIMIT=2
ESR_ON_LIMIT_MODE=payment          # payment | block
ESR_SLOT_PACKAGES=3,5,10
ESR_WEBSOCKET_ENABLED=true
ESR_WS_PING_INTERVAL=30
```

## 4. docker-compose.yml (referans)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: esr
      POSTGRES_PASSWORD: esr
      POSTGRES_DB: esr
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U esr"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: .
    ports:
      - "8080:8080"
    environment:
      ESR_DATABASE_URL: postgresql://esr:esr@postgres:5432/esr
      ESR_ADMIN_TOKEN: ${ESR_ADMIN_TOKEN}
      ESR_UNLOCK_HMAC_SECRET: ${ESR_UNLOCK_HMAC_SECRET}
      ESR_BLOB_PATH: /data/blobs
      ESR_PUBLIC_URL: ${ESR_PUBLIC_URL:-http://localhost:8080}
      ESR_DEFAULT_FREE_DEVICE_LIMIT: ${ESR_DEFAULT_FREE_DEVICE_LIMIT:-2}
      ESR_ON_LIMIT_MODE: ${ESR_ON_LIMIT_MODE:-payment}
    volumes:
      - blobs:/data/blobs
    depends_on:
      postgres:
        condition: service_healthy

  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - api

volumes:
  pgdata:
  blobs:
  caddy_data:
```

## 5. Caddyfile örneği

```
sync.example.com {
  reverse_proxy api:8080
}
```

## 6. Operatör senaryoları

| Senaryo | Config |
|---------|--------|
| Kişisel, ücretsiz, geniş limit | `free: 10`, `mode: block` |
| Ticari hosted | `free: 2`, `mode: payment`, packages `[3,5,10]` |
| Demo | `free: 99`, `mode: block` |
| Sıkı | `free: 1`, `mode: payment` |
| Kapalı ticari | `free: 2`, `mode: block` (3. cihaz imkansız) |

## 7. contentType kısıtlama (opsiyonel)

```yaml
sync:
  allowedContentTypes:
    - "application/vnd.example.myapp.snapshot+json"
```

Boş liste → tüm contentType değerleri kabul.

Push sırasında envelope `contentType` whitelist kontrolü → 403 `CONTENT_TYPE_NOT_ALLOWED`.

## 8. Migrasyon

Implementer DB migration aracı kullanır (Drizzle, golang-migrate, vb.).

İlk migration: doc 10 şeması.

Config değişikliği DB migration gerektirmez (restart yeterli).

## 9. Yedekleme

Operatör sorumluluğu:

| Bileşen | Yedek |
|---------|-------|
| PostgreSQL | pg_dump günlük |
| Blob volume | rsync / snapshot |
| Config + secrets | güvenli vault |

Restore prosedürü README'de operatör için ayrı kısa bölüm.

## 10. Sağlık ve hazır olma

`/health` checks:

- DB `SELECT 1`
- Blob path writable + readable
- Config valid (startup'ta Zod validate)

Startup invalid config → process exit non-zero.
