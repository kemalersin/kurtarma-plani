/**
 * Dashboard için gerekli tüm store'ları **yükleyip** analytics fonksiyonlarını
 * reaktif birleştirir. Bileşen tarafı yalnız `data.value` üzerinden okur.
 */
import { computed, onMounted, type ComputedRef } from 'vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import { useAccountBalances } from '@/features/cashflow/useAccountBalances'
import {
  assetSnapshot,
  debtSnapshot,
  netWorth,
  type AssetSnapshot,
  type DebtSnapshot,
  type NetWorth,
} from '@/features/analytics/snapshot'
import {
  expenseByType,
  incomeByType,
  monthlyCashflowSeries,
  monthsBetween,
  upcomingDebtSeries,
  assetTrendSeries,
  type AssetTrendSeries,
  type CategoryBreakdownItem,
  type MonthlyCashflowSeries,
  type UpcomingDebtSeries,
} from '@/features/analytics/series'
import { computeDebtCoverage, sumByDateRange, cashflowStatus, type DebtCoverage } from '@/finance/cashflow'
import { D } from '@/finance/decimal'
import {
  buildScheduleForLoan,
  paidThroughIndex,
} from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import type {
  Account,
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CashRegister,
  CreditCard,
  CreditCardTransaction,
  Expense,
  ExpenseType,
  Income,
  IncomeType,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'

export interface DashboardTopAccount {
  id: string
  name: string
  balance: string
  currency: string
  kind: 'account' | 'register'
}

export interface DashboardCashflowAttention {
  overdueIncomes: number
  dueIncomes: number
  overdueExpenses: number
  dueExpenses: number
}

export interface DashboardData {
  assets: AssetSnapshot
  debts: DebtSnapshot
  worth: NetWorth
  cashflow: MonthlyCashflowSeries
  expensesByCategory: CategoryBreakdownItem[]
  incomesByCategory: CategoryBreakdownItem[]
  upcomingDebts: UpcomingDebtSeries
  assetTrend: AssetTrendSeries
  debtCoverage30: DebtCoverage
  cashflowAttention: DashboardCashflowAttention
  currentMonth: { income: number; expense: number; net: number }
  topAccounts: DashboardTopAccount[]
  range: { from: string; to: string }
}

/**
 * Mount'ta tüm gerekli entity store'larını paralel yükler. Hata yutulur — eksik
 * veri kategorisi boş kabul edilir (UI graceful degradation).
 */
export function useDashboardData(): {
  data: ComputedRef<DashboardData>
  loading: ComputedRef<boolean>
} {
  const entities = useEntitiesStore()
  const profileStore = useProfileStore()
  const { movements } = useAccountBalances()

  const accounts = entities.list<Account>('account')
  const registers = entities.list<CashRegister>('cashRegister')
  const incomes = entities.list<Income>('income')
  const expenses = entities.list<Expense>('expense')
  const incomeTypes = entities.list<IncomeType>('incomeType')
  const expenseTypes = entities.list<ExpenseType>('expenseType')
  const loans = entities.list<Loan>('loan')
  const loanPayments = entities.list<LoanPayment>('loanPayment')
  const creditCards = entities.list<CreditCard>('creditCard')
  const creditCardTransactions = entities.list<CreditCardTransaction>(
    'creditCardTransaction',
  )
  const cashAdvanceAccounts = entities.list<CashAdvanceAccount>(
    'cashAdvanceAccount',
  )
  const cashAdvanceTransactions = entities.list<CashAdvanceTransaction>(
    'cashAdvanceTransaction',
  )
  const installmentAdvances = entities.list<InstallmentCashAdvance>(
    'installmentCashAdvance',
  )
  const installmentAdvancePayments = entities.list<InstallmentCashAdvancePayment>(
    'installmentCashAdvancePayment',
  )

  const loadKeys = [
    'account',
    'cashRegister',
    'income',
    'expense',
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
    'transfer',
  ] as const

  onMounted(async () => {
    const tasks: Promise<unknown>[] = []
    for (const k of loadKeys) {
      if (!entities.loaded(k).value) {
        tasks.push(entities.load(k).catch(() => undefined))
      }
    }
    if (tasks.length) await Promise.all(tasks)
  })

  const loading = computed(() =>
    loadKeys.some((k) => entities.loading(k).value || !entities.loaded(k).value),
  )

  const localCurrency = computed(
    () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
  )

  /** Aralık: bugünden 6 ay geriye, 6 ay ileriye (toplam 13 ay). */
  const range = computed(() => {
    const today = new Date()
    const back = new Date(today)
    back.setMonth(back.getMonth() - 6)
    const fwd = new Date(today)
    fwd.setMonth(fwd.getMonth() + 6)
    return {
      from: back.toISOString(),
      to: fwd.toISOString(),
    }
  })

  /**
   * Ödenmemiş kredi + taksitli avans taksitleri (gecikmiş dahil).
   * Borç karşılama hesabında gecikmiş vadeler de dahil edilir.
   */
  const unpaidInstallmentEntries = computed(() => {
    const out: { dueDate: string; amount: number }[] = []
    for (const loan of loans.value) {
      if (loan.archived) continue
      if (loan.currency !== localCurrency.value) continue
      const schedule = buildScheduleForLoan(loan)
      const own = loanPayments.value.filter((p) => p.loanId === loan.id)
      const idx = paidThroughIndex(own)
      for (const row of schedule.rows) {
        if (row.index <= idx) continue
        out.push({ dueDate: row.dueDate, amount: Number(row.installment) })
      }
    }
    for (const adv of installmentAdvances.value) {
      if (adv.archived) continue
      if (adv.currency !== localCurrency.value) continue
      const schedule = buildScheduleForInstallmentAdvance(adv)
      const own = installmentAdvancePayments.value.filter(
        (p) => p.installmentAdvanceId === adv.id,
      )
      const idx = advancePaidThroughIndex(own)
      for (const row of schedule.rows) {
        if (row.index <= idx) continue
        out.push({ dueDate: row.dueDate, amount: Number(row.installment) })
      }
    }
    return out
  })

  /**
   * Ödenmemiş kredi + taksitli avans taksitlerinin (dueDate, amount) listesi —
   * `upcomingDebtSeries`'e veri sağlar. Bugünden ileriye doğru olanları içerir.
   */
  const pendingScheduleEntries = computed(() => {
    const today = new Date().toISOString()
    return unpaidInstallmentEntries.value.filter((e) => e.dueDate >= today)
  })

  /** Varlık trend grafiği: son 90 gün. */
  const assetTrendRange = computed(() => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 90)
    return { from: start.toISOString(), to: end.toISOString() }
  })

  /** Borç karşılama: önümüzdeki 30 gün. */
  const coverageRange = computed(() => {
    const start = new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + 30)
    return { from: start.toISOString(), to: end.toISOString() }
  })

  function countCashflowAttention(
    items: { plannedDate: string; actualDate?: string; archived?: boolean }[],
  ): { overdue: number; due: number } {
    let overdue = 0
    let due = 0
    for (const it of items) {
      if (it.archived) continue
      const s = cashflowStatus(it)
      if (s === 'overdue') overdue++
      else if (s === 'due') due++
    }
    return { overdue, due }
  }

  const data = computed<DashboardData>(() => {
    const assets = assetSnapshot(
      accounts.value,
      registers.value,
      movements.value,
      localCurrency.value,
    )
    const debts = debtSnapshot({
      loans: loans.value,
      loanPayments: loanPayments.value,
      creditCards: creditCards.value,
      creditCardTransactions: creditCardTransactions.value,
      cashAdvanceAccounts: cashAdvanceAccounts.value,
      cashAdvanceTransactions: cashAdvanceTransactions.value,
      installmentAdvances: installmentAdvances.value,
      installmentAdvancePayments: installmentAdvancePayments.value,
      localCurrency: localCurrency.value,
    })
    const worth = netWorth(assets.total, debts.total)
    const cashflow = monthlyCashflowSeries(
      incomes.value,
      expenses.value,
      range.value,
    )
    const categoryRange = {
      from: monthsBetween(range.value.from, range.value.to)[0] + '-01',
      to:
        monthsBetween(range.value.from, range.value.to).slice(-1)[0] + '-31',
    }
    const expensesByCategory = expenseByType(
      expenses.value,
      expenseTypes.value,
      categoryRange,
    )
    const incomesByCategory = incomeByType(
      incomes.value,
      incomeTypes.value,
      categoryRange,
    )
    const upcomingDebts = upcomingDebtSeries(
      pendingScheduleEntries.value,
      range.value,
    )
    const assetTrend = assetTrendSeries(
      accounts.value,
      registers.value,
      movements.value,
      localCurrency.value,
      assetTrendRange.value,
    )
    const covRange = coverageRange.value
    const debtDueEnd = covRange.to.slice(0, 10)
    const debtDue30 = unpaidInstallmentEntries.value
      .filter((e) => e.dueDate.slice(0, 10) <= debtDueEnd)
      .reduce((sum, e) => sum + e.amount, 0)
    const debtCoverage30 = computeDebtCoverage({
      cashOnHand: assets.total,
      expectedIncome: sumByDateRange(incomes.value, {
        from: covRange.from,
        to: covRange.to,
        basis: 'effective',
      }),
      expectedExpense: sumByDateRange(expenses.value, {
        from: covRange.from,
        to: covRange.to,
        basis: 'effective',
      }),
      debtDue: debtDue30,
    })
    const incAtt = countCashflowAttention(incomes.value)
    const expAtt = countCashflowAttention(expenses.value)
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const currentMonthIncome = Number(
      sumByDateRange(incomes.value, {
        from: monthStart,
        to: monthEnd,
        basis: 'effective',
      }),
    )
    const currentMonthExpense = Number(
      sumByDateRange(expenses.value, {
        from: monthStart,
        to: monthEnd,
        basis: 'effective',
      }),
    )
    const mergedAccounts: DashboardTopAccount[] = [
      ...assets.perAccount.map((a) => ({
        id: a.id,
        name: a.name,
        balance: a.balance,
        currency: a.currency,
        kind: 'account' as const,
      })),
      ...assets.perRegister.map((r) => ({
        id: r.id,
        name: r.name,
        balance: r.balance,
        currency: r.currency,
        kind: 'register' as const,
      })),
    ]
      .sort((a, b) => Number(D(b.balance)) - Number(D(a.balance)))
      .slice(0, 6)
    return {
      assets,
      debts,
      worth,
      cashflow,
      expensesByCategory,
      incomesByCategory,
      upcomingDebts,
      assetTrend,
      debtCoverage30,
      cashflowAttention: {
        overdueIncomes: incAtt.overdue,
        dueIncomes: incAtt.due,
        overdueExpenses: expAtt.overdue,
        dueExpenses: expAtt.due,
      },
      currentMonth: {
        income: currentMonthIncome,
        expense: currentMonthExpense,
        net: currentMonthIncome - currentMonthExpense,
      },
      topAccounts: mergedAccounts,
      range: range.value,
    }
  })

  return { data, loading }
}
