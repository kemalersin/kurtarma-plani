import { describe, expect, it } from 'vitest'
import {
  formatProviderError,
  normalizeApiKey,
  validateApiKey,
} from '@/features/ai/provider-auth'

describe('normalizeApiKey', () => {
  it('trim ve satır sonlarını kaldırır', () => {
    expect(normalizeApiKey('  sk-test\n')).toBe('sk-test')
  })
})

describe('validateApiKey', () => {
  it('FETCH_MODELS=1 benzeri metni reddeder', () => {
    expect(validateApiKey('deepseek', 'FETCH_MODELS=1')).toMatch(/ortam değişkeni/)
  })

  it('geçerli sk- anahtarını kabul eder', () => {
    expect(validateApiKey('deepseek', 'sk-abcdef1234567890')).toBeNull()
  })
})

describe('formatProviderError', () => {
  it('JSON auth hatasını Türkçeleştirir', () => {
    const raw = JSON.stringify({
      error: { message: 'Authentication Fails, Your api key: ****LS=1 is invalid', type: 'authentication_error' },
    })
    expect(formatProviderError(raw)).toMatch(/API anahtarı reddedildi/)
  })

  it('model bulunamadı hatasını açıklar', () => {
    const raw = JSON.stringify({
      type: 'error',
      error: { type: 'not_found_error', message: 'model: claude-opus-4-0' },
    })
    expect(formatProviderError(raw)).toMatch(/claude-opus-4-0/)
    expect(formatProviderError(raw)).toMatch(/farklı bir model/)
  })
})
