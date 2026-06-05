import {
  AccountTypes,
  CashAdvanceTxnTypes,
  CreditCardRateModes,
  CreditCardTxnTypes,
  RatePeriods,
} from '@/core/types/entities'
import { RecurrenceIntervals } from '@/core/types/recurrence'
import {
  PROPOSABLE_ENTITY_SCHEMAS,
  PROPOSABLE_GUIDE_EXCLUDED_FIELDS,
} from '@/features/ai/proposals/entity-schemas'
import { PROPOSABLE_ENTITY_TYPES, type ProposableEntityType } from '@/features/ai/proposals/types'
import type { z } from 'zod'

export interface ProposalFieldSets {
  required: string[]
  optional: string[]
}

export interface ProposalTypeRowOverride {
  required?: string
  optional?: string
}

/** İlişki çözümlemesi ve refine kuralları — Zod tek başına yeterli olmayan satırlar. */
export const PROPOSAL_TYPE_ROW_OVERRIDES: Partial<
  Record<ProposableEntityType, ProposalTypeRowOverride>
> = {
  account: {
    required:
      'name, type (`checking`/`savings`/`fx`/`other`), openingDate, bankId veya bankRef/bankName',
    optional: 'openingBalance, iban, notes',
  },
  loan: {
    required:
      'name, bankId veya bankRef/bankName, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod (`monthly`/`annual`)',
    optional:
      'disbursementAccountId, lateInterestRate, lateInterestPeriod, taxRateMonthly, notes, payments[]',
  },
  loanPayment: {
    required:
      'loanId veya loanRef/loanName, installmentIndex, dueDate, scheduledAmount',
    optional:
      'paidDate, paidAmount, lateFee, notes, sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName',
  },
  creditCard: {
    required:
      'name, bankId veya bankRef/bankName, limit, statementCutoffDay (1–28), paymentDueDay (1–28), purchaseAprMonthly',
    optional:
      'openingBalance, openingDate, lateAprMonthly, cashAdvanceAprMonthly, cashAdvanceLateAprMonthly, taxRateMonthly, rateMode (`fixed`/`balanceTier`), notes',
  },
  creditCardTransaction: {
    required:
      'cardId veya cardRef/cardName, date, type (`purchase`/`payment`/`cashAdvance`), amount (işlem tutarı)',
    optional:
      'description, installmentCount (≥2), repaymentTotal (kart borcuna yansıyan toplam; boşsa amount), notes; `payment` → sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName; `cashAdvance` → targetAccountId/targetAccountName, targetCashRegisterId/targetCashRegisterName',
  },
  cashAdvanceAccount: {
    required:
      'name, bankId veya bankRef/bankName, limit, openingDate, interestRate, interestPeriod',
    optional:
      'openingBalance, lateInterestRate, lateInterestPeriod, taxRateMonthly, notes',
  },
  cashAdvanceTransaction: {
    required:
      'accountId veya accountRef/cashAdvanceAccountRef/cashAdvanceAccountName, date, type (`draw`/`payment`), amount',
    optional:
      'description, notes; `payment` → sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName; `draw` → targetAccountId/targetAccountName, targetCashRegisterId/targetCashRegisterName',
  },
  installmentCashAdvance: {
    required:
      'name, bankId veya bankRef/bankName, principal, termMonths, startDate, firstInstallmentDate, interestRate, interestPeriod',
    optional:
      'cashAdvanceAccountId/cashAdvanceAccountRef/cashAdvanceAccountName, taxRateMonthly, lateInterestRate, lateInterestPeriod, earlyPayoffWithoutInterest, notes, payments[]',
  },
  installmentCashAdvancePayment: {
    required:
      'installmentAdvanceId veya installmentAdvanceRef/installmentAdvanceName, installmentIndex, dueDate, scheduledAmount',
    optional:
      'paidDate, paidAmount, lateFee, notes, sourceAccountId/sourceAccountName, sourceCashRegisterId/sourceCashRegisterName',
  },
  income: {
    required:
      'amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName',
    optional:
      'incomeTypeId/incomeTypeName, actualDate, recurrence (`daily`/`weekly`/`monthly`/`yearly`), description, notes',
  },
  expense: {
    required:
      'amount, plannedDate + accountId/accountRef/accountName **veya** cashRegisterId/cashRegisterRef/cashRegisterName',
    optional:
      'expenseTypeId/expenseTypeName, actualDate, recurrence (`daily`/`weekly`/`monthly`/`yearly`), description, notes',
  },
  transfer: {
    required:
      'amount, date + kaynak (fromAccountId/fromAccountRef/fromAccountName veya fromCashRegisterId/fromCashRegisterRef/fromCashRegisterName) + hedef (toAccountId/toAccountRef/toAccountName veya toCashRegisterId/toCashRegisterRef/toCashRegisterName)',
    optional: 'description, notes, exchangeRate, targetAmount (farklı para birimli transfer)',
  },
  bank: {
    required: 'name',
    optional: 'shortName, bicSwift, branchCode, notes',
  },
  cashRegister: {
    required: 'name, openingDate',
    optional: 'openingBalance, notes',
  },
  incomeType: {
    required: 'name',
    optional: 'color, notes',
  },
  expenseType: {
    required: 'name',
    optional: 'color, notes',
  },
}

