import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSyncMode, supportsSyncFilePicker } from '@/core/services/sync/sync-file'

describe('resolveSyncMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('FS Access yoksa manuel mod döner', () => {
    vi.stubGlobal('window', {} as Window & typeof globalThis)
    expect(supportsSyncFilePicker()).toBe(false)
    expect(resolveSyncMode('handle')).toBe('manual')
  })

  it('FS Access varsa tercih edilen modu korur', () => {
    vi.stubGlobal('window', {
      showOpenFilePicker: vi.fn(),
    } as unknown as Window & typeof globalThis)
    expect(resolveSyncMode('handle')).toBe('handle')
    expect(resolveSyncMode('manual')).toBe('manual')
  })
})
