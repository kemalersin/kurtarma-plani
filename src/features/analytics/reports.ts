/**
 * Analiz / rapor sayfası tablo ve grafik verilerinin **saf** üreticileri.
 * UI bağımsız; filtreler explicit parametre olarak geçilir.
 */
import { D, roundMoney } from '@/finance/decimal'
import type {
  Account,
  CashRegister,
  Expense,
  ExpenseType,
  Income,
  IncomeType,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import type { AccountMovement } from '@/features/cashflow/movements'
import {
  buildScheduleForLoan,
  indexPayments,
} from '@/features/debts/loanHelpers'
import {
  buildScheduleForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import { monthlyCashflowSeries, monthsBetween } from '@/features/analytics/series'

export interface AnalyticsDateRange {
  from: string
  to: string
}

export interface AnalyticsFilters {
  range: AnalyticsDateRange
  bankId?: string
  /** `acc:<id>` veya `reg:<id>` */
  endpointId?: string
  categoryId?: string
}

export type DebtInstallmentStatus = 'paid' | 'overdue' | 'upcoming'

export interface DebtInstallmentRow {
  key: string
  debtKind: 'loan' | 'installmentAdvance'
  debtId: string
  debtName: string
  bankId: string
  bankName: string
  installmentIndex: number
  dueDate: string
  amount: string
  paid: boolean
  paidDate?: string
  paidAmount?: string
  status: DebtInstallmentStatus
}

export interface CashflowMonthRow {
  month: string
  income: string
  expense: string
  net: string
}

export interface MovementRow {
  id: string
  date: string
  endpointName: string
  sourceLabel: string
  amount: number
  source: AccountMovement['source']
  sourceId: string
}

const SOURCE_LABELS: Record<AccountMovement['source'], string> = {
  income: 'Gelir',
  expense: 'Gider',
  transfer: 'Transfer',
  loanPayment: 'Kredi ödemesi',
  creditCardPayment: 'Kart ödemesi',
  creditCardCashAdvance: 'Kart nakit avans',
  cashAdvanceDraw: 'Nakit avans çekim',
  cashAdvancePayment: 'Nakit avans ödemesi',
  installmentAdvancePayment: 'Taksitli avans ödemesi',
}

function inRange(iso: string, range: AnalyticsDateRange): boolean {
  const d = iso.slice(0, 10)
  return d >= range.from.slice(0, 10) && d <= range.to.slice(0, 10)
}

function installmentStatus(
  paid: boolean,
  dueDate: string,
  todayIso: string,
): DebtInstallmentStatus {
  if (paid) return 'paid'
  if (dueDate.slice(0, 10) < todayIso.slice(0, 10)) return 'overdue'
  return 'upcoming'
}

function parseEndpoint(endpointId?: string): {
  accountId?: string
  cashRegisterId?: string
} {
  if (!endpointId) return {}
  if (endpointId.startsWith('acc:')) return { accountId: endpointId.slice(4) }
  if (endpointId.startsWith('reg:')) return { cashRegisterId: endpointId.slice(4) }
  return {}
}

function accountBankMap(accounts: Account[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of accounts) {
    if (!a.archived) m.set(a.id, a.bankId)
  }
  return m
}

function matchesBankOnCashflowItem(
  item: { accountId?: string; cashRegisterId?: string },
  bankId: string | undefined,
  bankOfAccount: Map<string, string>,
): boolean {
  if (!bankId) return true
  if (item.cashRegisterId) return false
  if (!item.accountId) return false
  return bankOfAccount.get(item.accountId) === bankId
}

function matchesEndpointOnCashflowItem(
  item: { accountId?: string; cashRegisterId?: string },
  endpointId: string | undefined,
): boolean {
  if (!endpointId) return true
  const ep = parseEndpoint(endpointId)
  if (ep.accountId) return item.accountId === ep.accountId
  if (ep.cashRegisterId) return item.cashRegisterId === ep.cashRegisterId
  return true
}

function matchesCategory(
  incomeTypeId: string | undefined,
  expenseTypeId: string | undefined,
  categoryId: string | undefined,
): boolean {
  if (!categoryId) return true
  return incomeTypeId === categoryId || expenseTypeId === categoryId
}

/** Gelir/gider kayıtlarını ortak filtrelerle daraltır. */
export function filterCashflowRecords<T extends Income | Expense>(
  items: T[],
  accounts: Account[],
  filters: AnalyticsFilters,
  kind: 'income' | 'expense',
): T[] {
  const bankOfAccount = accountBankMap(accounts)
  return items.filter((it) => {
    if (it.archived) return false
    if (!matchesBankOnCashflowItem(it, filters.bankId, bankOfAccount)) return false
    if (!matchesEndpointOnCashflowItem(it, filters.endpointId)) return false
    if (kind === 'income') {
      const inc = it as Income
      if (!matchesCategory(inc.incomeTypeId, undefined, filters.categoryId)) return false
    } else {
      const exp = it as Expense
      if (!matchesCategory(undefined, exp.expenseTypeId, filters.categoryId)) return false
    }
    return true
  })
}

/** Kredi + taksitli avans taksit satırları (ödenmiş + bekleyen). */
export function debtInstallmentRows(
  input: {
    loans: Loan[]
    loanPayments: LoanPayment[]
    installmentAdvances: InstallmentCashAdvance[]
    installmentAdvancePayments: InstallmentCashAdvancePayment[]
    banks: { id: string; name: string }[]
    localCurrency: string
  },
  filters: AnalyticsFilters,
  todayIso = new Date().toISOString(),
): DebtInstallmentRow[] {
  const { range, bankId } = filters
  const out: DebtInstallmentRow[] = []
  const bankNames = new Map(input.banks.map((b) => [b.id, b.name]))
  const resolveBankName = (id: string) => bankNames.get(id) ?? id

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    if (bankId && loan.bankId !== bankId) continue
    const schedule = buildScheduleForLoan(loan)
    const payments = indexPayments(
      input.loanPayments.filter((p) => p.loanId === loan.id),
    )
    for (const row of schedule.rows) {
      if (!inRange(row.dueDate, range)) continue
      const payment = payments.get(row.index)
      const paid = Boolean(payment?.paidDate)
      out.push({
        key: `loan:${loan.id}:${row.index}`,
        debtKind: 'loan',
        debtId: loan.id,
        debtName: loan.name,
        bankId: loan.bankId,
        bankName: resolveBankName(loan.bankId),
        installmentIndex: row.index,
        dueDate: row.dueDate,
        amount: String(roundMoney(row.installment)),
        paid,
        paidDate: payment?.paidDate,
        paidAmount:
          payment?.paidAmount != null
            ? String(roundMoney(payment.paidAmount))
            : undefined,
        status: installmentStatus(paid, row.dueDate, todayIso),
      })
    }
  }

  for (const adv of input.installmentAdvances) {
    if (adv.archived) continue
    if (adv.currency !== input.localCurrency) continue
    if (bankId && adv.bankId !== bankId) continue
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const payments = new Map<number, InstallmentCashAdvancePayment>()
    for (const p of input.installmentAdvancePayments) {
      if (p.installmentAdvanceId === adv.id) {
        payments.set(p.installmentIndex, p)
      }
    }
    for (const row of schedule.rows) {
      if (!inRange(row.dueDate, range)) continue
      const payment = payments.get(row.index)
      const paid = Boolean(payment?.paidDate)
      out.push({
        key: `adv:${adv.id}:${row.index}`,
        debtKind: 'installmentAdvance',
        debtId: adv.id,
        debtName: adv.name,
        bankId: adv.bankId,
        bankName: resolveBankName(adv.bankId),
        installmentIndex: row.index,
        dueDate: row.dueDate,
        amount: String(roundMoney(row.installment)),
        paid,
        paidDate: payment?.paidDate,
        paidAmount:
          payment?.paidAmount != null
            ? String(roundMoney(payment.paidAmount))
            : undefined,
        status: installmentStatus(paid, row.dueDate, todayIso),
      })
    }
  }

  out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.debtName.localeCompare(b.debtName))
  return out
}

