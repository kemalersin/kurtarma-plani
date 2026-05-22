import type { ProposableEntityType } from '@/features/ai/proposals/types'

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
