import {
  AI_CONTEXT_FILE_TYPE,
  AI_CONTEXT_VERSION,
  APP_VERSION,
} from '@/core/constants'
import type { EntityType } from '@/core/db/profile-db'
import type { ProfileMeta } from '@/core/types/profile'
import type {
  Account,
  Bank,
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
  Transfer,
} from '@/core/types/entities'
import {
  assetSnapshot,
  debtSnapshot,
  netWorth,
} from '@/features/analytics/snapshot'
import { collectMovements } from '@/features/cashflow/movements'
import {
  accountBalance,
  cashRegisterBalance,
} from '@/features/cashflow/balanceHelpers'
import { cardCommittedTotal, creditCardOpeningDate } from '@/features/debts/cardHelpers'
import { D } from '@/finance/decimal'
import { runRevolvingLedger } from '@/finance/cash-advance'
import { revolvingRatesFromAccount } from '@/features/debts/cashAdvanceHelpers'
import { cashflowStatus } from '@/finance/cashflow'
import type { AiSnapshotSourceRow } from '@/features/ai/snapshot'
import { stripSecretFields } from '@/features/ai/snapshot'
import {
  AI_CONTEXT_DISCLAIMER,
  AI_CONTEXT_GLOSSARY,
  AI_CONTEXT_INSTRUCTIONS_JSON,
  AI_CONTEXT_PURPOSE,
  accountTypeLabel,
  cashflowStatusLabel,
} from '@/core/services/ai-context-export/labels-tr'
import {
  createAiContextFormatters,
  dateField,
  moneyField,
} from '@/core/services/ai-context-export/format-helpers'
import { buildCreditCardPeriodSchedules } from '@/core/services/ai-context-export/credit-card-period-schedules'
import { buildCashAdvancePeriodSchedules } from '@/core/services/ai-context-export/cash-advance-period-schedules'
import {
  buildInstallmentAdvanceSchedules,
  buildLoanSchedules,
} from '@/core/services/ai-context-export/loan-schedules'
import {
  computeSettledDebtIndex,
  filterSettledDebtInput,
} from '@/core/services/ai-context-export/settled-debts'
import type {
  AiContextDocument,
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
} from '@/core/services/ai-context-export/types'

const EXCLUDED_TYPES: ReadonlySet<EntityType> = new Set([
  'aiSettings',
  'aiUsage',
  'chatSession',
])

import type { CardProjectionRateContext } from '@/features/debts/cardHelpers'
import { creditCardRateContextFromPreset, creditCardTaxRateFromPreset } from '@/core/util/banking-preset-credit-card'
import type { BankingPreset } from '@/core/types/banking-preset'

export interface BuildAiContextDocumentParams {
  profile: ProfileMeta
  rows: AiSnapshotSourceRow[]
  includeSensitive: boolean
  /** Kart faiz projeksiyonu için preset kademeleri; verilmezse sabit kart oranları kullanılır. */
  creditCardRateContext?: CardProjectionRateContext
  bankingPreset?: BankingPreset
}

function isArchived(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'archived' in data &&
      (data as { archived?: boolean }).archived,
  )
}

function filterExportRows(
  rows: AiSnapshotSourceRow[],
  includeSensitive: boolean,
): { included: AiSnapshotSourceRow[]; archivedCount: number; sensitiveCount: number } {
  let archivedCount = 0
  let sensitiveCount = 0
  const included: AiSnapshotSourceRow[] = []

  for (const row of rows) {
    if (EXCLUDED_TYPES.has(row.type)) continue
    if (isArchived(row.data)) {
      archivedCount++
      continue
    }
    if (row.sensitive && !includeSensitive) {
      sensitiveCount++
      continue
    }
    included.push({
      ...row,
      data: stripSecretFields(row.data),
    })
  }

  return { included, archivedCount, sensitiveCount }
}

function groupByType<T>(rows: AiSnapshotSourceRow[], type: EntityType): T[] {
  return rows
    .filter((r) => r.type === type)
    .map((r) => r.data as T)
}

function resolveEndpoint(
  accountId: string | undefined,
  cashRegisterId: string | undefined,
  accounts: Map<string, Account>,
  registers: Map<string, CashRegister>,
  banks: Map<string, Bank>,
): string {
  if (accountId) {
    const acc = accounts.get(accountId)
    if (!acc) return `Hesap (${accountId})`
    const bank = acc.bankId ? banks.get(acc.bankId) : undefined
    return bank ? `${acc.name} · ${bank.name}` : acc.name
  }
  if (cashRegisterId) {
    const reg = registers.get(cashRegisterId)
    return reg?.name ?? `Kasa (${cashRegisterId})`
  }
  return '—'
}

