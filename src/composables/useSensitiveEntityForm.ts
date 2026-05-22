import type { EntityType } from '@/core/db/profile-db'
import { useEntitiesStore } from '@/stores/entities'

export interface SensitiveFormFields {
  sensitive: boolean
}

export function emptySensitiveFields(): Pick<SensitiveFormFields, 'sensitive'> {
  return { sensitive: false }
}

export function readSensitiveDraft(
  entityType: EntityType,
  entityId: string | undefined,
): boolean {
  if (!entityId) return false
  return useEntitiesStore().isSensitive(entityType, entityId)
}

export function sensitiveSaveOptions(draft: SensitiveFormFields): { sensitive: boolean } {
  return { sensitive: draft.sensitive }
}
