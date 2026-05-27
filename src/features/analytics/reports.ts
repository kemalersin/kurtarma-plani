/**
 * Analiz / rapor sayfası tablo ve grafik verilerinin **saf** üreticileri.
 * UI bağımsız; filtreler explicit parametre olarak geçilir.
 */
import { D, roundMoney } from '@/finance/decimal'
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
import { cashAdvanceAccountMonthlyDebts } from '@/features/debts/cashAdvanceHelpers'
import {
  buildCardPeriods,
  projectCardPeriodDebts,
  type CardProjectionRateContext,
} from '@/features/debts/cardHelpers'
import type { AccountMovement } from '@/features/cashflow/movements'
import {
  buildScheduleForLoan,
  indexPayments,
  loanLateFeeRates,
  paidThroughIndex,
} from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  installmentAdvanceLateFeeRates,
} from '@/features/debts/installmentAdvanceHelpers'
import { projectInstallmentRowDueAmount } from '@/features/debts/installmentDisplay'
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
  /** Kart / nakit avans vadeleri: toplam ödeme (varsayılan) veya asgari. Nakit avans aynı modu kullanır. */
  cardDueMode?: CardDebtDueMode
}

/** Borç analizinde kredi kartı vade tutarı modu. */
export type CardDebtDueMode = 'min' | 'statement'

export type DebtInstallmentStatus = 'paid' | 'overdue' | 'upcoming'

export type DebtInstallmentKind =
  | 'loan'
  | 'installmentAdvance'
  | 'cashAdvance'
  | 'cashAdvanceStatement'
  | 'creditCardMinPayment'
  | 'creditCardStatement'

export const DEBT_INSTALLMENT_KIND_LABELS: Record<DebtInstallmentKind, string> = {
  loan: 'Kredi',
  installmentAdvance: 'Taksitli avans',
  cashAdvance: 'Nakit avans asgari',
  cashAdvanceStatement: 'Nakit avans toplam',
  creditCardMinPayment: 'Kart asgari ödeme',
  creditCardStatement: 'Kart toplam ödeme',
}

export function debtInstallmentKindLabel(kind: DebtInstallmentKind): string {
  return DEBT_INSTALLMENT_KIND_LABELS[kind]
}

/** Liste Tür sütunu: kredi/avans satırlarında taksit sırası dahil etiket. */
export function debtInstallmentTypeLabel(row: DebtInstallmentRow): string {
  if (
    row.debtKind === 'creditCardMinPayment' ||
    row.debtKind === 'creditCardStatement' ||
    row.debtKind === 'cashAdvance' ||
    row.debtKind === 'cashAdvanceStatement'
  ) {
    return debtInstallmentKindLabel(row.debtKind)
  }
  const base = debtInstallmentKindLabel(row.debtKind)
  return `${base} ${row.installmentIndex}. taksiti`
}

