import { AI_CONTEXT_FILE_TYPE } from '@/core/constants'

export type AiContextExportFormat = 'json' | 'markdown'

export interface MoneyField {
  value: string
  formatted: string
  currency: string
}

export interface DateField {
  iso: string
  formatted: string
}

export interface ScheduleInstallmentRow {
  index: number
  dueDate: DateField
  installment: MoneyField
  principal: MoneyField
  interest: MoneyField
  beginningBalance: MoneyField
  endingBalance: MoneyField
  status: 'paid' | 'unpaid' | 'overdue'
  paidDate?: DateField
  paidAmount?: MoneyField
}

export interface RemainingDebtBreakdownExport {
  /** Ödenmemiş plan taksit tutarları toplamı */
  unpaidInstallments: MoneyField
  /** Vadesi geçmiş taksitlerde bugüne kadar biriken gecikme faizi */
  accruedLateFees: MoneyField
}

export interface LoanScheduleExport {
  loanId: string
  label: string
  bankName?: string
  currency: string
  paidThroughIndex: number
  remainingDebt: MoneyField
  remainingDebtBreakdown: RemainingDebtBreakdownExport
  earlyPayoff: MoneyField
  /** Vadesi geçmiş ödenmemiş taksit adedi */
  overdueInstallmentCount: number
  /** Geç ödenmiş taksit adedi (tarihsel) */
  historicalLatePaymentCount: number
  installments: ScheduleInstallmentRow[]
}

export interface InstallmentAdvanceScheduleExport {
  advanceId: string
  label: string
  bankName?: string
  currency: string
  paidThroughIndex: number
  remainingDebt: MoneyField
  remainingDebtBreakdown: RemainingDebtBreakdownExport
  earlyPayoff: MoneyField
  overdueInstallmentCount: number
  historicalLatePaymentCount: number
  installments: ScheduleInstallmentRow[]
}

export interface AiContextDocument {
  meta: {
    type: typeof AI_CONTEXT_FILE_TYPE
    contextVersion: number
    generatedAt: string
    appVersion: string
    purpose: string
    instructionsForModel: string
    disclaimer: string
    locale: {
      locale: string
      currency: string
      timeZone: string
      dateFormat: string
    }
    profileName: string
    exportOptions: { includeSensitive: boolean }
  }
  glossary: Record<string, string>
  summary: {
    asOf: string
    asOfFormatted: string
    netWorth: MoneyField
    totalAssets: MoneyField
    totalDebts: MoneyField
    debtByType: {
      loans: MoneyField
      creditCards: MoneyField
      cashAdvances: MoneyField
      installmentAdvances: MoneyField
    }
    cashflowAttention: {
      overdueIncomes: number
      dueIncomes: number
      overdueExpenses: number
      dueExpenses: number
    }
    delinquency: {
      /** Tüm kredi + taksitli avanslarda vadesi geçmiş ödenmemiş taksit sayısı */
      totalOverdueInstallments: number
      /** Geç ödenmiş taksit sayısı (tarihsel, ödenmiş kayıtlar) */
      totalHistoricalLatePayments: number
    }
  }
  references: {
    banks: Array<{ id: string; name: string }>
    incomeTypes: Array<{ id: string; name: string }>
    expenseTypes: Array<{ id: string; name: string }>
  }
  sections: {
    accounts: Array<Record<string, unknown>>
    cashRegisters: Array<Record<string, unknown>>
    loans: Array<Record<string, unknown>>
    creditCards: Array<Record<string, unknown>>
    cashAdvanceAccounts: Array<Record<string, unknown>>
    installmentAdvances: Array<Record<string, unknown>>
    incomes: Array<Record<string, unknown>>
    expenses: Array<Record<string, unknown>>
    transfers: Array<Record<string, unknown>>
  }
  schedules: {
    loans: LoanScheduleExport[]
    installmentAdvances: InstallmentAdvanceScheduleExport[]
  }
  omitted: {
    archivedRecordCount: number
    sensitiveRecordCount: number
    excludedTypes: string[]
    note: string
  }
}
