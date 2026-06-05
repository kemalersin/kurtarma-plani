import {
  AccountSchema,
  BankSchema,
  CashAdvanceAccountSchema,
  CashAdvanceTransactionSchema,
  CashRegisterSchema,
  CreditCardSchema,
  CreditCardTransactionSchema,
  ExpenseSchema,
  ExpenseTypeSchema,
  IncomeSchema,
  IncomeTypeSchema,
  InstallmentCashAdvancePaymentSchema,
  InstallmentCashAdvanceSchema,
  LoanPaymentSchema,
  LoanSchema,
  TransferSchema,
} from '@/core/types/entities'
import type { ProposableEntityType } from '@/features/ai/proposals/types'
import { type ZodError, type z } from 'zod'

/** Apply aşamasında kullanılan tam entity Zod şemaları. */
export const PROPOSABLE_ENTITY_SCHEMAS = {
  bank: BankSchema,
  account: AccountSchema,
  cashRegister: CashRegisterSchema,
  incomeType: IncomeTypeSchema,
  expenseType: ExpenseTypeSchema,
  loan: LoanSchema,
  loanPayment: LoanPaymentSchema,
  creditCard: CreditCardSchema,
  creditCardTransaction: CreditCardTransactionSchema,
  cashAdvanceAccount: CashAdvanceAccountSchema,
  cashAdvanceTransaction: CashAdvanceTransactionSchema,
  installmentCashAdvance: InstallmentCashAdvanceSchema,
  installmentCashAdvancePayment: InstallmentCashAdvancePaymentSchema,
  income: IncomeSchema,
  expense: ExpenseSchema,
  transfer: TransferSchema,
} as const satisfies Record<ProposableEntityType, z.ZodType>

/** Prompt tablosu / drift kontrolünden çıkarılan alanlar. */
export const PROPOSABLE_GUIDE_EXCLUDED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'archived',
])

const PROPOSAL_META_STUB = {
  id: '__proposal__',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
} as const

const META_KEYS = ['id', 'createdAt', 'updatedAt'] as const

function formatZodIssue(
  type: ProposableEntityType,
  issue: { path: PropertyKey[]; message: string },
): string {
  const rawPath = issue.path[0]
  const path =
    rawPath === 'id' || rawPath === 'createdAt' || rawPath === 'updatedAt'
      ? 'kayıt'
      : issue.path.length
        ? `"${String(rawPath)}"`
        : 'kayıt'
  return `${type}: ${path} — ${issue.message}`
}

function formatZodError(type: ProposableEntityType, error: ZodError): string {
  const first = error.issues[0]
  if (!first) return `${type}: geçersiz veri.`
  return formatZodIssue(type, first)
}

function stripMetaFields(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  for (const key of META_KEYS) delete out[key]
  return out
}

/** Çözümlenmiş proposal `data` için Zod doğrulaması; varsayılanları uygular. */
export function validateProposableDraft(
  type: ProposableEntityType,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const schema = PROPOSABLE_ENTITY_SCHEMAS[type]
  const result = schema.safeParse({ ...PROPOSAL_META_STUB, ...data })
  if (!result.success) {
    throw new Error(formatZodError(type, result.error))
  }
  return stripMetaFields(result.data as Record<string, unknown>)
}
