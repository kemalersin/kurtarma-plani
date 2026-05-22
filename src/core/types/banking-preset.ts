import { z } from 'zod'

export type BankingPresetSource = 'bundled' | 'remote' | 'import'

export const BankingPresetSchema = z.object({
  schemaVersion: z.number().int().min(1),
  id: z.string().min(1),
  label: z.string().min(1),
  effectiveFrom: z.string().min(1),
  source: z.enum(['bundled', 'remote', 'import']).optional(),
  fetchedAt: z.string().optional(),
  creditCard: z.object({
    maxRatesByBalanceTier: z
      .array(
        z.object({
          maxBalance: z.number().nullable(),
          purchaseAprMonthly: z.number().min(0),
          lateAprMonthly: z.number().min(0),
        }),
      )
      .min(1),
    cashAdvanceAprMonthly: z.number().min(0),
    cashAdvanceLateAprMonthly: z.number().min(0).optional(),
    minPaymentRateUnder25k: z.number().min(0).max(1),
    minPaymentRateOver25k: z.number().min(0).max(1),
    minPaymentLimitThreshold: z.number().min(0).optional(),
  }),
  consumerLoan: z
    .object({
      note: z.string().optional(),
      taxRateKkdf: z.number().min(0).max(1).optional(),
      taxRateBsmv: z.number().min(0).max(1).optional(),
    })
    .optional(),
  cashAdvance: z
    .object({
      monthlyAprCeiling: z.number().min(0).optional(),
      lateAprCeiling: z.number().min(0).optional(),
    })
    .optional(),
})

export type BankingPreset = z.infer<typeof BankingPresetSchema>

export interface BankingPresetRow {
  id: 'active'
  preset: BankingPreset
  updatedAt: string
}
