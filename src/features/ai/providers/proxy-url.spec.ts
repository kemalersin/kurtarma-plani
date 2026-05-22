import { describe, expect, it, vi } from 'vitest'
import { resolveBaseUrl, normalizeProviderBaseUrl } from '@/features/ai/providers/index'

describe('resolveBaseUrl dev proxy', () => {
  it('uses dev proxy for anthropic when base URL is default cloud endpoint', () => {
    vi.stubEnv('DEV', true)
    expect(resolveBaseUrl('anthropic', 'https://api.anthropic.com')).toBe('/kp-ai-proxy/anthropic')
    vi.unstubAllEnvs()
  })

  it('keeps custom base URL in dev', () => {
    vi.stubEnv('DEV', true)
    expect(resolveBaseUrl('anthropic', 'https://my-proxy.example.com')).toBe(
      'https://my-proxy.example.com',
    )
    vi.unstubAllEnvs()
  })

  it('strips trailing /v1 from anthropic base URL', () => {
    expect(normalizeProviderBaseUrl('anthropic', 'https://api.anthropic.com/v1')).toBe(
      'https://api.anthropic.com',
    )
    expect(normalizeProviderBaseUrl('anthropic', '/kp-ai-proxy/anthropic/v1')).toBe(
      '/kp-ai-proxy/anthropic',
    )
  })
})
