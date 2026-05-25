import type { AiProviderId } from '@/core/types/ai-settings'

/** Yapıştırma / autofill kaynaklı gürültüyü temizler. */
export function normalizeApiKey(raw: string | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n\t]/g, '')
}

const ENV_LIKE = /^[A-Z][A-Z0-9_]*=\d*$/i

export function validateApiKey(provider: AiProviderId, raw: string | undefined): string | null {
  if (provider === 'ollama' || provider === 'vllm') return null
  const key = normalizeApiKey(raw)
  if (!key) return 'API anahtarı gerekli.'

  if (/^https?:\/\//i.test(key)) {
    return 'API anahtarı alanına URL yapıştırılmış görünüyor; base URL alanını kullanın.'
  }
  if (ENV_LIKE.test(key) || key.includes('FETCH_MODELS')) {
    return 'Geçersiz API anahtarı: ortam değişkeni veya komut satırı metni yapıştırılmış olabilir.'
  }
  if (/\s/.test(key)) {
    return 'API anahtarı boşluk veya satır sonu içeremez.'
  }
  if (key.length < 8) {
    return 'API anahtarı çok kısa görünüyor.'
  }

  if (
    (provider === 'openai' || provider === 'deepseek') &&
    !key.startsWith('sk-')
  ) {
    return 'OpenAI / DeepSeek anahtarları genelde sk- ile başlar; doğru alanı yapıştırdığınızdan emin olun.'
  }

  return null
}

export function formatProviderError(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'Sağlayıcı isteği başarısız.'

  try {
    const json = JSON.parse(trimmed) as {
      error?: { message?: string; type?: string }
      message?: string
      type?: string
    }
    const msg = json.error?.message ?? json.message
    const errType = json.error?.type ?? json.type
    if (msg && /invalid.*api key|authentication fail/i.test(msg)) {
      return 'API anahtarı reddedildi. Ayarlar → AI → sağlayıcıyı düzenleyip geçerli anahtarı yeniden girin (FETCH_MODELS=1 gibi build metinleri değil).'
    }
    if (errType === 'not_found_error' || (msg && /^model:/i.test(msg))) {
      const modelMatch = msg?.match(/^model:\s*(.+)$/i)
      const modelId = modelMatch?.[1]?.trim() ?? 'seçili model'
      return `Model bulunamadı veya hesabınızda erişilebilir değil: ${modelId}. Ayarlar → AI → sağlayıcı düzenle → farklı bir model seçin (ör. claude-sonnet-4-6 veya claude-opus-4-6).`
    }
    if (msg) return msg
  } catch {
    /* düz metin */
  }

  if (/^HTTP 404$/i.test(trimmed)) {
    return 'İstek bulunamadı (404). Geliştirmede Vite dev sunucusunun çalıştığından ve base URL\'nin /v1 içermediğinden emin olun; farklı bir model de deneyin.'
  }

  if (/invalid.*api key|authentication fail/i.test(trimmed)) {
    return 'API anahtarı reddedildi. Ayarlar → AI bölümünden anahtarı kontrol edin.'
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed
}
