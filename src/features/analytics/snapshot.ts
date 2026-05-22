/**
 * Dashboard / analiz için **anlık** finansal pozisyon özetleri (varlık + borç).
 *
 * Saf TS — Vue / store bağımlılığı yok. Veriler dışarıdan parametre olarak
 * geçilir; reaktif sarmalama UI tarafında yapılır.
 */
import { D, roundMoney, type DecimalInput } from '@/finance/decimal'
import type {
  Account,
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CashRegister,
  CreditCard,
  CreditCardTransaction,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
  Loan,
  LoanPayment,
} from '@/core/types/entities'
import { runRevolvingLedger } from '@/finance/cash-advance'
import { creditCardStatement } from '@/finance/credit-card'
import {
  accountBalance,
  cashRegisterBalance,
} from '@/features/cashflow/balanceHelpers'
import type { AccountMovement } from '@/features/cashflow/movements'
import {
  buildScheduleForLoan,
  paidThroughIndex,
} from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'

export interface AssetSnapshot {
  total: string
  perAccount: { id: string; name: string; balance: string; currency: string }[]
  perRegister: { id: string; name: string; balance: string; currency: string }[]
}

/**
 * Hesap ve kasaların asOf anındaki gerçekleşmiş bakiye toplamı.
 * Dövizli hesapları **toplamaz** (currency uyumsuzluğu) — yalnız profil
 * `localCurrency` ile aynı para birimi olanlar `total`'a dahil. Liste
 * (`perAccount`/`perRegister`) tümünü içerir; UI dönüşür sterip gösterir.
 */
export function assetSnapshot(
  accounts: Account[],
  registers: CashRegister[],
  movements: AccountMovement[],
  localCurrency: string,
  asOf?: string,
): AssetSnapshot {
  let total = D(0)
  const perAccount = accounts
    .filter((a) => !a.archived)
    .map((a) => {
      const balance = accountBalance(a, movements, asOf)
      if (a.currency === localCurrency) total = total.plus(balance)
      return { id: a.id, name: a.name, balance, currency: a.currency }
    })
  const perRegister = registers
    .filter((r) => !r.archived)
    .map((r) => {
      const balance = cashRegisterBalance(r, movements, asOf)
      if (r.currency === localCurrency) total = total.plus(balance)
      return { id: r.id, name: r.name, balance, currency: r.currency }
    })
  return {
    total: roundMoney(total).toString(),
    perAccount,
    perRegister,
  }
}

export interface DebtSnapshot {
  /** Tüm borç türlerinin asOf anındaki toplam kalan borcu (profil currency). */
  total: string
  byType: {
    loans: string
    creditCards: string
    cashAdvances: string
    installmentAdvances: string
  }
  /** Vadesi geçmiş (ödenmemiş) taksit/asgari ödeme sayısı. */
  overdueCount: number
  /** Donut/pie grafiği için (ad + tutar). */
  breakdown: { name: string; value: number }[]
}

interface DebtSnapshotInput {
  loans: Loan[]
  loanPayments: LoanPayment[]
  creditCards: CreditCard[]
  creditCardTransactions: CreditCardTransaction[]
  cashAdvanceAccounts: CashAdvanceAccount[]
  cashAdvanceTransactions: CashAdvanceTransaction[]
  installmentAdvances: InstallmentCashAdvance[]
  installmentAdvancePayments: InstallmentCashAdvancePayment[]
  /** Profil currency — ileride çapraz currency desteğinde filter için. */
  localCurrency: string
  asOf?: string
}

/**
 * Tüm borç türleri için kalan bakiye toplayıcı. Her tip için uygun finans
 * motoru çağrılır (kredi anüite kalan, kart dönem sonu, KMH revolving ledger,
 * taksitli avans anüite kalan).
 */
