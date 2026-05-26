import type { BankingPreset } from '@/core/types/banking-preset'
import type { CardProjectionRateContext } from '@/features/debts/cardHelpers'

/** Preset'ten kart projeksiyonu için faiz bağlamı üretir. */
export function creditCardRateContextFromPreset(
  preset: BankingPreset,
): CardProjectionRateContext {
  const cc = preset.creditCard
  return {
    balanceTiers: cc.maxRatesByBalanceTier,
    presetCashAdvanceApr: cc.cashAdvanceAprMonthly,
    presetCashAdvanceLateApr: cc.cashAdvanceLateAprMonthly,
  }
}

/** KKDF + BSMV toplamı (kredi kartı faiz vergisi). */
export function creditCardTaxRateFromPreset(preset: BankingPreset): number {
  const cc = preset.creditCard
  return (cc.taxRateKkdf ?? 0) + (cc.taxRateBsmv ?? 0)
}
