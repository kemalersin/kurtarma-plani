import {
  clearActiveBankingPreset,
  getActiveBankingPresetRow,
  putActiveBankingPresetRow,
} from '@/core/db/meta'
import {
  BankingPresetSchema,
  type BankingPreset,
  type BankingPresetSource,
} from '@/core/types/banking-preset'
import { BUNDLED_BANKING_PRESET } from '@/data/banking-presets'

export interface ActiveBankingPreset {
  preset: BankingPreset
  updatedAt: string | null
  source: BankingPresetSource
}

/**
 * Okuma önceliği: IndexedDB > derleme gömülü preset.
 */
export async function loadActiveBankingPreset(): Promise<ActiveBankingPreset> {
  const row = await getActiveBankingPresetRow()
  if (row) {
    return {
      preset: row.preset,
      updatedAt: row.updatedAt,
      source: row.preset.source ?? 'bundled',
    }
  }
  return { preset: BUNDLED_BANKING_PRESET, updatedAt: null, source: 'bundled' }
}

function withSource(input: unknown, source: BankingPresetSource): BankingPreset {
  const parsed = BankingPresetSchema.parse(input)
  return { ...parsed, source, fetchedAt: new Date().toISOString() }
}

export async function importBankingPresetFromJson(text: string): Promise<ActiveBankingPreset> {
  const json = JSON.parse(text) as unknown
  const preset = withSource(json, 'import')
  const updatedAt = new Date().toISOString()
  await putActiveBankingPresetRow({ id: 'active', preset, updatedAt })
  return { preset, updatedAt, source: 'import' }
}

export async function updateBankingPresetFromFeed(feedUrl: string): Promise<ActiveBankingPreset> {
  const response = await fetch(feedUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Feed isteği başarısız: HTTP ${response.status}`)
  }
  const json = (await response.json()) as unknown
  const preset = withSource(json, 'remote')
  const updatedAt = new Date().toISOString()
  await putActiveBankingPresetRow({ id: 'active', preset, updatedAt })
  return { preset, updatedAt, source: 'remote' }
}

export async function resetBankingPresetToBundled(): Promise<ActiveBankingPreset> {
  await clearActiveBankingPreset()
  return { preset: BUNDLED_BANKING_PRESET, updatedAt: null, source: 'bundled' }
}
