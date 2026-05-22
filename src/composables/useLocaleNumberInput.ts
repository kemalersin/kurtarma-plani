import { computed } from 'vue'
import {
  getCurrencyMaxFractionDigits,
  getLocaleSeparators,
  getPercentMaxFractionDigits,
} from '@/core/locale/number-format'
import { useProfileStore } from '@/stores/profile'

export type LocaleNumberInputKind = 'currency' | 'percent' | 'integer'

export interface LocaleNumberInputProps {
  decimalSeparator: string
  precision: number
  step: number
}

/**
 * Profil `localeSettings` ile uyumlu AntDV `InputNumber` prop'ları.
 * Özel formatter/parser yok — AntDV `decimalSeparator` + `precision` kullanır (çakışma önlenir).
 */
export function useLocaleNumberInput(kind: LocaleNumberInputKind) {
  const profileStore = useProfileStore()

  const locale = computed(() => profileStore.activeProfile?.localeSettings.locale ?? 'tr-TR')
  const currency = computed(() => profileStore.activeProfile?.localeSettings.currency ?? 'TRY')

  const maxFractionDigits = computed(() => {
    if (kind === 'integer') return 0
    if (kind === 'percent') return getPercentMaxFractionDigits(locale.value)
    return getCurrencyMaxFractionDigits(locale.value, currency.value)
  })

  const decimalSeparator = computed(() => getLocaleSeparators(locale.value).decimal)

  const step = computed(() => {
    const digits = maxFractionDigits.value
    if (digits <= 0) return 1
    return 10 ** -digits
  })

  const inputProps = computed<LocaleNumberInputProps>(() => ({
    decimalSeparator: decimalSeparator.value,
    precision: maxFractionDigits.value,
    step: step.value,
  }))

  return { inputProps, profileCurrency: currency, locale }
}
