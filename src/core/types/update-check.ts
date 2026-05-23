import { z } from 'zod'

export const UpdateCheckConfigSchema = z.object({
  enabled: z.boolean(),
  /** @deprecated `dismissedRemoteKey` kullanın. */
  dismissedVersion: z.string().optional(),
  dismissedRemoteKey: z.string().optional(),
  lastCheckedAt: z.string().optional(),
  lastRemoteVersion: z.string().optional(),
})

export type UpdateCheckConfig = z.infer<typeof UpdateCheckConfigSchema>

export function createDefaultUpdateCheckConfig(): UpdateCheckConfig {
  return {
    enabled: true,
  }
}

export function normalizeUpdateCheckConfig(raw: unknown): UpdateCheckConfig {
  const base = createDefaultUpdateCheckConfig()
  if (!raw || typeof raw !== 'object') return base
  const parsed = UpdateCheckConfigSchema.partial().safeParse(raw)
  if (!parsed.success) return base
  return { ...base, ...parsed.data }
}
