import { computed } from 'vue'
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
import { applyProposalBundle } from '@/features/ai/proposals/apply'
import type { AiProposalBundle, ApplyProposalResult } from '@/features/ai/proposals/types'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'

export function useAiProposalApply() {
  const entities = useEntitiesStore()
  const profileStore = useProfileStore()

  const currency = computed(
    () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
  )

  async function apply(bundle: AiProposalBundle): Promise<ApplyProposalResult> {
    return applyProposalBundle(bundle, {
      currency: currency.value,
      load: (type) => entities.load(type),
      save: (type, draft) => entities.save(type, draft),
      getLists: () => ({
        banks: entities.list<Bank>('bank').value,
        accounts: entities.list<Account>('account').value,
        cashRegisters: entities.list<CashRegister>('cashRegister').value,
        incomeTypes: entities.list<IncomeType>('incomeType').value,
        expenseTypes: entities.list<ExpenseType>('expenseType').value,
        loans: entities.list<Loan>('loan').value,
        cards: entities.list<CreditCard>('creditCard').value,
        cashAdvanceAccounts: entities.list<CashAdvanceAccount>('cashAdvanceAccount').value,
        installmentAdvances: entities.list<InstallmentCashAdvance>('installmentCashAdvance')
          .value,
      }),
    })
  }

  return { apply, currency }
}
