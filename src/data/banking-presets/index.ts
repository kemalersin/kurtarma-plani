import { BankingPresetSchema, type BankingPreset } from '@/core/types/banking-preset'
import bundledTr from './tr-2026-01.json'

const parsed = BankingPresetSchema.parse(bundledTr)

/** Build ile derlemeye gömülü, fabrika ayarı bankacılık referansı (varsayılan). */
export const BUNDLED_BANKING_PRESET: BankingPreset = { ...parsed, source: 'bundled' }
