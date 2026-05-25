# 12 — Hata Kodları

Tüm API hataları aşağıdaki JSON gövdesini kullanır:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

`message` istemci tarafından gösterilebilir; ancak **kalıcı UI mantığı `code` üzerinden** kurulmalıdır (çoklu dil için).

## Tam liste

| HTTP | code | Açıklama | details |
|------|------|----------|---------|
| 400 | VALIDATION_ERROR | Request body veya path geçersiz | `{ fields: [...] }` |
| 400 | PAIRING_CODE_INVALID | Kod yanlış, süresi dolmuş veya kullanılmış | — |
| 400 | UNLOCK_CODE_INVALID | Unlock kodu geçersiz veya süresi dolmuş | — |
| 401 | UNAUTHORIZED | Authorization header eksik | — |
| 401 | DEVICE_TOKEN_INVALID | Token geçersiz veya revoke edilmiş | — |
| 401 | RECOVERY_INVALID | Recovery proof doğrulanamadı | — |
| 403 | FORBIDDEN | Genel yetki reddi | — |
| 403 | DEVICE_LIMIT_PAYMENT_REQUIRED | Slot dolu; ödeme/unlock gerekli | `{ slotPackages: number[], maxDevices, activeDevices }` |
| 403 | DEVICE_LIMIT_BLOCKED | Slot dolu; mod block, ödeme yok | `{ maxDevices, activeDevices }` |
| 403 | LAST_DEVICE_PROTECTED | Son cihaz kaldırılamaz | — |
| 403 | CONTENT_TYPE_NOT_ALLOWED | contentType whitelist'te yok | — |
| 404 | NOT_FOUND | Genel kayıt yok | — |
| 404 | NAMESPACE_NOT_FOUND | Namespace bulunamadı | — |
| 404 | DOCUMENT_NOT_FOUND | Henüz push yok (head yok) | — |
| 404 | DEVICE_NOT_FOUND | Cihaz id geçersiz | — |
| 409 | NAMESPACE_EXISTS | namespaceId çakışması | — |
| 409 | REVISION_CONFLICT | expectedRevision != head | `{ expectedRevision, actualRevision, remoteMeta }` |
| 409 | UNLOCK_CODE_ALREADY_REDEEMED | Kod daha önce kullanılmış | — |
| 413 | ENVELOPE_TOO_LARGE | maxEnvelopeBytes aşıldı | `{ maxBytes, actualBytes }` |
| 422 | ENVELOPE_INVALID | Magic, schema, sha256 hatası | `{ reason: string }` |
| 429 | RATE_LIMIT_EXCEEDED | Rate limit | `{ retryAfterSeconds }` |
| 500 | INTERNAL_ERROR | Beklenmeyen sunucu hatası | — |

## İstemci eşlemesi (önerilen)

```typescript
export function isDeviceLimitError(e: EsrError): boolean {
  return e.code === 'DEVICE_LIMIT_PAYMENT_REQUIRED' ||
         e.code === 'DEVICE_LIMIT_BLOCKED'
}

export function isConflictError(e: EsrError): boolean {
  return e.code === 'REVISION_CONFLICT'
}
```

## Retry politikası

| code | Retry |
|------|-------|
| 429 | Evet, Retry-After |
| 500 | Evet, exponential backoff (max 3) |
| 409 REVISION_CONFLICT | Hayır — conflict UI |
| 403 DEVICE_LIMIT_* | Hayır — unlock UI |
| 401 DEVICE_TOKEN_INVALID | Hayır — re-pair veya recovery |

## Log seviyesi

| HTTP | Log |
|------|-----|
| 4xx | warn (payload redacted) |
| 5xx | error + stack |
