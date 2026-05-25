/**
 * Dashboard / analiz grafik serilerinin **saf** üreticileri.
 * UI bağımsız; ECharts'a doğrudan yedirilecek `{ months[], values[] }` döner.
 */
import { D, roundMoney, type DecimalInput } from '@/finance/decimal'
import { iterateCashflowOccurrences } from '@/finance/recurrence'
import type {
  Expense,
  Income,
  IncomeType,
  ExpenseType,
  Account,
  CashRegister,
} from '@/core/types/entities'
import type { AccountMovement } from '@/features/cashflow/movements'
import {
  accountBalance,
  cashRegisterBalance,
} from '@/features/cashflow/balanceHelpers'

/** Bir ISO tarihinden `YYYY-MM` anahtarı. */
function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** İki tarih arasında inclusive ay listesi (YYYY-MM). */
export function monthsBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  const from = new Date(`${fromIso.slice(0, 7)}-01T00:00:00Z`)
  const to = new Date(`${toIso.slice(0, 7)}-01T00:00:00Z`)
  while (from.getTime() <= to.getTime()) {
    const y = from.getUTCFullYear()
    const m = String(from.getUTCMonth() + 1).padStart(2, '0')
    out.push(`${y}-${m}`)
    from.setUTCMonth(from.getUTCMonth() + 1)
  }
  return out
}

export interface MonthlyCashflowSeries {
  months: string[]
  income: number[]
  expense: number[]
  net: number[]
}

/**
 * Aylık gelir & gider toplamı + net (gelir − gider). `basis`:
 *   - `'plan'`   → `plannedDate`
 *   - `'actual'` → `actualDate` (yoksa atlanır)
 *   - `'effective'` (default) → `actualDate ?? plannedDate`
 */
export function monthlyCashflowSeries(
  incomes: Income[],
  expenses: Expense[],
  range: { from: string; to: string },
  basis: 'plan' | 'actual' | 'effective' = 'effective',
): MonthlyCashflowSeries {
  const months = monthsBetween(range.from, range.to)
  const incomeMap = new Map<string, ReturnType<typeof D>>()
  const expenseMap = new Map<string, ReturnType<typeof D>>()
  for (const m of months) {
    incomeMap.set(m, D(0))
    expenseMap.set(m, D(0))
  }

  function addToMap(
    map: Map<string, ReturnType<typeof D>>,
    item: Income | Expense,
  ): void {
    for (const occ of iterateCashflowOccurrences(item, {
      from: range.from,
      to: range.to,
      basis,
    })) {
      const k = monthKey(occ.date)
      if (!map.has(k)) continue
      map.set(k, map.get(k)!.plus(occ.amount))
    }
  }

  for (const inc of incomes) {
    if (inc.archived) continue
    addToMap(incomeMap, inc)
  }
  for (const exp of expenses) {
    if (exp.archived) continue
    addToMap(expenseMap, exp)
  }

  const income = months.map((m) => Number(roundMoney(incomeMap.get(m) ?? D(0))))
  const expense = months.map((m) => Number(roundMoney(expenseMap.get(m) ?? D(0))))
  const net = months.map((_, i) => Number((income[i] ?? 0) - (expense[i] ?? 0)))
  return { months, income, expense, net }
}

export interface CategoryBreakdownItem {
  name: string
  value: number
}

/**
 * Kategori donut — yinelenen kayıtlar aralıkta genişletilir.
 */