/** Aylık nakit akış tablo satırları. */
export function cashflowMonthRows(
  incomes: Income[],
  expenses: Expense[],
  filters: AnalyticsFilters,
  accounts: Account[],
): CashflowMonthRow[] {
  const filteredIncomes = filterCashflowRecords(incomes, accounts, filters, 'income')
  const filteredExpenses = filterCashflowRecords(expenses, accounts, filters, 'expense')
  const series = monthlyCashflowSeries(filteredIncomes, filteredExpenses, filters.range)
  return series.months.map((month, i) => ({
    month,
    income: String(roundMoney(series.income[i] ?? 0)),
    expense: String(roundMoney(series.expense[i] ?? 0)),
    net: String(roundMoney(series.net[i] ?? 0)),
  }))
}

/** Hesap/kasa hareket tablosu — yalnızca gerçekleşmiş hareketler. */
export function movementRows(
  movements: AccountMovement[],
  accounts: Account[],
  registers: CashRegister[],
  filters: AnalyticsFilters,
): MovementRow[] {
  const { range, bankId, endpointId } = filters
  const ep = parseEndpoint(endpointId)
  const accountNames = new Map<string, string>()
  const registerNames = new Map<string, string>()
  const bankOfAccount = accountBankMap(accounts)
  for (const a of accounts) {
    if (!a.archived) accountNames.set(a.id, a.name)
  }
  for (const r of registers) {
    if (!r.archived) registerNames.set(r.id, r.name)
  }

  const rows: MovementRow[] = []
  for (const m of movements) {
    if (!inRange(m.date, range)) continue
    if (ep.accountId && m.accountId !== ep.accountId) continue
    if (ep.cashRegisterId && m.cashRegisterId !== ep.cashRegisterId) continue
    if (bankId) {
      if (m.cashRegisterId) continue
      if (!m.accountId || bankOfAccount.get(m.accountId) !== bankId) continue
    }

    const endpointName = m.accountId
      ? accountNames.get(m.accountId) ?? m.accountId
      : m.cashRegisterId
        ? registerNames.get(m.cashRegisterId) ?? m.cashRegisterId
        : '—'

    rows.push({
      id: `${m.source}:${m.sourceId}:${m.date}:${m.amount}`,
      date: m.date,
      endpointName,
      sourceLabel: SOURCE_LABELS[m.source] ?? m.source,
      amount: m.amount,
      source: m.source,
      sourceId: m.sourceId,
    })
  }

  rows.sort((a, b) => b.date.localeCompare(a.date))
  return rows
}