export interface DebtInstallmentRow {
  key: string
  debtKind: DebtInstallmentKind
  debtId: string
  debtName: string
  bankId: string
  bankName: string
  installmentIndex: number
  /** Taksitli kart satırlarında toplam taksit sayısı. */
  installmentCount?: number
  dueDate: string
  /** Plan taksit tutarı (kredi / taksitli avans); diğer türlerde vade borcu. */
  amount: string
  /** Kredi / taksitli avans: gecikme rollup dahil güncel vade borcu (grafik bekleyen). */
  dueAmount?: string
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

/** Taksit planında en az bir vade seçili aralıkta mı? */
function scheduleOverlapsRange(
  rows: readonly { dueDate: string }[],
  range: AnalyticsDateRange,
): boolean {
  return rows.some((r) => inRange(r.dueDate, range))
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

function installmentPlanAmount(
  planInstallment: string,
  payment?: { scheduledAmount?: number },
): string {
  return roundMoney(payment?.scheduledAmount ?? planInstallment).toString()
}

/** Grafik / kısmi ödeme bekleyen hesabı — rollup varsa dueAmount, yoksa amount. */
function debtInstallmentDueForBalance(row: DebtInstallmentRow): ReturnType<typeof D> {
  return D(row.dueAmount ?? row.amount)
}

/** Liste Tutar sütunu — kredi / taksitli avans bekleyen satırlarda grafikle aynı (rollup + gecikme). */
export function debtInstallmentTableAmount(row: DebtInstallmentRow): string {
  if (row.debtKind === 'loan' || row.debtKind === 'installmentAdvance') {
    if (!row.paid || debtInstallmentPaidDisplay(row) > 0) {
      return row.dueAmount ?? row.amount
    }
  }
  return row.amount
}

/** Satırda gösterilecek ödenen tutar (kısmi ödeme dahil; faiz/ücret dahil gerçek ödeme). */
export function debtInstallmentPaidDisplay(row: DebtInstallmentRow): number {
  if (row.paidAmount != null && row.paidAmount !== '') {
    return Number(row.paidAmount)
  }
  if (row.paid) return Number(row.dueAmount ?? row.amount)
  return 0
}

/** Liste/grafik durum etiketi; kısmi ödeme ayrı gösterilir. */
export function debtInstallmentStatusDisplay(row: DebtInstallmentRow): {
  color: 'success' | 'warning' | 'error' | 'processing'
  label: string
} {
  if (row.status === 'paid') return { color: 'success', label: 'Ödendi' }
  if (debtInstallmentPaidDisplay(row) > 0) {
    return { color: 'warning', label: 'Kısmi ödendi' }
  }
  if (row.status === 'overdue') return { color: 'error', label: 'Gecikmiş' }
  return { color: 'processing', label: 'Bekliyor' }
}

function cardRowPaidAmount(p: { paymentsInWindow?: string }): string | undefined {
  const windowTotal = p.paymentsInWindow
  if (!windowTotal || windowTotal === '0') return undefined
  return windowTotal
}

function cardPeriodsForRange(
  card: CreditCard,
  transactions: CreditCardTransaction[],
  range: AnalyticsDateRange,
  todayIso: string,
): ReturnType<typeof buildCardPeriods> {
  const toDate = new Date(range.to)
  const fromDate = new Date(range.from)
  const today = new Date(todayIso)
  const spanMonths =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth()) +
    12
  const periods = Math.min(Math.max(spanMonths, 18), 120)
  const buildAsOf = today.getTime() > toDate.getTime() ? today : toDate
  return buildCardPeriods(card, transactions, { periods, asOf: buildAsOf })
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

/** Kredi + taksitli avans + nakit avans + kart vadeleri (ödenmiş + bekleyen). */
export function debtInstallmentRows(
  input: {
    loans: Loan[]
    loanPayments: LoanPayment[]
    installmentAdvances: InstallmentCashAdvance[]
    installmentAdvancePayments: InstallmentCashAdvancePayment[]
    cashAdvanceAccounts: CashAdvanceAccount[]
    cashAdvanceTransactions: CashAdvanceTransaction[]
    creditCards: CreditCard[]
    creditCardTransactions: CreditCardTransaction[]
    banks: { id: string; name: string }[]
    localCurrency: string
    creditCardRateContext?: CardProjectionRateContext
    /** Preset KKDF+BSMV; hesapta tanımlı değilse kullanılır */
    cashAdvanceTaxRateMonthly?: number
  },
  filters: AnalyticsFilters,
  todayIso = new Date().toISOString(),
): DebtInstallmentRow[] {
  const { range, bankId, cardDueMode = 'statement' } = filters
  const out: DebtInstallmentRow[] = []
  const bankNames = new Map(input.banks.map((b) => [b.id, b.name]))
  const resolveBankName = (id: string) => bankNames.get(id) ?? id

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    if (bankId && loan.bankId !== bankId) continue
    const schedule = buildScheduleForLoan(loan)
    if (!scheduleOverlapsRange(schedule.rows, range)) continue
    const ownPayments = input.loanPayments.filter((p) => p.loanId === loan.id)
    const paidIdx = paidThroughIndex(ownPayments)
    const payments = indexPayments(ownPayments)
    const rates = loanLateFeeRates(loan)
    for (const row of schedule.rows) {
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
        amount: installmentPlanAmount(row.installment, payment),
        dueAmount: projectInstallmentRowDueAmount(
          row,
          schedule.rows,
          paidIdx,
          todayIso,
          rates,
          payments,
        ),
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
    if (!scheduleOverlapsRange(schedule.rows, range)) continue
    const ownPayments = input.installmentAdvancePayments.filter(
      (p) => p.installmentAdvanceId === adv.id,
    )
    const paidIdx = advancePaidThroughIndex(ownPayments)
    const payments = new Map<number, InstallmentCashAdvancePayment>()
    for (const p of ownPayments) {
      payments.set(p.installmentIndex, p)
    }
    const rates = installmentAdvanceLateFeeRates(adv)
    for (const row of schedule.rows) {
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
        amount: installmentPlanAmount(row.installment, payment),
        dueAmount: projectInstallmentRowDueAmount(
          row,
          schedule.rows,
          paidIdx,
          todayIso,
          rates,
          payments,
        ),
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

  const monthKeys = monthsBetween(range.from, range.to)
  for (const acc of input.cashAdvanceAccounts) {
    if (acc.archived) continue
    if (acc.currency !== input.localCurrency) continue
    if (bankId && acc.bankId !== bankId) continue
    const txns = input.cashAdvanceTransactions.filter((t) => t.accountId === acc.id)
    const monthlyDebts = cashAdvanceAccountMonthlyDebts(
      acc,
      txns,
      monthKeys,
      todayIso,
      input.cashAdvanceTaxRateMonthly,
    )
    for (const row of monthlyDebts) {
      if (!inRange(row.dueDate, range)) continue
      const paidAmount =
        row.paidAmount != null ? String(roundMoney(row.paidAmount)) : undefined
      const statementAmount =
        row.paidInFull && row.endingBalance <= 0 && row.paidAmount != null
          ? row.paidAmount
          : row.endingBalance

      if (cardDueMode === 'statement') {
        out.push({
          key: `ca:${acc.id}:total:${row.dueDate.slice(0, 7)}`,
          debtKind: 'cashAdvanceStatement',
          debtId: acc.id,
          debtName: acc.name,
          bankId: acc.bankId,
          bankName: resolveBankName(acc.bankId),
          installmentIndex: 0,
          dueDate: row.dueDate,
          amount: String(roundMoney(statementAmount)),
          paid: row.paidInFull,
          paidAmount,
          status: installmentStatus(row.paidInFull, row.dueDate, todayIso),
        })
      } else if (row.minPayment > 0 || (row.paidAmount != null && row.paidAmount > 0)) {
        const minAmount =
          row.minPayment > 0 ? row.minPayment : (row.paidAmount ?? 0)
        out.push({
          key: `ca:${acc.id}:min:${row.dueDate.slice(0, 7)}`,
          debtKind: 'cashAdvance',
          debtId: acc.id,
          debtName: acc.name,
          bankId: acc.bankId,
          bankName: resolveBankName(acc.bankId),
          installmentIndex: 0,
          dueDate: row.dueDate,
          amount: String(roundMoney(minAmount)),
          paid: row.paidMin || row.paidInFull,
          paidAmount,
          status: installmentStatus(row.paidMin || row.paidInFull, row.dueDate, todayIso),
        })
      }
    }
  }

  for (const card of input.creditCards) {
    if (card.archived) continue
    if (card.currency !== input.localCurrency) continue
    if (bankId && card.bankId !== bankId) continue
    const txns = input.creditCardTransactions.filter((t) => t.cardId === card.id)
    const periods = cardPeriodsForRange(card, txns, range, todayIso)
    const projections = projectCardPeriodDebts(card, txns, {
      periods,
      asOf: new Date(todayIso),
      ...input.creditCardRateContext,
    })
    for (const p of projections) {
      if (!inRange(p.dueDate, range)) continue
      if (p.endingBalance <= 0) continue

      if (cardDueMode === 'statement') {
        out.push({
          key: `card:${card.id}:total:${p.cutoffDate}`,
          debtKind: 'creditCardStatement',
          debtId: card.id,
          debtName: card.name,
          bankId: card.bankId,
          bankName: resolveBankName(card.bankId),
          installmentIndex: 0,
          dueDate: p.dueDate,
          amount: String(roundMoney(p.endingBalance)),
          paid: p.paidInFull,
          paidDate: p.paidDate,
          paidAmount: cardRowPaidAmount(p),
          status: installmentStatus(p.paidInFull, p.dueDate, todayIso),
        })
      } else if (p.minPayment > 0) {
        out.push({
          key: `card:${card.id}:min:${p.cutoffDate}`,
          debtKind: 'creditCardMinPayment',
          debtId: card.id,
          debtName: card.name,
          bankId: card.bankId,
          bankName: resolveBankName(card.bankId),
          installmentIndex: 0,
          dueDate: p.dueDate,
          amount: String(roundMoney(p.minPayment)),
          paid: p.paid,
          paidDate: p.paidDate,
          paidAmount: cardRowPaidAmount(p),
          status: installmentStatus(p.paid, p.dueDate, todayIso),
        })
      }
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
    const amt = debtInstallmentDueForBalance(row)
    const paidPart =
      row.paidAmount != null && row.paidAmount !== ''
        ? D(row.paidAmount)
        : row.paid
          ? amt
          : D(0)
    if (paidPart.gt(0)) {
      paidMap.set(k, paidMap.get(k)!.plus(paidPart))
    }
    const pendingPart = row.paid
      ? D(0)
      : paidPart.gt(amt)
        ? amt
        : amt.minus(paidPart)
    if (pendingPart.gt(0)) {
      pendingMap.set(k, pendingMap.get(k)!.plus(pendingPart))
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