function breakdown<T extends { amount: DecimalInput; archived?: boolean; plannedDate: string; actualDate?: string; recurrence?: Income['recurrence'] }>(
  items: T[],
  getTypeId: (it: T) => string | undefined,
  types: { id: string; name: string }[],
  range?: { from: string; to: string },
): CategoryBreakdownItem[] {
  const totals = new Map<string, ReturnType<typeof D>>()
  const nameOf = new Map<string, string>()
  for (const t of types) nameOf.set(t.id, t.name)

  for (const it of items) {
    if (it.archived) continue
    const occurrences = range
      ? iterateCashflowOccurrences(it, { from: range.from, to: range.to, basis: 'effective' })
      : iterateCashflowOccurrences(it, { basis: 'effective' })
    if (occurrences.length === 0) continue
    const id = getTypeId(it) ?? '__none'
    if (!totals.has(id)) totals.set(id, D(0))
    for (const occ of occurrences) {
      totals.set(id, totals.get(id)!.plus(occ.amount))
    }
  }

  const out: CategoryBreakdownItem[] = []
  for (const [id, total] of totals) {
    const value = Number(roundMoney(total))
    if (value <= 0) continue
    out.push({
      name: id === '__none' ? 'Tanımsız' : nameOf.get(id) ?? id,
      value,
    })
  }
  out.sort((a, b) => b.value - a.value)
  return out
}

/** Gelir kayıtlarını `incomeTypeId` üzerinden gruplar (donut için). */
export function incomeByType(
  incomes: Income[],
  types: IncomeType[],
  range?: { from: string; to: string },
): CategoryBreakdownItem[] {
  return breakdown(incomes, (i) => i.incomeTypeId, types, range)
}

/** Gider kayıtlarını `expenseTypeId` üzerinden gruplar (donut için). */
export function expenseByType(
  expenses: Expense[],
  types: ExpenseType[],
  range?: { from: string; to: string },
): CategoryBreakdownItem[] {
  return breakdown(expenses, (e) => e.expenseTypeId, types, range)
}

export interface AssetTrendSeries {
  dates: string[]
  values: number[]
}

/**
 * Bir hesap veya tüm hesap+kasaların **günlük** bakiye serisi. Hareketler
 * `collectMovements` ile gelir; `accountBalance(asOf=her gün)` formülünü
 * vectorize eder. Mobil performans için tarih sayısı 90'dan fazla olduğunda
 * 7 günlük adımlara düşülür.
 */
export function assetTrendSeries(
  accounts: Account[],
  registers: CashRegister[],
  movements: AccountMovement[],
  localCurrency: string,
  range: { from: string; to: string },
): AssetTrendSeries {
  const start = new Date(`${range.from.slice(0, 10)}T00:00:00Z`)
  const end = new Date(`${range.to.slice(0, 10)}T23:59:59Z`)
  const dayMs = 86_400_000
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs))
  const step = span > 90 ? 7 : 1
  const dates: string[] = []
  const values: number[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += step * dayMs) {
    const d = new Date(t)
    const iso = d.toISOString()
    let total = D(0)
    for (const a of accounts) {
      if (a.archived) continue
      if (a.currency !== localCurrency) continue
      total = total.plus(accountBalance(a, movements, iso))
    }
    for (const r of registers) {
      if (r.archived) continue
      if (r.currency !== localCurrency) continue
      total = total.plus(cashRegisterBalance(r, movements, iso))
    }
    dates.push(iso.slice(0, 10))
    values.push(Number(roundMoney(total)))
  }
  return { dates, values }
}

export interface UpcomingDebtSeries {
  months: string[]
  /** O ay vadesi gelen ödenmemiş taksit toplamı (kredi + taksitli avans). */
  scheduled: number[]
}

/**
 * İleriye doğru N ay için vadesi gelen taksit toplamlarını ay bazlı çıkarır.
 * Yalnızca **ödenmemiş** taksitler dahil; bugünden ileriye doğru gelen vadeler.
 */
export function upcomingDebtSeries(
  scheduledByDate: { dueDate: string; amount: DecimalInput }[],
  range: { from: string; to: string },
): UpcomingDebtSeries {
  const months = monthsBetween(range.from, range.to)
  const map = new Map<string, ReturnType<typeof D>>()
  for (const m of months) map.set(m, D(0))
  for (const it of scheduledByDate) {
    const k = monthKey(it.dueDate)
    if (!map.has(k)) continue
    map.set(k, map.get(k)!.plus(it.amount))
  }
  const scheduled = months.map((m) => Number(roundMoney(map.get(m) ?? D(0))))
  return { months, scheduled }
}
