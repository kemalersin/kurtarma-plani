import { describe, expect, it } from 'vitest'
import { buildBankGroupedAccountOptions } from '@/features/admin/accountSelectOptions'
import type { Account, Bank } from '@/core/types/entities'

const banks: Bank[] = [
  {
    id: 'b2',
    name: 'Garanti BBVA',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'b1',
    name: 'Ziraat Bankası',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const accounts: Account[] = [
  {
    id: 'a1',
    bankId: 'b1',
    name: 'Vadesiz TL',
    type: 'checking',
    currency: 'TRY',
    openingBalance: 0,
    openingDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'a2',
    bankId: 'b2',
    name: 'Maaş',
    type: 'checking',
    currency: 'TRY',
    openingBalance: 0,
    openingDate: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('buildBankGroupedAccountOptions', () => {
  it('banka adına göre gruplar ve sıralar', () => {
    const groups = buildBankGroupedAccountOptions(accounts, banks)
    expect(groups.map((g) => g.label)).toEqual(['Garanti BBVA', 'Ziraat Bankası'])
    expect(groups[1]?.options[0]?.label).toBe('Vadesiz TL')
    expect(groups[1]?.options[0]?.bankName).toBe('Ziraat Bankası')
  })
})
