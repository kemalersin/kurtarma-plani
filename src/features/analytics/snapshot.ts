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
import { cashAdvanceState } from '@/features/debts/cashAdvanceHelpers'
import { cardCommittedTotal, type CardProjectionRateContext } from '@/features/debts/cardHelpers'
import {
  accountBalance,
  cashRegisterBalance,
} from '@/features/cashflow/balanceHelpers'
import type { AccountMovement } from '@/features/cashflow/movements'
import {
  buildScheduleForLoan,
  paidThroughIndex,
  payoffForLoan,
  remainingDebtForLoan,
} from '@/features/debts/loanHelpers'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  payoffForInstallmentAdvance,
  remainingDebtForInstallmentAdvance,
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
  /**
   * Bugün erken kapama tahmini toplamı (kredi + taksitli avans payoff; kart/KMH kalan borç).
   */
  earlyPayoffTotal: string
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
  creditCardRateContext?: CardProjectionRateContext
  /** Preset KKDF+BSMV; hesapta tanımlı değilse nakit avans motorunda kullanılır */
  cashAdvanceTaxRateMonthly?: number
}

export type { DebtSnapshotInput }

function loanPaymentsFor(loan: Loan, loanPayments: LoanPayment[]) {
  return loanPayments.filter((p) => p.loanId === loan.id)
}

function loanScheduleContext(loan: Loan, loanPayments: LoanPayment[]) {
  const schedule = buildScheduleForLoan(loan)
  const own = loanPaymentsFor(loan, loanPayments)
  const idx = paidThroughIndex(own)
  return { schedule, own, idx }
}

function remainingLoanDebt(
  loan: Loan,
  loanPayments: LoanPayment[],
  asOf: string,
): string {
  const { schedule, own, idx } = loanScheduleContext(loan, loanPayments)
  return remainingDebtForLoan(loan, schedule, idx, asOf, own)
}

function earlyPayoffForLoan(
  loan: Loan,
  loanPayments: LoanPayment[],
  asOf: string,
): string {
  const { schedule, own, idx } = loanScheduleContext(loan, loanPayments)
  return payoffForLoan(loan, schedule, idx, asOf, own)
}

function loanOverdueCount(loan: Loan, loanPayments: LoanPayment[], asOf: string): number {
  const { schedule, idx } = loanScheduleContext(loan, loanPayments)
  const today = new Date(asOf)
  let count = 0
  for (const row of schedule.rows) {
    if (row.index <= idx) continue
    if (new Date(row.dueDate).getTime() < today.getTime()) count++
  }
  return count
}

/**
 * Toplam kart yükümlülüğü (ekstre borcu + henüz tahakkuk etmemiş gelecek
 * taksitler). Türkiye'de bankalar limiti bu değer üzerinden bloke ettiği
 * için borç toplamı hesabında ve `available` sütununda **bu** değer kullanılır.
 */
function creditCardDebtBalance(
  card: CreditCard,
  creditCardTransactions: CreditCardTransaction[],
  asOf?: string,
  rateContext: CardProjectionRateContext = {},
): string {
  return cardCommittedTotal(
    card,
    creditCardTransactions,
    asOf ? new Date(asOf) : new Date(),
    rateContext,
  ).committed
}

function cashAdvanceDebtTotal(
  acc: CashAdvanceAccount,
  cashAdvanceTransactions: CashAdvanceTransaction[],
  asOf: string,
  taxRateMonthly?: number,
): string {
  return cashAdvanceState(
    acc,
    cashAdvanceTransactions,
    asOf,
    taxRateMonthly,
  ).total
}

function advancePaymentsFor(
  adv: InstallmentCashAdvance,
  installmentAdvancePayments: InstallmentCashAdvancePayment[],
) {
  return installmentAdvancePayments.filter((p) => p.installmentAdvanceId === adv.id)
}

function advanceScheduleContext(
  adv: InstallmentCashAdvance,
  installmentAdvancePayments: InstallmentCashAdvancePayment[],
) {
  const schedule = buildScheduleForInstallmentAdvance(adv)
  const own = advancePaymentsFor(adv, installmentAdvancePayments)
  const idx = advancePaidThroughIndex(own)
  return { schedule, own, idx }
}

function remainingInstallmentAdvanceDebt(
  adv: InstallmentCashAdvance,
  installmentAdvancePayments: InstallmentCashAdvancePayment[],
  asOf: string,
): string {
  const { schedule, own, idx } = advanceScheduleContext(adv, installmentAdvancePayments)
  return remainingDebtForInstallmentAdvance(adv, schedule, idx, asOf, own)
}

function earlyPayoffForInstallmentAdvance(
  adv: InstallmentCashAdvance,
  installmentAdvancePayments: InstallmentCashAdvancePayment[],
  asOf: string,
): string {
  const { schedule, own, idx } = advanceScheduleContext(adv, installmentAdvancePayments)
  return payoffForInstallmentAdvance(adv, schedule, idx, asOf, own)
}

