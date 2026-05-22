import { z } from 'zod'
import { PROPOSABLE_ENTITY_TYPES, type AiProposalBundle, type AiProposalItem } from '@/features/ai/proposals/types'

const PaymentDraftSchema = z.object({
  installmentIndex: z.number().int().positive(),
  dueDate: z.string().min(1),
  scheduledAmount: z.number(),
  paidDate: z.string().optional(),
  paidAmount: z.number().optional(),
  lateFee: z.number().optional(),
  notes: z.string().optional(),
})

export const AiProposalItemSchema = z.object({
  ref: z.string().min(1).optional(),
  type: z.enum(PROPOSABLE_ENTITY_TYPES),
  data: z.record(z.string(), z.unknown()),
  payments: z.array(PaymentDraftSchema).optional(),
})

export const AiProposalBundleSchema = z.object({
  version: z.literal(1),
  items: z.array(AiProposalItemSchema).min(1),
})

export function parseProposalBundle(raw: unknown): AiProposalBundle | null {
  const parsed = AiProposalBundleSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data
}

/** İç içe ödemeleri ayrı proposal item'lara genişletir. */
export function expandProposalItems(items: AiProposalItem[]): AiProposalItem[] {
  const expanded: AiProposalItem[] = []
  for (const item of items) {
    expanded.push({ ref: item.ref, type: item.type, data: item.data })
    if (
      item.payments?.length &&
      (item.type === 'loan' || item.type === 'installmentCashAdvance')
    ) {
      const parentRef = item.ref
      for (const payment of item.payments) {
        const paymentType =
          item.type === 'loan' ? 'loanPayment' : 'installmentCashAdvancePayment'
        const parentKey =
          item.type === 'loan' ? 'loanRef' : 'installmentAdvanceRef'
        expanded.push({
          type: paymentType,
          data: {
            [parentKey]: parentRef,
            installmentIndex: payment.installmentIndex,
            dueDate: payment.dueDate,
            scheduledAmount: payment.scheduledAmount,
            paidDate: payment.paidDate,
            paidAmount: payment.paidAmount,
            lateFee: payment.lateFee,
            notes: payment.notes,
          },
        })
      }
    }
  }
  return expanded
}
