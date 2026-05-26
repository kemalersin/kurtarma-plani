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
import {
  buildScheduleForInstallmentAdvance,
  advancePaidThroughIndex,
  payoffForInstallmentAdvance,
} from '@/features/debts/installmentAdvanceHelpers'
import { displayInstallmentAmount } from '@/features/debts/installmentDisplay'
import {
  buildScheduleForLoan,
  paidThroughIndex,
  payoffForLoan,
} from '@/features/debts/loanHelpers'
import {
  accruedInstallmentCount,
  cardCommittedTotal,
  expandInstallments,
} from '@/features/debts/cardHelpers'
import { resolveCreditCardRepaymentTotal } from '@/finance/credit-card'
import { D } from '@/finance/decimal'
import { runRevolvingLedger } from '@/finance/cash-advance'
import { cashflowStatus } from '@/finance/cashflow'
import type { AiSnapshotSourceRow } from '@/features/ai/snapshot'
import { stripSecretFields } from '@/features/ai/snapshot'
import type { LoanSchedule, ScheduleRow } from '@/finance/loan'
import { computeScheduleDelinquencyMetrics } from '@/core/services/ai-context-export/schedule-metrics'
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
  type AiContextFormatters,
} from '@/core/services/ai-context-export/format-helpers'
import { buildCreditCardPeriodSchedules } from '@/core/services/ai-context-export/credit-card-period-schedules'
import type {
  AiContextDocument,
  CreditCardInstallmentScheduleExport,
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
  ScheduleInstallmentRow,
} from '@/core/services/ai-context-export/types'

const EXCLUDED_TYPES: ReadonlySet<EntityType> = new Set([
  'aiSettings',
  'aiUsage',
  'chatSession',
])