export function buildAiContextDocument(params: BuildAiContextDocumentParams): AiContextDocument {
  const { profile, rows, includeSensitive } = params
  const creditCardRateContext =
    params.creditCardRateContext ??
    (params.bankingPreset ? creditCardRateContextFromPreset(params.bankingPreset) : undefined)
  const cashAdvanceTaxRateMonthly = params.bankingPreset
    ? creditCardTaxRateFromPreset(params.bankingPreset)
    : undefined
  const fmt = createAiContextFormatters(profile.localeSettings)
  const currency = profile.localeSettings.currency
  const asOf = new Date().toISOString()

  const { included, archivedCount, sensitiveCount } = filterExportRows(rows, includeSensitive)

  const banks = groupByType<Bank>(included, 'bank')
  const accounts = groupByType<Account>(included, 'account')
  const registers = groupByType<CashRegister>(included, 'cashRegister')
  let loans = groupByType<Loan>(included, 'loan')
  let loanPayments = groupByType<LoanPayment>(included, 'loanPayment')
  let creditCards = groupByType<CreditCard>(included, 'creditCard')
  let creditCardTxns = groupByType<CreditCardTransaction>(included, 'creditCardTransaction')
  let cashAdvanceAccounts = groupByType<CashAdvanceAccount>(included, 'cashAdvanceAccount')
  let cashAdvanceTxns = groupByType<CashAdvanceTransaction>(included, 'cashAdvanceTransaction')
  let installmentAdvances = groupByType<InstallmentCashAdvance>(included, 'installmentCashAdvance')
  let installmentPayments = groupByType<InstallmentCashAdvancePayment>(
    included,
    'installmentCashAdvancePayment',
  )

  const settled = computeSettledDebtIndex(
    {
      loans,
      loanPayments,
      installmentAdvances,
      installmentAdvancePayments: installmentPayments,
      creditCards,
      creditCardTransactions: creditCardTxns,
      cashAdvanceAccounts,
      cashAdvanceTransactions: cashAdvanceTxns,
    },
    {
      asOf,
      creditCardRateContext,
      cashAdvanceTaxRateMonthly,
    },
  )
  const settledDebtCount =
    settled.loanIds.size +
    settled.installmentAdvanceIds.size +
    settled.creditCardIds.size +
    settled.cashAdvanceAccountIds.size

  ;({
    loans,
    loanPayments,
    installmentAdvances,
    installmentAdvancePayments: installmentPayments,
    creditCards,
    creditCardTransactions: creditCardTxns,
    cashAdvanceAccounts,
    cashAdvanceTransactions: cashAdvanceTxns,
  } = filterSettledDebtInput(
    {
      loans,
      loanPayments,
      installmentAdvances,
      installmentAdvancePayments: installmentPayments,
      creditCards,
      creditCardTransactions: creditCardTxns,
      cashAdvanceAccounts,
      cashAdvanceTransactions: cashAdvanceTxns,
    },
    settled,
  ))

  const incomes = groupByType<Income>(included, 'income')
  const incomeTypes = groupByType<IncomeType>(included, 'incomeType')
  const expenses = groupByType<Expense>(included, 'expense')
  const expenseTypes = groupByType<ExpenseType>(included, 'expenseType')
  const transfers = groupByType<Transfer>(included, 'transfer')

  const bankMap = new Map(banks.map((b) => [b.id, b]))
  const accountMap = new Map(accounts.map((a) => [a.id, a]))
  const registerMap = new Map(registers.map((r) => [r.id, r]))
  const incomeTypeMap = new Map(incomeTypes.map((t) => [t.id, t]))
  const expenseTypeMap = new Map(expenseTypes.map((t) => [t.id, t]))

  const movements = collectMovements({
    incomes,
    expenses,
    transfers,
    loanPayments,
    creditCardTransactions: creditCardTxns,
    cashAdvanceTransactions: cashAdvanceTxns,
    installmentAdvancePayments: installmentPayments,
  })

  const assets = assetSnapshot(accounts, registers, movements, currency, asOf)
  const debts = debtSnapshot({
    loans,
    loanPayments,
    creditCards,
    creditCardTransactions: creditCardTxns,
    cashAdvanceAccounts,
    cashAdvanceTransactions: cashAdvanceTxns,
    installmentAdvances,
    installmentAdvancePayments: installmentPayments,
    localCurrency: currency,
    asOf,
    cashAdvanceTaxRateMonthly,
  })
  const worth = netWorth(assets.total, debts.total)

  let overdueIncomes = 0
  let dueIncomes = 0
  let overdueExpenses = 0
  let dueExpenses = 0
  for (const inc of incomes) {
    const s = cashflowStatus(inc, new Date(asOf))
    if (s === 'overdue') overdueIncomes++
    else if (s === 'due') dueIncomes++
  }
  for (const exp of expenses) {
    const s = cashflowStatus(exp, new Date(asOf))
    if (s === 'overdue') overdueExpenses++
    else if (s === 'due') dueExpenses++
  }

  const loanSchedules: LoanScheduleExport[] = buildLoanSchedules({
    loans,
    loanPayments,
    bankMap,
    fmt,
    asOf,
  })

  const advanceSchedules: InstallmentAdvanceScheduleExport[] = buildInstallmentAdvanceSchedules({
    installmentAdvances,
    installmentPayments,
    bankMap,
    fmt,
    asOf,
  })

  const creditCardPeriodSchedules = buildCreditCardPeriodSchedules({
    creditCards,
    creditCardTxns,
    bankMap,
    fmt,
    asOf,
    creditCardRateContext,
  })

  const cashAdvancePeriodSchedules = buildCashAdvancePeriodSchedules({
    accounts: cashAdvanceAccounts,
    txns: cashAdvanceTxns,
    bankMap,
    fmt,
    asOf,
    taxRateMonthly: cashAdvanceTaxRateMonthly,
  })

  const totalOverdueInstallments =
    loanSchedules.reduce((n, s) => n + s.overdueInstallmentCount, 0) +
    advanceSchedules.reduce((n, s) => n + s.overdueInstallmentCount, 0)
  const totalHistoricalLatePayments =
    loanSchedules.reduce((n, s) => n + s.historicalLatePaymentCount, 0) +
    advanceSchedules.reduce((n, s) => n + s.historicalLatePaymentCount, 0)

  return {
    meta: {
      type: AI_CONTEXT_FILE_TYPE,
      contextVersion: AI_CONTEXT_VERSION,
      generatedAt: asOf,
      appVersion: APP_VERSION,
      purpose: AI_CONTEXT_PURPOSE,
      instructionsForModel: AI_CONTEXT_INSTRUCTIONS_JSON,
      disclaimer: AI_CONTEXT_DISCLAIMER,
      locale: { ...profile.localeSettings },
      profileName: profile.name,
      exportOptions: { includeSensitive },
    },
    glossary: { ...AI_CONTEXT_GLOSSARY },
    summary: {
      asOf,
      asOfFormatted: fmt.formatDate(asOf),
      netWorth: moneyField(worth.net, currency, fmt),
      totalAssets: moneyField(assets.total, currency, fmt),
      totalDebts: moneyField(debts.total, currency, fmt),
      debtByType: {
        loans: moneyField(debts.byType.loans, currency, fmt),
        creditCards: moneyField(debts.byType.creditCards, currency, fmt),
        cashAdvances: moneyField(debts.byType.cashAdvances, currency, fmt),
        installmentAdvances: moneyField(debts.byType.installmentAdvances, currency, fmt),
      },
      cashflowAttention: {
        overdueIncomes,
        dueIncomes,
        overdueExpenses,
        dueExpenses,
      },
      delinquency: {
        totalOverdueInstallments,
        totalHistoricalLatePayments,
      },
    },
    references: {
      banks: banks.map((b) => ({ id: b.id, name: b.name })),
      incomeTypes: incomeTypes.map((t) => ({ id: t.id, name: t.name })),
      expenseTypes: expenseTypes.map((t) => ({ id: t.id, name: t.name })),
    },
    sections: {
      accounts: accounts.map((a) => {
        const bank = a.bankId ? bankMap.get(a.bankId) : undefined
        const balance = accountBalance(a, movements, asOf)
        return {
          id: a.id,
          name: a.name,
          label: bank ? `${a.name} · ${bank.name}` : a.name,
          bankName: bank?.name,
          type: a.type,
          typeLabel: accountTypeLabel(a.type),
          currency: a.currency,
          balance: moneyField(balance, a.currency, fmt),
          openingBalance: moneyField(a.openingBalance, a.currency, fmt),
          openingDate: dateField(a.openingDate, fmt),
        }
      }),
      cashRegisters: registers.map((r) => {
        const balance = cashRegisterBalance(r, movements, asOf)
        return {
          id: r.id,
          name: r.name,
          label: r.name,
          currency: r.currency,
          balance: moneyField(balance, r.currency, fmt),
          openingBalance: moneyField(r.openingBalance, r.currency, fmt),
          openingDate: dateField(r.openingDate, fmt),
        }
      }),
      loans: loans.map((loan) => {
        const bank = loan.bankId ? bankMap.get(loan.bankId) : undefined
        const sched = loanSchedules.find((s) => s.loanId === loan.id)
        return {
          id: loan.id,
          name: loan.name,
          label: bank ? `${loan.name} · ${bank.name}` : loan.name,
          bankName: bank?.name,
          principal: moneyField(loan.principal, loan.currency, fmt),
          termMonths: loan.termMonths,
          interestRate: loan.interestRate,
          interestPeriod: loan.interestPeriod,
          firstInstallmentDate: dateField(loan.firstInstallmentDate, fmt),
          remainingDebt: sched?.remainingDebt,
          earlyPayoff: sched?.earlyPayoff,
        }
      }),
      creditCards: creditCards.map((card) => {
        const bank = card.bankId ? bankMap.get(card.bankId) : undefined
        const txns = creditCardTxns.filter((t) => t.cardId === card.id)
        const committed = cardCommittedTotal(card, txns, new Date(asOf), creditCardRateContext ?? {})
        const periodSched = creditCardPeriodSchedules.find((s) => s.cardId === card.id)
        const latestPeriod = periodSched?.periods[periodSched.periods.length - 1]
        const available = D(card.limit).minus(D(committed.committed))
        const availableCredit = available.lt(0) ? D(0) : available
        const totalCommitted = committed.committed
        return {
          id: card.id,
          name: card.name,
          label: bank ? `${card.name} · ${bank.name}` : card.name,
          bankName: bank?.name,
          limit: moneyField(card.limit, card.currency, fmt),
          openingBalance: moneyField(card.openingBalance ?? 0, card.currency, fmt),
          openingDate: dateField(creditCardOpeningDate(card), fmt),
          balance: moneyField(totalCommitted, card.currency, fmt),
          accruedBalance: moneyField(committed.ending, card.currency, fmt),
          futureInstallments: moneyField(committed.future, card.currency, fmt),
          totalCommitted: moneyField(totalCommitted, card.currency, fmt),
          availableCredit: moneyField(availableCredit.toString(), card.currency, fmt),
          currentPeriodEndingBalance:
            latestPeriod?.endingBalance ??
            moneyField(0, card.currency, fmt),
          minPayment:
            latestPeriod?.minPayment ?? moneyField(0, card.currency, fmt),
        }
      }),
      cashAdvanceAccounts: cashAdvanceAccounts.map((acc) => {
        const bank = acc.bankId ? bankMap.get(acc.bankId) : undefined
        const txns = cashAdvanceTxns.filter((t) => t.accountId === acc.id)
        const ledger = runRevolvingLedger({
          openingBalance: acc.openingBalance ?? 0,
          openingDate: acc.openingDate,
          transactions: txns.map((t) => ({
            date: t.date,
            amount: t.amount,
            type: t.type,
          })),
          rates: revolvingRatesFromAccount(acc, cashAdvanceTaxRateMonthly),
          asOf,
        })
        const periodSched = cashAdvancePeriodSchedules.find((s) => s.accountId === acc.id)
        const latestPeriod = periodSched?.periods[periodSched.periods.length - 1]
        const available = D(acc.limit).minus(D(ledger.principal))
        const availableCredit = available.lt(0) ? D(0) : available
        return {
          id: acc.id,
          name: acc.name,
          label: bank ? `${acc.name} · ${bank.name}` : acc.name,
          bankName: bank?.name,
          limit: moneyField(acc.limit, acc.currency, fmt),
          principal: moneyField(ledger.principal, acc.currency, fmt),
          totalDebt: moneyField(ledger.total, acc.currency, fmt),
          accruedInterest: moneyField(ledger.accruedInterest, acc.currency, fmt),
          contractualInterest: moneyField(ledger.contractualInterest, acc.currency, fmt),
          lateInterest: moneyField(ledger.lateInterest, acc.currency, fmt),
          minPayment: moneyField(ledger.minPayment, acc.currency, fmt),
          minPaymentRate: ledger.minPaymentRate,
          availableCredit: moneyField(availableCredit.toString(), acc.currency, fmt),
          currentPeriodEndingBalance:
            latestPeriod?.endingBalance ??
            moneyField(0, acc.currency, fmt),
          interestRate: acc.interestRate,
          interestPeriod: acc.interestPeriod,
          taxRateMonthly: acc.taxRateMonthly,
        }
      }),
      installmentAdvances: installmentAdvances.map((adv) => {
        const bank = adv.bankId ? bankMap.get(adv.bankId) : undefined
        const sched = advanceSchedules.find((s) => s.advanceId === adv.id)
        return {
          id: adv.id,
          name: adv.name,
          label: bank ? `${adv.name} · ${bank.name}` : adv.name,
          bankName: bank?.name,
          principal: moneyField(adv.principal, adv.currency, fmt),
          termMonths: adv.termMonths,
          remainingDebt: sched?.remainingDebt,
          earlyPayoff: sched?.earlyPayoff,
        }
      }),
      creditCardTransactions: [],
      cashAdvanceTransactions: cashAdvanceTxns.map((t) => {
        const acc = cashAdvanceAccounts.find((a) => a.id === t.accountId)
        const bank = acc?.bankId ? bankMap.get(acc.bankId) : undefined
        const cur = acc?.currency ?? currency
        return {
          id: t.id,
          accountId: t.accountId,
          accountName: acc?.name,
          bankName: bank?.name,
          date: dateField(t.date, fmt),
          type: t.type,
          amount: moneyField(t.amount, cur, fmt),
          description: t.description,
        }
      }),
      incomes: incomes.map((inc) => {
        const type = inc.incomeTypeId ? incomeTypeMap.get(inc.incomeTypeId) : undefined
        const status = cashflowStatus(inc, new Date(asOf))
        return {
          id: inc.id,
          description: inc.description,
          typeName: type?.name,
          target: resolveEndpoint(
            inc.accountId,
            inc.cashRegisterId,
            accountMap,
            registerMap,
            bankMap,
          ),
          amount: moneyField(inc.amount, inc.currency, fmt),
          plannedDate: dateField(inc.plannedDate, fmt),
          actualDate: inc.actualDate ? dateField(inc.actualDate, fmt) : undefined,
          status,
          statusLabel: cashflowStatusLabel(status),
          recurrence: inc.recurrence,
        }
      }),
      expenses: expenses.map((exp) => {
        const type = exp.expenseTypeId ? expenseTypeMap.get(exp.expenseTypeId) : undefined
        const status = cashflowStatus(exp, new Date(asOf))
        return {
          id: exp.id,
          description: exp.description,
          typeName: type?.name,
          source: resolveEndpoint(
            exp.accountId,
            exp.cashRegisterId,
            accountMap,
            registerMap,
            bankMap,
          ),
          amount: moneyField(exp.amount, exp.currency, fmt),
          plannedDate: dateField(exp.plannedDate, fmt),
          actualDate: exp.actualDate ? dateField(exp.actualDate, fmt) : undefined,
          status,
          statusLabel: cashflowStatusLabel(status),
          recurrence: exp.recurrence,
        }
      }),
      transfers: transfers.map((tr) => ({
        id: tr.id,
        description: tr.description,
        from: resolveEndpoint(
          tr.fromAccountId,
          tr.fromCashRegisterId,
          accountMap,
          registerMap,
          bankMap,
        ),
        to: resolveEndpoint(
          tr.toAccountId,
          tr.toCashRegisterId,
          accountMap,
          registerMap,
          bankMap,
        ),
        amount: moneyField(tr.amount, tr.currency, fmt),
        targetAmount:
          tr.targetAmount != null ?
            moneyField(tr.targetAmount, tr.currency, fmt)
          : undefined,
        date: dateField(tr.date, fmt),
      })),
    },
    schedules: {
      loans: loanSchedules,
      installmentAdvances: advanceSchedules,
      creditCards: [],
      creditCardPeriods: creditCardPeriodSchedules,
      cashAdvancePeriods: cashAdvancePeriodSchedules,
    },
    omitted: {
      archivedRecordCount: archivedCount,
      sensitiveRecordCount: sensitiveCount,
      settledDebtCount,
      excludedTypes: [...EXCLUDED_TYPES],
      note:
        'Arşivlenmiş kayıtlar varsayılan olarak dahil edilmez. Kalan borcu sıfır olan borçlar (kredi, taksitli avans, sıfır bakiyeli kart/nakit avans) dahil edilmez. Hassas işaretli kayıtlar yalnızca kullanıcı onayıyla eklenir. AI ayarları ve sohbet geçmişi hiçbir zaman dahil edilmez.',
    },
  }
}