function installmentAdvanceOverdueCount(
  adv: InstallmentCashAdvance,
  installmentAdvancePayments: InstallmentCashAdvancePayment[],
  asOf: string,
): number {
  const { schedule, own, idx } = advanceScheduleContext(adv, installmentAdvancePayments)
  const today = new Date(asOf)
  let count = 0
  for (const row of schedule.rows) {
    if (row.index <= idx) continue
    if (new Date(row.dueDate).getTime() < today.getTime()) count++
  }
  return count
}

/** Banka başına toplam kalan borç (profil para birimi). */
export function debtTotalsByBankId(input: DebtSnapshotInput): Map<string, string> {
  const asOf = input.asOf ?? new Date().toISOString()
  const totals = new Map<string, ReturnType<typeof D>>()

  function add(bankId: string | undefined, amount: DecimalInput): void {
    if (!bankId) return
    totals.set(bankId, (totals.get(bankId) ?? D(0)).plus(amount))
  }

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    add(loan.bankId, remainingLoanDebt(loan, input.loanPayments, asOf))
  }

  for (const card of input.creditCards) {
    if (card.archived) continue
    if (card.currency !== input.localCurrency) continue
    add(card.bankId, creditCardDebtBalance(card, input.creditCardTransactions, asOf, input.creditCardRateContext))
  }

  for (const acc of input.cashAdvanceAccounts) {
    if (acc.archived) continue
    if (acc.currency !== input.localCurrency) continue
    add(
      acc.bankId,
      cashAdvanceDebtTotal(
        acc,
        input.cashAdvanceTransactions,
        asOf,
        input.cashAdvanceTaxRateMonthly,
      ),
    )
  }

  for (const adv of input.installmentAdvances) {
    if (adv.archived) continue
    if (adv.currency !== input.localCurrency) continue
    add(adv.bankId, remainingInstallmentAdvanceDebt(adv, input.installmentAdvancePayments, asOf))
  }

  const result = new Map<string, string>()
  for (const [bankId, sum] of totals) {
    result.set(bankId, roundMoney(sum).toString())
  }
  return result
}

/**
 * Tüm borç türleri için kalan bakiye toplayıcı. Her tip için uygun finans
 * motoru çağrılır (kredi/taksitli avans kalan borç, kart dönem sonu, KMH revolving ledger).
 */
export function debtSnapshot(input: DebtSnapshotInput): DebtSnapshot {
  const asOf = input.asOf ?? new Date().toISOString()

  let loansTotal = D(0)
  let cardsTotal = D(0)
  let caTotal = D(0)
  let iaTotal = D(0)
  let earlyPayoffTotal = D(0)
  let overdueCount = 0

  for (const loan of input.loans) {
    if (loan.archived) continue
    if (loan.currency !== input.localCurrency) continue
    loansTotal = loansTotal.plus(remainingLoanDebt(loan, input.loanPayments, asOf))
    earlyPayoffTotal = earlyPayoffTotal.plus(
      earlyPayoffForLoan(loan, input.loanPayments, asOf),
    )
    overdueCount += loanOverdueCount(loan, input.loanPayments, asOf)
  }

  for (const card of input.creditCards) {
    if (card.archived) continue
    if (card.currency !== input.localCurrency) continue
    const cardDebt = creditCardDebtBalance(
      card,
      input.creditCardTransactions,
      asOf,
      input.creditCardRateContext,
    )
    cardsTotal = cardsTotal.plus(cardDebt)
    earlyPayoffTotal = earlyPayoffTotal.plus(cardDebt)
  }

  for (const acc of input.cashAdvanceAccounts) {
    if (acc.archived) continue
    if (acc.currency !== input.localCurrency) continue
    const caDebt = cashAdvanceDebtTotal(
      acc,
      input.cashAdvanceTransactions,
      asOf,
      input.cashAdvanceTaxRateMonthly,
    )
    caTotal = caTotal.plus(caDebt)
    earlyPayoffTotal = earlyPayoffTotal.plus(caDebt)
  }

  for (const adv of input.installmentAdvances) {
    if (adv.archived) continue
    if (adv.currency !== input.localCurrency) continue
    iaTotal = iaTotal.plus(
      remainingInstallmentAdvanceDebt(adv, input.installmentAdvancePayments, asOf),
    )
    earlyPayoffTotal = earlyPayoffTotal.plus(
      earlyPayoffForInstallmentAdvance(adv, input.installmentAdvancePayments, asOf),
    )
    overdueCount += installmentAdvanceOverdueCount(
      adv,
      input.installmentAdvancePayments,
      asOf,
    )
  }

  const total = loansTotal.plus(cardsTotal).plus(caTotal).plus(iaTotal)

  return {
    total: roundMoney(total).toString(),
    earlyPayoffTotal: roundMoney(earlyPayoffTotal).toString(),
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
