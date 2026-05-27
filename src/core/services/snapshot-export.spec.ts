import { describe, expect, it } from 'vitest'
import { isSnapshotExportableEntity, SNAPSHOT_EXCLUDED_ENTITY_TYPES } from '@/core/services/snapshot'
import type { EntityType } from '@/core/db/profile-db'

describe('snapshot export exclusions', () => {
  it('chatSession yedek/senkron dışı', () => {
    expect(SNAPSHOT_EXCLUDED_ENTITY_TYPES.has('chatSession')).toBe(true)
    expect(isSnapshotExportableEntity('chatSession')).toBe(false)
  })

  it('finans entity tipleri dışa aktarılabilir', () => {
    const exportable: EntityType[] = ['bank', 'account', 'loan', 'aiSettings', 'aiUsage']
    for (const type of exportable) {
      expect(isSnapshotExportableEntity(type)).toBe(true)
    }
  })
})