/** Borç taksit satırlarından aylık bar serisi (ödenmiş / bekleyen ayrımı). */
export function debtInstallmentMonthlySeries(
  rows: DebtInstallmentRow[],
  range: AnalyticsDateRange,
): { months: string[]; paid: number[]; pending: number[] } {
  const months = monthsBetween(range.from, range.to)
  const paidMap = new Map<string, ReturnType<typeof D>>()
  const pendingMap = new Map<string, ReturnType<typeof D>>()
  for (const m of months) {
    paidMap.set(m, D(0))
    pendingMap.set(m, D(0))
  }
  for (const row of rows) {
    const k = row.dueDate.slice(0, 7)
    if (!paidMap.has(k)) continue
    const amt = D(row.amount)
    if (row.paid) {
      paidMap.set(k, paidMap.get(k)!.plus(amt))
    } else {
      pendingMap.set(k, pendingMap.get(k)!.plus(amt))
    }
  }
  return {
    months,
    paid: months.map((m) => Number(roundMoney(paidMap.get(m) ?? D(0)))),
    pending: months.map((m) => Number(roundMoney(pendingMap.get(m) ?? D(0)))),
  }
}

/** Kategori seçenekleri (gelir + gider türleri birleşik). */
export function categoryOptions(
  incomeTypes: IncomeType[],
  expenseTypes: ExpenseType[],
): { value: string; label: string; group: 'income' | 'expense' }[] {
  const out: { value: string; label: string; group: 'income' | 'expense' }[] = []
  for (const t of incomeTypes) {
    if (t.archived) continue
    out.push({ value: t.id, label: t.name, group: 'income' })
  }
  for (const t of expenseTypes) {
    if (t.archived) continue
    out.push({ value: t.id, label: t.name, group: 'expense' })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'tr'))
}
