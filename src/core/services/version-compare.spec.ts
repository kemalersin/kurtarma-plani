import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  isRemoteVersionNewer,
  normalizeVersionTag,
} from '@/core/services/version-compare'

describe('normalizeVersionTag', () => {
  it('strips leading v', () => {
    expect(normalizeVersionTag('v1.2.3')).toBe('1.2.3')
  })
})

describe('compareVersions', () => {
  it('orders semver parts', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1)
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('treats missing patch/minor as zero', () => {
    expect(compareVersions('1', '1.0.0')).toBe(0)
    expect(compareVersions('1.1', '1.1.0')).toBe(0)
  })
})

describe('isRemoteVersionNewer', () => {
  it('detects newer remote', () => {
    expect(isRemoteVersionNewer('0.1.0', '0.1.1')).toBe(true)
    expect(isRemoteVersionNewer('0.2.0', '0.1.9')).toBe(false)
  })
})