const ENUM_FIELD_HINTS: Record<string, readonly string[]> = {
  type: [...AccountTypes, ...CreditCardTxnTypes, ...CashAdvanceTxnTypes],
  interestPeriod: RatePeriods,
  lateInterestPeriod: RatePeriods,
  rateMode: CreditCardRateModes,
  recurrence: RecurrenceIntervals,
}

function isOptionalOrDefaultField(field: z.ZodType): boolean {
  if (field.isOptional?.()) return true
  return field.constructor.name === 'ZodDefault'
}

function objectShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  if (schema.constructor.name === 'ZodObject') {
    return (schema as z.ZodObject<z.ZodRawShape>).shape as Record<string, z.ZodType>
  }
  const zodDef = (schema as { _zod?: { def?: { schema?: z.ZodType; innerType?: z.ZodType } } })._zod
    ?.def
  if (zodDef?.schema) return objectShape(zodDef.schema)
  if (zodDef?.innerType) return objectShape(zodDef.innerType)
  const legacyDef = (schema as { _def?: { schema?: z.ZodType; innerType?: z.ZodType } })._def
  if (legacyDef?.schema) return objectShape(legacyDef.schema)
  if (legacyDef?.innerType) return objectShape(legacyDef.innerType)
  return null
}

/** Zod taslak şemasından alan kümelerini çıkarır (ilişki override'ları hariç). */
export function getProposalFieldSets(type: ProposableEntityType): ProposalFieldSets {
  const schema = PROPOSABLE_ENTITY_SCHEMAS[type]
  const shape = objectShape(schema)
  if (!shape) return { required: [], optional: [] }

  const required: string[] = []
  const optional: string[] = []

  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (PROPOSABLE_GUIDE_EXCLUDED_FIELDS.has(key)) continue
    if (key === 'currency') continue
    if (isOptionalOrDefaultField(fieldSchema)) {
      optional.push(key)
    } else {
      required.push(key)
    }
  }

  return { required, optional }
}

function formatAutoRequired(type: ProposableEntityType, fields: string[]): string {
  return fields
    .map((field) => {
      const hints = ENUM_FIELD_HINTS[field]
      if (hints?.length) {
        const relevant = field === 'type' ? enumHintForType(type, hints) : hints
        return `${field} (\`${relevant.join('`/`')}\`)`
      }
      return field
    })
    .join(', ')
}

function enumHintForType(type: ProposableEntityType, hints: readonly string[]): readonly string[] {
  if (type === 'account') return AccountTypes
  if (type === 'creditCardTransaction') return CreditCardTxnTypes
  if (type === 'cashAdvanceTransaction') return CashAdvanceTxnTypes
  return hints
}

function formatAutoOptional(fields: string[]): string {
  return fields.join(', ')
}

export function buildProposalTypeTableRow(type: ProposableEntityType): string {
  const override = PROPOSAL_TYPE_ROW_OVERRIDES[type]
  if (override?.required && override?.optional) {
    return `| ${type} | ${override.required} | ${override.optional} |`
  }

  const { required, optional } = getProposalFieldSets(type)
  const requiredText = override?.required ?? formatAutoRequired(type, required)
  const optionalText = override?.optional ?? formatAutoOptional(optional)
  return `| ${type} | ${requiredText} | ${optionalText} |`
}

export function buildProposalTypeTable(): string {
  const header = '| type | Zorunlu `data` alanları | Opsiyonel / ilişki |'
  const divider = '|---|---|---|'
  const rows = PROPOSABLE_ENTITY_TYPES.map((type) => buildProposalTypeTableRow(type))
  return [header, divider, ...rows].join('\n')
}

/** Override satırlarının Zod şemasıyla uyumunu doğrular (drift testi). */
export function collectProposalSchemaDrift(): string[] {
  const errors: string[] = []

  for (const type of PROPOSABLE_ENTITY_TYPES) {
    const { required, optional } = getProposalFieldSets(type)
    const allZodFields = [...required, ...optional]
    const row = buildProposalTypeTableRow(type).toLowerCase()

    for (const field of allZodFields) {
      if (!row.includes(field.toLowerCase())) {
        errors.push(`${type}: Zod alanı "${field}" prompt satırında yok`)
      }
    }

    if (required.length === 0 && optional.length === 0) {
      errors.push(`${type}: Zod alanları çıkarılamadı`)
    }
  }

  return errors
}
