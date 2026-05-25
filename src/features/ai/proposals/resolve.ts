import type { EntityType } from '@/core/db/profile-db'
import type { ProposableEntityType } from '@/features/ai/proposals/types'

export interface ResolveLookup {
  banksByName: Map<string, string>
  accountsByName: Map<string, string>
  cashRegistersByName: Map<string, string>
  incomeTypesByName: Map<string, string>
  expenseTypesByName: Map<string, string>
  loansByName: Map<string, string>
  cardsByName: Map<string, string>
  cashAdvanceAccountsByName: Map<string, string>
  installmentAdvancesByName: Map<string, string>
  refToId: Map<string, string>
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR')
}

export function buildNameLookup<T extends { id: string; name: string }>(
  items: T[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    map.set(normalizeName(item.name), item.id)
  }
  return map
}

export function toIsoDateTime(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Tarih boş olamaz.')
  if (trimmed.includes('T')) return new Date(trimmed).toISOString()
  return new Date(`${trimmed}T12:00:00.000Z`).toISOString()
}

const REF_FIELD_MAP: Record<string, string> = {
  bankRef: 'bankId',
  accountRef: 'accountId',
  cashRegisterRef: 'cashRegisterId',
  incomeTypeRef: 'incomeTypeId',
  expenseTypeRef: 'expenseTypeId',
  loanRef: 'loanId',
  cardRef: 'cardId',
  cashAdvanceAccountRef: 'cashAdvanceAccountId',
  installmentAdvanceRef: 'installmentAdvanceId',
  fromAccountRef: 'fromAccountId',
  fromCashRegisterRef: 'fromCashRegisterId',
  toAccountRef: 'toAccountId',
  toCashRegisterRef: 'toCashRegisterId',
}

const NAME_FIELD_MAP: Record<string, keyof ResolveLookup> = {
  bankName: 'banksByName',
  accountName: 'accountsByName',
  cashRegisterName: 'cashRegistersByName',
  incomeTypeName: 'incomeTypesByName',
  expenseTypeName: 'expenseTypesByName',
  loanName: 'loansByName',
  cardName: 'cardsByName',
  cashAdvanceAccountName: 'cashAdvanceAccountsByName',
  installmentAdvanceName: 'installmentAdvancesByName',
  fromAccountName: 'accountsByName',
  toAccountName: 'accountsByName',
  fromCashRegisterName: 'cashRegistersByName',
  toCashRegisterName: 'cashRegistersByName',
  sourceAccountName: 'accountsByName',
  sourceCashRegisterName: 'cashRegistersByName',
  targetAccountName: 'accountsByName',
  targetCashRegisterName: 'cashRegistersByName',
}

const NAME_TO_ID_FIELD: Record<string, string> = {
  bankName: 'bankId',
  accountName: 'accountId',
  cashRegisterName: 'cashRegisterId',
  incomeTypeName: 'incomeTypeId',
  expenseTypeName: 'expenseTypeId',
  loanName: 'loanId',
  cardName: 'cardId',
  cashAdvanceAccountName: 'cashAdvanceAccountId',
  installmentAdvanceName: 'installmentAdvanceId',
  fromAccountName: 'fromAccountId',
  toAccountName: 'toAccountId',
  fromCashRegisterName: 'fromCashRegisterId',
  toCashRegisterName: 'toCashRegisterId',
  sourceAccountName: 'sourceAccountId',
  sourceCashRegisterName: 'sourceCashRegisterId',
  targetAccountName: 'targetAccountId',
  targetCashRegisterName: 'targetCashRegisterId',
}

const DATE_FIELDS = new Set([
  'openingDate',
  'startDate',
  'firstInstallmentDate',
  'dueDate',
  'paidDate',
  'plannedDate',
  'actualDate',
  'date',
])

const STRIP_FIELDS = new Set([
  ...Object.keys(REF_FIELD_MAP),
  ...Object.keys(NAME_FIELD_MAP),
  'ref',
])

function lookupName(
  lookup: ResolveLookup,
  field: keyof ResolveLookup,
  name: string,
  label: string,
): string {
  const map = lookup[field]
  if (!(map instanceof Map)) throw new Error(`${label} çözümlenemedi.`)
  const id = map.get(normalizeName(name))
  if (!id) throw new Error(`${label} bulunamadı: ${name}`)
  return id
}

export function canResolveItem(
  type: ProposableEntityType,
  data: Record<string, unknown>,
  lookup: ResolveLookup,
): boolean {
  try {
    resolveProposalData(type, data, lookup, { dryRun: true })
    return true
  } catch {
    return false
  }
}

