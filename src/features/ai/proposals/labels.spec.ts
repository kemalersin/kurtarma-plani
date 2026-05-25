import { describe, expect, it } from 'vitest'
import { summarizeProposalItems } from '@/features/ai/proposals/labels'
import type { AiProposalItem } from '@/features/ai/proposals/types'

function loanPayment(index: number): AiProposalItem {
  return {
    type: 'loanPayment',
    data: {
      loanRef: 'l1',
      installmentIndex: index,
      dueDate: '2026-03-01',
      scheduledAmount: 1000,
    },
  }
}

describe('summarizeProposalItems', () => {
  it('ardışık aynı etiketleri x N ile birleştirir', () => {
    const items = Array.from({ length: 24 }, (_, i) => loanPayment(i + 1))
    const lines = summarizeProposalItems(items)
    expect(lines).toEqual([
      { key: 'loanPayment-0-24', label: 'Kredi taksit ödemesi x 24' },
    ])
  })

  it('farklı etiketler arasında gruplama yapmaz', () => {
    const items: AiProposalItem[] = [
      { type: 'bank', data: { name: 'Garanti' } },
      loanPayment(1),
      loanPayment(2),
      { type: 'loan', data: { name: 'Konut' } },
    ]
    const lines = summarizeProposalItems(items)
    expect(lines.map((line) => line.label)).toEqual([
      'Banka: Garanti',
      'Kredi taksit ödemesi x 2',
      'Kredi: Konut',
    ])
  })

  it('tek kayıtta çarpan göstermez', () => {
    const lines = summarizeProposalItems([loanPayment(1)])
    expect(lines[0]?.label).toBe('Kredi taksit ödemesi')
  })
})
