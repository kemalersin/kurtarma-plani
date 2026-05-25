import type { EntityType } from '@/core/db/profile-db'

/** AI'nın üretebileceği finans entity tipleri (AI meta kayıtları hariç). */
export const PROPOSABLE_ENTITY_TYPES = [
  'bank',
  'account',
  'cashRegister',
  'incomeType',
  'expenseType',
  'loan',
  'loanPayment',
  'creditCard',
  'creditCardTransaction',
  'cashAdvanceAccount',
  'cashAdvanceTransaction',
  'installmentCashAdvance',
  'installmentCashAdvancePayment',
  'income',
  'expense',
  'transfer',
] as const satisfies readonly EntityType[]

export type ProposableEntityType = (typeof PROPOSABLE_ENTITY_TYPES)[number]

export interface AiProposalPaymentDraft {
  installmentIndex: number
  dueDate: string
  scheduledAmount: number
  paidDate?: string
  paidAmount?: number
  lateFee?: number
  notes?: string
}

export interface AiProposalItem {
  ref?: string
  type: ProposableEntityType
  data: Record<string, unknown>
  /** Yalnızca `loan` ve `installmentCashAdvance` için — ayrı ödeme kayıtlarına genişletilir. */
  payments?: AiProposalPaymentDraft[]
}

export interface AiProposalBundle {
  version: 1
  items: AiProposalItem[]
}

export interface ResolvedProposalItem {
  type: ProposableEntityType
  data: Record<string, unknown>
  ref?: string
}

export interface ApplyProposalResult {
  created: Array<{ type: ProposableEntityType; id: string; label: string }>
  errors: string[]
}