export function resolveProposalData(
  type: ProposableEntityType,
  data: Record<string, unknown>,
  lookup: ResolveLookup,
  options?: { dryRun?: boolean; currency?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (STRIP_FIELDS.has(key)) continue
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }

  for (const [refField, idField] of Object.entries(REF_FIELD_MAP)) {
    if (data[refField] == null) continue
    const ref = String(data[refField]).trim()
    const id = lookup.refToId.get(ref)
    if (!id) throw new Error(`${refField} çözümlenemedi: ${ref}`)
    out[idField] = id
  }

  for (const [nameField, idField] of Object.entries(NAME_TO_ID_FIELD)) {
    if (data[nameField] == null || out[idField]) continue
    const name = String(data[nameField])
    const lookupField = NAME_FIELD_MAP[nameField]
    if (!lookupField) continue
    out[idField] = lookupName(lookup, lookupField, name, nameField)
  }

  for (const [key, value] of Object.entries(data)) {
    if (!key.endsWith('Id') || out[key] || typeof value !== 'string') continue
    out[key] = value.trim()
  }

  for (const field of DATE_FIELDS) {
    if (typeof out[field] === 'string') {
      out[field] = toIsoDateTime(String(out[field]))
    }
  }

  if (!out.currency && options?.currency) {
    out.currency = options.currency
  }

  validateRequired(type, out)

  if (options?.dryRun) return out
  return out
}

function validateRequired(type: ProposableEntityType, data: Record<string, unknown>): void {
  const require = (...keys: string[]) => {
    for (const key of keys) {
      if (data[key] === undefined || data[key] === null || data[key] === '') {
        throw new Error(`${type}: "${key}" zorunlu.`)
      }
    }
  }

  switch (type) {
    case 'bank':
      require('name')
      break
    case 'account':
      require('name', 'type', 'openingDate', 'bankId')
      break
    case 'cashRegister':
      require('name', 'openingDate')
      break
    case 'incomeType':
    case 'expenseType':
      require('name')
      break
    case 'loan':
      require(
        'name',
        'bankId',
        'principal',
        'termMonths',
        'startDate',
        'firstInstallmentDate',
        'interestRate',
        'interestPeriod',
      )
      break
    case 'loanPayment':
      require('loanId', 'installmentIndex', 'dueDate', 'scheduledAmount')
      break
    case 'creditCard':
      require(
        'name',
        'bankId',
        'limit',
        'statementCutoffDay',
        'paymentDueDay',
        'purchaseAprMonthly',
      )
      break
    case 'creditCardTransaction':
      require('cardId', 'date', 'type', 'amount')
      break
    case 'cashAdvanceAccount':
      require('name', 'bankId', 'limit', 'openingDate', 'interestRate', 'interestPeriod')
      break
    case 'cashAdvanceTransaction':
      require('accountId', 'date', 'type', 'amount')
      break
    case 'installmentCashAdvance':
      require(
        'name',
        'bankId',
        'principal',
        'termMonths',
        'startDate',
        'firstInstallmentDate',
        'interestRate',
        'interestPeriod',
      )
      break
    case 'installmentCashAdvancePayment':
      require('installmentAdvanceId', 'installmentIndex', 'dueDate', 'scheduledAmount')
      break
    case 'income':
    case 'expense':
      require('amount', 'plannedDate')
      if (!data.accountId && !data.cashRegisterId) {
        throw new Error(`${type}: hesap veya kasa gerekli.`)
      }
      break
    case 'transfer':
      require('amount', 'date')
      if (
        (!data.fromAccountId && !data.fromCashRegisterId) ||
        (!data.toAccountId && !data.toCashRegisterId)
      ) {
        throw new Error('transfer: kaynak ve hedef gerekli.')
      }
      break
    default:
      break
  }
}

export const PROPOSABLE_TO_ENTITY: Record<ProposableEntityType, EntityType> = {
  bank: 'bank',
  account: 'account',
  cashRegister: 'cashRegister',
  incomeType: 'incomeType',
  expenseType: 'expenseType',
  loan: 'loan',
  loanPayment: 'loanPayment',
  creditCard: 'creditCard',
  creditCardTransaction: 'creditCardTransaction',
  cashAdvanceAccount: 'cashAdvanceAccount',
  cashAdvanceTransaction: 'cashAdvanceTransaction',
  installmentCashAdvance: 'installmentCashAdvance',
  installmentCashAdvancePayment: 'installmentCashAdvancePayment',
  income: 'income',
  expense: 'expense',
  transfer: 'transfer',
}
