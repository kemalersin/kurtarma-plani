import { describe, expect, it } from 'vitest'
import { AI_PROPOSAL_GUIDE } from '@/features/ai/proposals/prompt'
import {
  buildProposalTypeTable,
  collectProposalSchemaDrift,
  getProposalFieldSets,
} from '@/features/ai/proposals/schema-meta'
import { PROPOSABLE_ENTITY_TYPES } from '@/features/ai/proposals/types'

describe('proposal schema meta', () => {
  it('Zod alanları prompt override satırlarında yer alır (drift yok)', () => {
    expect(collectProposalSchemaDrift()).toEqual([])
  })

  it('creditCard opsiyonel alanları Zod ile eşleşir', () => {
    const { optional } = getProposalFieldSets('creditCard')
    expect(optional).toContain('rateMode')
    expect(optional).toContain('cashAdvanceAprMonthly')
    expect(optional).toContain('cashAdvanceLateAprMonthly')
    expect(optional).toContain('taxRateMonthly')
  })

  it('AI_PROPOSAL_GUIDE tablosu buildProposalTypeTable ile üretilir', () => {
    expect(AI_PROPOSAL_GUIDE).toContain(buildProposalTypeTable())
  })

  it('tüm proposal tipleri tabloda listelenir', () => {
    const table = buildProposalTypeTable()
    for (const type of PROPOSABLE_ENTITY_TYPES) {
      expect(table).toContain(`| ${type} |`)
    }
  })

  it('creditCard satırı yeni faiz alanlarını içerir', () => {
    const table = buildProposalTypeTable()
    expect(table).toContain('cashAdvanceAprMonthly')
    expect(table).toContain('rateMode')
  })
})