export interface BuildAiContextDocumentParams {
  profile: ProfileMeta
  rows: AiSnapshotSourceRow[]
  includeSensitive: boolean
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

function loanRateInput(loan: Loan) {
  return {
    contractRate: { value: loan.interestRate, period: loan.interestPeriod },
    lateRate:
      loan.lateInterestRate !== undefined && loan.lateInterestPeriod
        ? { value: loan.lateInterestRate, period: loan.lateInterestPeriod }
        : undefined,
  }
}

function advanceRateInput(advance: InstallmentCashAdvance) {
  return {
    contractRate: { value: advance.interestRate, period: advance.interestPeriod },
    lateRate:
      advance.lateInterestRate !== undefined && advance.lateInterestPeriod
        ? { value: advance.lateInterestRate, period: advance.lateInterestPeriod }
        : undefined,
  }
}

function buildScheduleExportFields(
  schedule: LoanSchedule,
  paidIdx: number,
  ownPayments: Array<{
    installmentIndex: number
    paidDate?: string
    paidAmount?: number
    scheduledAmount?: number
  }>,
  currency: string,
  fmt: AiContextFormatters,
  asOf: string,
  rates: ReturnType<typeof loanRateInput>,
) {
  const payMap = new Map(ownPayments.map((p) => [p.installmentIndex, p]))
  const metrics = computeScheduleDelinquencyMetrics(
    schedule,
    paidIdx,
    asOf,
    rates.contractRate,
    rates.lateRate,
    ownPayments,
  )
  return {
    paidThroughIndex: paidIdx,
    remainingDebt: moneyField(metrics.remainingDebt, currency, fmt),
    remainingDebtBreakdown: {
      unpaidInstallments: moneyField(
        metrics.breakdown.unpaidInstallments,
        currency,
        fmt,
      ),
      accruedLateFees: moneyField(metrics.breakdown.accruedLateFees, currency, fmt),
    },
    overdueInstallmentCount: metrics.overdueInstallmentCount,
    historicalLatePaymentCount: metrics.historicalLatePaymentCount,
    installments: buildScheduleRows(schedule.rows, paidIdx, payMap, currency, fmt, asOf),
  }
}

function installmentStatus(
  row: ScheduleRow,
  paidIdx: number,
  asOf: string,
): 'paid' | 'unpaid' | 'overdue' {
  if (row.index <= paidIdx) return 'paid'
  if (new Date(row.dueDate).getTime() < new Date(asOf).getTime()) return 'overdue'
  return 'unpaid'
}

function buildScheduleRows(
  scheduleRows: ScheduleRow[],
  paidIdx: number,
  paymentMap: Map<number, { paidDate?: string; paidAmount?: number; scheduledAmount?: number }>,
  currency: string,
  fmt: AiContextFormatters,
  asOf: string,
): ScheduleInstallmentRow[] {
  return scheduleRows.map((row) => {
    const payment = paymentMap.get(row.index)
    const amount = displayInstallmentAmount(row.installment, payment)
    const status = installmentStatus(row, paidIdx, asOf)
    const base: ScheduleInstallmentRow = {
      index: row.index,
      dueDate: dateField(row.dueDate, fmt),
      installment: moneyField(amount, currency, fmt),
      principal: moneyField(row.principal, currency, fmt),
      interest: moneyField(row.interest, currency, fmt),
      beginningBalance: moneyField(row.beginningBalance, currency, fmt),
      endingBalance: moneyField(row.endingBalance, currency, fmt),
      status,
    }
    if (payment?.paidDate) {
      base.paidDate = dateField(payment.paidDate, fmt)
      if (payment.paidAmount != null) {
        base.paidAmount = moneyField(payment.paidAmount, currency, fmt)
      }
    }
    return base
  })
}

function buildCreditCardInstallmentSchedules(
  creditCards: CreditCard[],
  creditCardTxns: CreditCardTransaction[],
  bankMap: Map<string, Bank>,
  fmt: AiContextFormatters,
  asOf: string,
): CreditCardInstallmentScheduleExport[] {
  const asOfDate = new Date(asOf)
  const asOfIso = asOf
  const out: CreditCardInstallmentScheduleExport[] = []

  for (const card of creditCards) {
    const bank = card.bankId ? bankMap.get(card.bankId) : undefined
    const own = creditCardTxns.filter((t) => t.cardId === card.id)
    for (const t of own) {
      if (t.type === 'payment') continue
      if (!t.installmentCount || t.installmentCount <= 1) continue
      const virtual = expandInstallments(card, [t]).filter((v) => v.installmentIndex != null)
      const repaymentTotal = resolveCreditCardRepaymentTotal(t, card)
      out.push({
        cardId: card.id,
        transactionId: t.id,
        label: t.description ? `${card.name} — ${t.description}` : card.name,
        bankName: bank?.name,
        currency: card.currency,
        originalDate: dateField(t.date, fmt),
        transactionAmount: moneyField(t.amount, card.currency, fmt),
        repaymentTotal: moneyField(repaymentTotal, card.currency, fmt),
        installmentCount: t.installmentCount,
        accruedThroughIndex: accruedInstallmentCount(t.date, t.installmentCount, asOfDate),
        installments: virtual.map((v) => ({
          index: v.installmentIndex!,
          accrualDate: dateField(v.date, fmt),
          amount: moneyField(v.amount, card.currency, fmt),
          status: v.date <= asOfIso ? 'accrued' : 'future',
        })),
      })
    }
  }

  return out
}

export function buildAiContextDocument(params: BuildAiContextDocumentParams): AiContextDocument {
  const { profile, rows, includeSensitive } = params
  const fmt = createAiContextFormatters(profile.localeSettings)
  const currency = profile.localeSettings.currency
  const asOf = new Date().toISOString()

  const { included, archivedCount, sensitiveCount } = filterExportRows(rows, includeSensitive)

  const banks = groupByType<Bank>(included, 'bank')
  const accounts = groupByType<Account>(included, 'account')
  const registers = groupByType<CashRegister>(included, 'cashRegister')
  const loans = groupByType<Loan>(included, 'loan')
  const loanPayments = groupByType<LoanPayment>(included, 'loanPayment')
  const creditCards = groupByType<CreditCard>(included, 'creditCard')
  const creditCardTxns = groupByType<CreditCardTransaction>(included, 'creditCardTransaction')
  const cashAdvanceAccounts = groupByType<CashAdvanceAccount>(included, 'cashAdvanceAccount')
  const cashAdvanceTxns = groupByType<CashAdvanceTransaction>(included, 'cashAdvanceTransaction')
  const installmentAdvances = groupByType<InstallmentCashAdvance>(included, 'installmentCashAdvance')
  const installmentPayments = groupByType<InstallmentCashAdvancePayment>(
    included,
    'installmentCashAdvancePayment',
  )
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

  const loanSchedules: LoanScheduleExport[] = loans.map((loan) => {
    const schedule = buildScheduleForLoan(loan)
    const ownPayments = loanPayments.filter((p) => p.loanId === loan.id)
    const paidIdx = paidThroughIndex(ownPayments)
    const bank = loan.bankId ? bankMap.get(loan.bankId) : undefined
    const payoff = payoffForLoan(loan, schedule, paidIdx, asOf, ownPayments)
    const rates = loanRateInput(loan)
    return {
      loanId: loan.id,
      label: loan.name,
      bankName: bank?.name,
      currency: loan.currency,
      earlyPayoff: moneyField(payoff, loan.currency, fmt),
      ...buildScheduleExportFields(schedule, paidIdx, ownPayments, loan.currency, fmt, asOf, rates),
    }
  })

  const advanceSchedules: InstallmentAdvanceScheduleExport[] = installmentAdvances.map(
    (adv) => {
      const schedule = buildScheduleForInstallmentAdvance(adv)
      const ownPayments = installmentPayments.filter((p) => p.installmentAdvanceId === adv.id)
      const paidIdx = advancePaidThroughIndex(ownPayments)
      const bank = adv.bankId ? bankMap.get(adv.bankId) : undefined
      const payoff = payoffForInstallmentAdvance(adv, schedule, paidIdx, asOf, ownPayments)
      const rates = advanceRateInput(adv)
      return {
        advanceId: adv.id,
        label: adv.name,
        bankName: bank?.name,
        currency: adv.currency,
        earlyPayoff: moneyField(payoff, adv.currency, fmt),
        ...buildScheduleExportFields(schedule, paidIdx, ownPayments, adv.currency, fmt, asOf, rates),
      }
    },
  )

  const creditCardPeriodSchedules = buildCreditCardPeriodSchedules({
    creditCards,
    creditCardTxns,
    bankMap,
    fmt,
    asOf,
  })

  const creditCardInstallmentSchedules = buildCreditCardInstallmentSchedules(
    creditCards,
    creditCardTxns,
    bankMap,
    fmt,
    asOf,
  )

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
        const committed = cardCommittedTotal(card, txns, new Date(asOf))
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
          apr: { value: acc.interestRate, period: acc.interestPeriod },
          asOf,
        })
        return {
          id: acc.id,
          name: acc.name,
          label: bank ? `${acc.name} · ${bank.name}` : acc.name,
          bankName: bank?.name,
          limit: moneyField(acc.limit, acc.currency, fmt),
          totalDebt: moneyField(ledger.total, acc.currency, fmt),
          accruedInterest: moneyField(ledger.accruedInterest, acc.currency, fmt),
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
      creditCardTransactions: creditCardTxns.map((t) => {
        const card = creditCards.find((c) => c.id === t.cardId)
        const bank = card?.bankId ? bankMap.get(card.bankId) : undefined
        const cur = card?.currency ?? currency
        const row: Record<string, unknown> = {
          id: t.id,
          cardId: t.cardId,
          cardName: card?.name,
          bankName: bank?.name,
          date: dateField(t.date, fmt),
          type: t.type,
          amount: moneyField(t.amount, cur, fmt),
          description: t.description,
        }
        if (t.installmentCount != null && t.installmentCount > 1) {
          row.installmentCount = t.installmentCount
          if (card) {
            row.repaymentTotal = moneyField(
              resolveCreditCardRepaymentTotal(t, card),
              cur,
              fmt,
            )
          } else if (t.repaymentTotal != null) {
            row.repaymentTotal = moneyField(t.repaymentTotal, cur, fmt)
          }
        } else if (t.repaymentTotal != null) {
          row.repaymentTotal = moneyField(t.repaymentTotal, cur, fmt)
        }
        return row
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
      creditCards: creditCardInstallmentSchedules,
      creditCardPeriods: creditCardPeriodSchedules,
    },
    omitted: {
      archivedRecordCount: archivedCount,
      sensitiveRecordCount: sensitiveCount,
      excludedTypes: [...EXCLUDED_TYPES],
      note:
        'Arşivlenmiş kayıtlar varsayılan olarak dahil edilmez. Hassas işaretli kayıtlar yalnızca kullanıcı onayıyla eklenir. AI ayarları ve sohbet geçmişi hiçbir zaman dahil edilmez.',
    },
  }
}
