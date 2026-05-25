import { describe, expect, it } from 'vitest'
import { isUpdateAvailable } from '@/core/services/update-check'

describe('isUpdateAvailable', () => {
  it('detects newer semver', () => {
    expect(isUpdateAvailable('0.1.0', '0.2.0')).toBe(true)
  })

  it('is current when versions match', () => {
    expect(isUpdateAvailable('0.1.0', '0.1.0')).toBe(false)
  })

  it('is current when local semver is ahead', () => {
    expect(isUpdateAvailable('0.2.0', '0.1.0')).toBe(false)
  })
})
