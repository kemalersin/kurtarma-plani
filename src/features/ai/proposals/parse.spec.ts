import { describe, expect, it } from 'vitest'
import {
  extractProposalBundles,
  proposalBundleKey,
  stripProposalBlocks,
} from '@/features/ai/proposals/parse'

const SAMPLE = `\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    { "ref": "b1", "type": "bank", "data": { "name": "Garanti" } }
  ]
}
\`\`\``

describe('extractProposalBundles', () => {
  it('parses kp-proposals fenced blocks', () => {
    const bundles = extractProposalBundles(`Açıklama\n${SAMPLE}`)
    expect(bundles).toHaveLength(1)
    expect(bundles[0]?.items[0]?.type).toBe('bank')
  })

  it('uses stable bundle keys for the same parsed content', () => {
    const bundlesA = extractProposalBundles(`Açıklama\n${SAMPLE}`)
    const bundlesB = extractProposalBundles(`Açıklama\n${SAMPLE}`)
    expect(proposalBundleKey(bundlesA[0]!)).toBe(proposalBundleKey(bundlesB[0]!))
  })

  it('expands nested payments on installmentCashAdvance', () => {
    const source = `\`\`\`kp-proposals
{
  "version": 1,
  "items": [
    {
      "ref": "a1",
      "type": "installmentCashAdvance",
      "data": {
        "name": "Avans",
        "bankRef": "b1",
        "principal": 1000,
        "termMonths": 3,
        "startDate": "2025-01-01",
        "firstInstallmentDate": "2025-02-01",
        "interestRate": 0.04,
        "interestPeriod": "monthly"
      },
      "payments": [
        { "installmentIndex": 1, "dueDate": "2025-02-01", "scheduledAmount": 340 }
      ]
    }
  ]
}
\`\`\``
    const bundles = extractProposalBundles(source)
    expect(bundles[0]?.items).toHaveLength(2)
    expect(bundles[0]?.items[1]?.type).toBe('installmentCashAdvancePayment')
  })
})

describe('stripProposalBlocks', () => {
  it('removes proposal blocks from markdown', () => {
    const stripped = stripProposalBlocks(`Özet metin\n${SAMPLE}`)
    expect(stripped).toBe('Özet metin')
    expect(stripped).not.toContain('kp-proposals')
  })
})
