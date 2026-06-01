const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ParsePairingFailureReason = 'needs-namespace' | 'invalid'

export type ParsePairingResult =
  | { ok: true; namespaceId: string; code: string }
  | { ok: false; reason: ParsePairingFailureReason; message: string }

function isValidNamespaceId(id: string): boolean {
  return UUID_RE.test(id)
}

function extractSixDigitCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  return digits.length === 6 ? digits : null
}

/** Host `createPairingToken` QR payload: `esr://pair/v1/{namespaceId}?code=…` */
export function parseEsrPairingInput(
  raw: string,
  namespaceIdOverride?: string,
): ParsePairingResult {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid', message: 'Eşleştirme kodu veya QR bağlantısı gerekli.' }
  }

  if (trimmed.toLowerCase().startsWith('esr://')) {
    try {
      const url = new URL(trimmed)
      const segments = url.pathname.split('/').filter(Boolean)
      const namespaceId = segments[segments.length - 1] ?? ''
      const code = url.searchParams.get('code')?.replace(/\D/g, '') ?? ''
      if (!isValidNamespaceId(namespaceId)) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'QR bağlantısında geçerli profil kimliği (UUID) yok.',
        }
      }
      if (code.length !== 6) {
        return {
          ok: false,
          reason: 'invalid',
          message: 'QR bağlantısında geçerli 6 haneli kod yok.',
        }
      }
      return { ok: true, namespaceId, code }
    } catch {
      return { ok: false, reason: 'invalid', message: 'QR bağlantısı okunamadı.' }
    }
  }

  const code = extractSixDigitCode(trimmed)
  if (!code) {
    return {
      ok: false,
      reason: 'invalid',
      message: '6 haneli kod veya esr:// QR bağlantısı girin.',
    }
  }

  const namespaceId = namespaceIdOverride?.trim()
  if (!namespaceId) {
    return {
      ok: false,
      reason: 'needs-namespace',
      message:
        'Yalnızca kod yeterli değil; host cihazdaki QR bağlantısını yapıştırın veya profil kimliğini (UUID) girin.',
    }
  }
  if (!isValidNamespaceId(namespaceId)) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Profil kimliği geçerli bir UUID olmalıdır.',
    }
  }

  return { ok: true, namespaceId, code }
}
