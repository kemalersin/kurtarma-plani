import type { EntityType } from '@/core/db/profile-db'
import type {
  Account,
  Bank,
  CashAdvanceAccount,
  CashRegister,
  CreditCard,
  ExpenseType,
  IncomeType,
  InstallmentCashAdvance,
  Loan,
} from '@/core/types/entities'
import { proposalItemLabel } from '@/features/ai/proposals/labels'
import {
  buildNameLookup,
  canResolveItem,
  PROPOSABLE_TO_ENTITY,
  resolveProposalData,
  type ResolveLookup,
} from '@/features/ai/proposals/resolve'
import type {
  AiProposalBundle,
  AiProposalItem,
  ApplyProposalResult,
} from '@/features/ai/proposals/types'

export interface ApplyProposalDeps {
  currency: string
  load: (type: EntityType) => Promise<unknown[]>
  save: <T extends { id: string; createdAt: string; updatedAt: string }>(
    type: EntityType,
    draft: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => Promise<T>
  getLists: () => {
    banks: Bank[]
    accounts: Account[]
    cashRegisters: CashRegister[]
    incomeTypes: IncomeType[]
    expenseTypes: ExpenseType[]
    loans: Loan[]
    cards: CreditCard[]
    cashAdvanceAccounts: CashAdvanceAccount[]
    installmentAdvances: InstallmentCashAdvance[]
  }
}

const LOAD_TYPES: EntityType[] = [
  'bank',
  'account',
  'cashRegister',
  'incomeType',
  'expenseType',
  'loan',
  'creditCard',
  'cashAdvanceAccount',
  'installmentCashAdvance',
]

function buildLookup(deps: ApplyProposalDeps, refToId: Map<string, string>): ResolveLookup {
  const lists = deps.getLists()
  return {
    banksByName: buildNameLookup(lists.banks),
    accountsByName: buildNameLookup(lists.accounts),
    cashRegistersByName: buildNameLookup(lists.cashRegisters),
    incomeTypesByName: buildNameLookup(lists.incomeTypes),
    expenseTypesByName: buildNameLookup(lists.expenseTypes),
    loansByName: buildNameLookup(lists.loans),
    cardsByName: buildNameLookup(lists.cards),
    cashAdvanceAccountsByName: buildNameLookup(lists.cashAdvanceAccounts),
    installmentAdvancesByName: buildNameLookup(lists.installmentAdvances),
    refToId: new Map(refToId),
  }
}

async function ensureLoaded(deps: ApplyProposalDeps): Promise<void> {
  await Promise.all(LOAD_TYPES.map((type) => deps.load(type)))
}

function nextResolvableBatch(
  pending: AiProposalItem[],
  lookup: ResolveLookup,
): AiProposalItem[] {
  const batch: AiProposalItem[] = []
  for (const item of pending) {
    if (canResolveItem(item.type, item.data, lookup)) batch.push(item)
  }
  return batch
}

export async function applyProposalBundle(
  bundle: AiProposalBundle,
  deps: ApplyProposalDeps,
): Promise<ApplyProposalResult> {
  const result: ApplyProposalResult = { created: [], errors: [] }
  await ensureLoaded(deps)

  const refToId = new Map<string, string>()
  let pending = [...bundle.items]

  while (pending.length) {
    const lookup = buildLookup(deps, refToId)
    const batch = nextResolvableBatch(pending, lookup)
    if (!batch.length) {
      result.errors.push(
        `Çözümlenemeyen ${pending.length} kayıt kaldı: ${pending
          .map((item) => proposalItemLabel(item.type, item.data))
          .join(', ')}`,
      )
      break
    }

    for (const item of batch) {
      try {
        const resolved = resolveProposalData(item.type, item.data, lookup, {
          currency: deps.currency,
        })
        const entityType = PROPOSABLE_TO_ENTITY[item.type]
        const saved = await deps.save(entityType, resolved as never)
        if (item.ref) refToId.set(item.ref, saved.id)
        result.created.push({
          type: item.type,
          id: saved.id,
          label: proposalItemLabel(item.type, resolved),
        })
      } catch (error) {
        result.errors.push(
          `${proposalItemLabel(item.type, item.data)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    const applied = new Set(batch)
    pending = pending.filter((item) => !applied.has(item))
  }

  return result
}