export function debtSnapshot(input: DebtSnapshotInput): DebtSnapshot {
  const asOf = input.asOf ?? new Date().toISOString()

  let loansTotal = D(0)
  let cardsTotal = D(0)
  let caTotal = D(0)
  let iaTotal = D(0)
  let overdueCount = 0

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    const schedule = buildScheduleForLoan(loan)
    const own = input.loanPayments.filter((p) => p.loanId === loan.id)
    const idx = paidThroughIndex(own)
    const remaining =
      idx === 0
        ? schedule.rows[0]?.beginningBalance ?? '0'
        : idx >= schedule.rows.length
          ? '0'
          : schedule.rows[idx - 1]?.endingBalance ?? '0'
    loansTotal = loansTotal.plus(remaining)
    const today = new Date(asOf)
    for (const row of schedule.rows) {
      if (row.index <= idx) continue
      if (new Date(row.dueDate).getTime() < today.getTime()) overdueCount++
    }
  }

  for (const card of input.creditCards) {
    if (card.archived) continue
    if (card.currency !== input.localCurrency) continue
    const txns = input.creditCardTransactions.filter(
      (t) => t.cardId === card.id,
    )
    const statement = creditCardStatement({
      openingBalance: 0,
      transactions: txns.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      limit: card.limit,
    })
    cardsTotal = cardsTotal.plus(statement.endingBalance)
  }

  for (const acc of input.cashAdvanceAccounts) {
    if (acc.archived) continue
    if (acc.currency !== input.localCurrency) continue
    const txns = input.cashAdvanceTransactions.filter(
      (t) => t.accountId === acc.id,
    )
    const ledger = runRevolvingLedger({
      openingBalance: acc.openingBalance ?? 0,
      openingDate: acc.openingDate,
      transactions: txns.map((t) => ({
        date: t.date,
        amount: t.amount,
        type: t.type,
      })),
      apr: { value: acc.interestRate, period: acc.interestPeriod },
      asOf,
    })
    caTotal = caTotal.plus(ledger.total)
  }

  for (const adv of input.installmentAdvances) {
    if (adv.archived) continue
    if (adv.currency !== input.localCurrency) continue
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const own = input.installmentAdvancePayments.filter(
      (p) => p.installmentAdvanceId === adv.id,
    )
    const idx = advancePaidThroughIndex(own)
    const remaining =
      idx === 0
        ? schedule.rows[0]?.beginningBalance ?? '0'
        : idx >= schedule.rows.length
          ? '0'
          : schedule.rows[idx - 1]?.endingBalance ?? '0'
    iaTotal = iaTotal.plus(remaining)
    const today = new Date(asOf)
    for (const row of schedule.rows) {
      if (row.index <= idx) continue
      if (new Date(row.dueDate).getTime() < today.getTime()) overdueCount++
    }
  }

  const total = loansTotal.plus(cardsTotal).plus(caTotal).plus(iaTotal)

  return {
    total: roundMoney(total).toString(),
    byType: {
      loans: roundMoney(loansTotal).toString(),
      creditCards: roundMoney(cardsTotal).toString(),
      cashAdvances: roundMoney(caTotal).toString(),
      installmentAdvances: roundMoney(iaTotal).toString(),
    },
    overdueCount,
    breakdown: [
      { name: 'Krediler', value: Number(roundMoney(loansTotal)) },
      { name: 'Kredi kartları', value: Number(roundMoney(cardsTotal)) },
      { name: 'Nakit avans', value: Number(roundMoney(caTotal)) },
      { name: 'Taksitli avans', value: Number(roundMoney(iaTotal)) },
    ].filter((b) => b.value > 0),
  }
}

export interface NetWorth {
  assets: string
  debts: string
  net: string
  /** debts / assets oranı (assets sıfırsa 0). */
  debtToAssetRatio: number
}

/** Net varlık = varlık − borç. */
export function netWorth(assets: DecimalInput, debts: DecimalInput): NetWorth {
  const a = D(assets)
  const d = D(debts)
  const ratio = a.lte(0) ? 0 : Math.min(1e6, d.div(a).toNumber())
  return {
    assets: roundMoney(a).toString(),
    debts: roundMoney(d).toString(),
    net: roundMoney(a.minus(d)).toString(),
    debtToAssetRatio: ratio,
  }
}
