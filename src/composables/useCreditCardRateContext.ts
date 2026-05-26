import { computed, type ComputedRef } from 'vue'
import {
  creditCardRateContextFromPreset,
  creditCardTaxRateFromPreset,
} from '@/core/util/banking-preset-credit-card'
import type { CardProjectionRateContext } from '@/features/debts/cardHelpers'
import { useBankingPresetStore } from '@/stores/banking-preset'

export function useCreditCardRateContext(): {
  rateContext: ComputedRef<CardProjectionRateContext>
  taxRateMonthly: ComputedRef<number>
} {
  const presetStore = useBankingPresetStore()
  const rateContext = computed(() =>
    creditCardRateContextFromPreset(presetStore.active.preset),
  )
  const taxRateMonthly = computed(() =>
    creditCardTaxRateFromPreset(presetStore.active.preset),
  )
  return { rateContext, taxRateMonthly }
}
