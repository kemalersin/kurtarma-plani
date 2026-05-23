import type { AiProposalItem, ProposableEntityType } from '@/features/ai/proposals/types'

export const ENTITY_TYPE_LABELS: Record<ProposableEntityType, string> = {
  bank: 'Banka',
  account: 'Hesap',
  cashRegister: 'Kasa',
  incomeType: 'Gelir türü',
  expenseType: 'Gider türü',
  loan: 'Kredi',
  loanPayment: 'Kredi taksit ödemesi',
  creditCard: 'Kredi kartı',
  creditCardTransaction: 'Kart işlemi',
  cashAdvanceAccount: 'Nakit avans hesabı',
  cashAdvanceTransaction: 'Nakit avans işlemi',
  installmentCashAdvance: 'Taksitli nakit avans',
  installmentCashAdvancePayment: 'Taksitli avans ödemesi',
  income: 'Gelir',
  expense: 'Gider',
  transfer: 'Transfer',
}

export function proposalItemLabel(
  type: ProposableEntityType,
  data: Record<string, unknown>,
): string {
  const name =
    typeof data.name === 'string' && data.name.trim() ?
      data.name.trim()
    : typeof data.description === 'string' && data.description.trim() ?
      data.description.trim()
    : undefined
  const base = ENTITY_TYPE_LABELS[type]
  return name ? `${base}: ${name}` : base
}

export interface ProposalSummaryLine {
  key: string
  label: string
}

/** Ardışık aynı etiketli kayıtları «Etiket x N» olarak özetler. */
export function summarizeProposalItems(items: AiProposalItem[]): ProposalSummaryLine[] {
  const lines: ProposalSummaryLine[] = []
  let index = 0

  while (index < items.length) {
    const item = items[index]!
    const label = proposalItemLabel(item.type, item.data)
    let count = 1
    let next = index + 1

    while (next < items.length) {
      const candidate = items[next]!
      if (proposalItemLabel(candidate.type, candidate.data) !== label) break
      count += 1
      next += 1
    }

    lines.push({
      key: `${item.type}-${index}-${count}`,
      label: count > 1 ? `${label} x ${count}` : label,
    })
    index = next
  }

  return lines
}
