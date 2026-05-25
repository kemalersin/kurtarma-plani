import { z } from 'zod'
import { EXPORT_FILE_TYPE, SCHEMA_VERSION } from '@/core/constants'
import { BankingPresetSchema } from '@/core/types/banking-preset'

export interface ExportOptions {
  includeSensitive: boolean
  includeSecrets: boolean
  encryptFile: boolean
  password?: string
}

const LocaleSettingsSchema = z.object({
  locale: z.string(),
  currency: z.string(),
  timeZone: z.string(),
  dateFormat: z.string(),
})

const ProfileMetaForExportSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastOpenedAt: z.string().optional(),
  localeSettings: LocaleSettingsSchema,
})

const ProfileEntitySchema = z.object({
  id: z.string(),
  type: z.string(),
  updatedAt: z.string(),
  sensitive: z.boolean().optional(),
  data: z.unknown(),
})

export type ProfileEntityForExport = z.infer<typeof ProfileEntitySchema>

const ProfileExportBundleSchema = z.object({
  profile: ProfileMetaForExportSchema,
  entities: z.array(ProfileEntitySchema),
})

export type ProfileExportBundle = z.infer<typeof ProfileExportBundleSchema>

export const ExportSnapshotSchema = z.object({
  type: z.literal(EXPORT_FILE_TYPE),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  appVersion: z.string(),
  options: z.object({
    includeSensitive: z.boolean(),
    includeSecrets: z.boolean(),
  }),
  bankingPreset: BankingPresetSchema.optional(),
  profiles: z.array(ProfileExportBundleSchema),
})

export type ExportSnapshot = z.infer<typeof ExportSnapshotSchema>

export const ENCRYPTED_FILE_MAGIC = 'KP-ENC1' as const
export const PLAIN_FILE_MAGIC = 'KP-RAW1' as const

export interface EncryptedFileEnvelope {
  magic: typeof ENCRYPTED_FILE_MAGIC
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
    ct: string
  }
}

export interface PlainFileEnvelope {
  magic: typeof PLAIN_FILE_MAGIC
  schemaVersion: typeof SCHEMA_VERSION
  exportedAt: string
  snapshot: ExportSnapshot
}

