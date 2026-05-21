export type BankingPresetSource = 'bundled' | 'remote' | 'import'

export interface BankingPreset {
  schemaVersion: number
  id: string
  label: string
  effectiveFrom: string
  source: BankingPresetSource
  fetchedAt?: string
  creditCard: {
    maxRatesByBalanceTier: Array<{
      maxBalance: number | null
      purchaseAprMonthly: number
      lateAprMonthly: number
    }>
    cashAdvanceAprMonthly: number
    minPaymentRateUnder25k: number
    minPaymentRateOver25k: number
  }
  consumerLoan?: {
    note?: string
  }
}

export interface BankingPresetRow {
  id: 'active'
  preset: BankingPreset
  updatedAt: string
}
