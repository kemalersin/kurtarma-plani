import type { AiSettings } from '@/core/types/ai-settings'
import type { BankingPreset } from '@/core/types/banking-preset'
import type { BaseEntity } from '@/core/types/entity'
import type { AppMeta } from '@/core/types/profile'

export interface ExportOptions {
  includeSensitive: boolean
  includeSecrets: boolean
  encryptFile: boolean
}

export interface ProfileExportBundle {
  profileId: string
  entities: BaseEntity[]
  aiSettings?: AiSettings
}

export interface ExportSnapshot {
  type: typeof import('@/core/constants').EXPORT_FILE_TYPE
  schemaVersion: number
  exportedAt: string
  appVersion: string
  options: ExportOptions
  meta: AppMeta
  bankingPreset?: BankingPreset
  profiles: ProfileExportBundle[]
}
