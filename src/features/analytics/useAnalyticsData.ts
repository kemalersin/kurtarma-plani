/**
 * Analiz / rapor sayfası için entity yükleme + filtreli rapor verisi.
 */
import { computed, onMounted, type ComputedRef } from 'vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useCreditCardRateContext } from '@/composables/useCreditCardRateContext'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import {
  assetTrendSeries,
  expenseByType,
  incomeByType,
  monthlyCashflowSeries,
} from '@/features/analytics/series'
import {
  cashflowMonthRows,
  categoryOptions,
  debtInstallmentMonthlySeries,
  debtInstallmentRows,
  filterCashflowRecords,
  movementRows,
  type AnalyticsFilters,
  type CashflowMonthRow,
  type DebtInstallmentRow,
  type MovementRow,
} from '@/features/analytics/reports'
import type {
  Bank,
  Account,
  CashRegister,
  Income,
  Expense,
  IncomeType,
  ExpenseType,
  Loan,
  LoanPayment,
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'

export interface AnalyticsData {
  debtRows: DebtInstallmentRow[]
  debtSeries: ReturnType<typeof debtInstallmentMonthlySeries>
  cashflowRows: CashflowMonthRow[]
  cashflowSeries: ReturnType<typeof monthlyCashflowSeries>
  incomeCategories: ReturnType<typeof incomeByType>
  expenseCategories: ReturnType<typeof expenseByType>
  movementRows: MovementRow[]
  assetTrend: ReturnType<typeof assetTrendSeries>
  banks: Bank[]
  accounts: Account[]
  registers: CashRegister[]
  categories: ReturnType<typeof categoryOptions>
  localCurrency: string
}

const LOAD_KEYS = [
  'bank',
  'account',
  'cashRegister',
  'income',
  'expense',
  'incomeType',
  'expenseType',
  'loan',
  'loanPayment',
  'installmentCashAdvance',
  'installmentCashAdvancePayment',
  'cashAdvanceAccount',
  'creditCard',
  'creditCardTransaction',
  'transfer',
  'cashAdvanceTransaction',
] as const

export function useAnalyticsData(
  filters: ComputedRef<AnalyticsFilters>,
): { data: ComputedRef<AnalyticsData>; loading: ComputedRef<boolean> } {
  const entities = useEntitiesStore()
  const profileStore = useProfileStore()
  const { rateContext, taxRateMonthly } = useCreditCardRateContext()
  const { movements } = useAccountBalances()

  const banks = entities.list<Bank>('bank')
  const accounts = entities.list<Account>('account')
  const registers = entities.list<CashRegister>('cashRegister')
  const incomes = entities.list<Income>('income')
  const expenses = entities.list<Expense>('expense')
  const incomeTypes = entities.list<IncomeType>('incomeType')
  const expenseTypes = entities.list<ExpenseType>('expenseType')
  const loans = entities.list<Loan>('loan')
  const loanPayments = entities.list<LoanPayment>('loanPayment')
  const installmentAdvances = entities.list<InstallmentCashAdvance>('installmentCashAdvance')
  const installmentAdvancePayments = entities.list<InstallmentCashAdvancePayment>(
    'installmentCashAdvancePayment',
  )
  const cashAdvanceAccounts = entities.list<CashAdvanceAccount>('cashAdvanceAccount')
  const cashAdvanceTransactions = entities.list<CashAdvanceTransaction>('cashAdvanceTransaction')
  const creditCards = entities.list<CreditCard>('creditCard')
  const creditCardTransactions = entities.list<CreditCardTransaction>('creditCardTransaction')

  onMounted(async () => {
    const tasks: Promise<unknown>[] = []
    for (const k of LOAD_KEYS) {
      if (!entities.loaded(k).value) {
        tasks.push(entities.load(k).catch(() => undefined))
      }
    }
    if (tasks.length) await Promise.all(tasks)
  })

  const loading = computed(() =>
    LOAD_KEYS.some((k) => entities.loading(k).value || !entities.loaded(k).value),
  )

  const localCurrency = computed(
    () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
  )

  const data = computed<AnalyticsData>(() => {
    const f = filters.value
    const lc = localCurrency.value
    const debtRows = debtInstallmentRows(
      {
        loans: loans.value,
        loanPayments: loanPayments.value,
        installmentAdvances: installmentAdvances.value,
        installmentAdvancePayments: installmentAdvancePayments.value,
        cashAdvanceAccounts: cashAdvanceAccounts.value,
        cashAdvanceTransactions: cashAdvanceTransactions.value,
        creditCards: creditCards.value,
        creditCardTransactions: creditCardTransactions.value,
        banks: banks.value,
        localCurrency: lc,
        creditCardRateContext: rateContext.value,
        cashAdvanceTaxRateMonthly: taxRateMonthly.value,
      },
      f,
    )
    const filteredIncomes = filterCashflowRecords(
      incomes.value,
      accounts.value,
      f,
      'income',
    )
    const filteredExpenses = filterCashflowRecords(
      expenses.value,
      accounts.value,
      f,
      'expense',
    )
    const cashflowSeries = monthlyCashflowSeries(
      filteredIncomes,
      filteredExpenses,
      f.range,
    )
    const categoryRange = {
      from: `${f.range.from.slice(0, 7)}-01`,
      to: `${f.range.to.slice(0, 7)}-31`,
    }

    const ep = f.endpointId
    let trendAccounts = accounts.value
    let trendRegisters = registers.value
    if (ep?.startsWith('acc:')) {
      const id = ep.slice(4)
      trendAccounts = accounts.value.filter((a) => a.id === id)
      trendRegisters = []
    } else if (ep?.startsWith('reg:')) {
      const id = ep.slice(4)
      trendAccounts = []
      trendRegisters = registers.value.filter((r) => r.id === id)
    } else if (f.bankId) {
      trendAccounts = accounts.value.filter((a) => a.bankId === f.bankId)
      trendRegisters = []
    }

    return {
      debtRows,
      debtSeries: debtInstallmentMonthlySeries(debtRows, f.range),
      cashflowRows: cashflowMonthRows(
        incomes.value,
        expenses.value,
        f,
        accounts.value,
      ),
      cashflowSeries,
      incomeCategories: incomeByType(
        filteredIncomes,
        incomeTypes.value,
        categoryRange,
      ),
      expenseCategories: expenseByType(
        filteredExpenses,
        expenseTypes.value,
        categoryRange,
      ),
      movementRows: movementRows(
        movements.value,
        accounts.value,
        registers.value,
        f,
      ),
      assetTrend: assetTrendSeries(
        trendAccounts,
        trendRegisters,
        movements.value,
        lc,
        f.range,
      ),
      banks: banks.value.filter((b) => !b.archived),
      accounts: accounts.value.filter((a) => !a.archived),
      registers: registers.value.filter((r) => !r.archived),
      categories: categoryOptions(incomeTypes.value, expenseTypes.value),
      localCurrency: lc,
    }
  })

  return { data, loading }
}
