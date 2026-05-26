import type {
  CashAdvancePeriodScheduleExport,
  CreditCardInstallmentScheduleExport,
  CreditCardPeriodRowExport,
  CreditCardPeriodScheduleExport,
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
  ScheduleInstallmentRow,
} from '@/core/services/ai-context-export/types'

type PeriodStatus = 'paid' | 'overdue' | 'upcoming'

/** Ödenmiş dönem satırlarını çıkarır (geçmiş ay şişmesini önler). */
export function trimPeriodRowsForAi<T extends { status: PeriodStatus }>(periods: T[]): T[] {
  return periods.filter((p) => p.status !== 'paid')
}

/**
 * Kredi / taksitli avans: güncel ay ve sonrası ödenmemiş taksit satırları.
 * Geçmiş ay vadeleri bağlamda yer almaz — kalan borç üst özette kalır.
 */
export function trimLoanInstallmentRowsForAi(
  installments: ScheduleInstallmentRow[],
  asOf: string,
): ScheduleInstallmentRow[] {
  const asOfMonth = asOf.slice(0, 7)
  return installments.filter((row) => {
    if (row.status === 'paid') return false
    return row.dueDate.iso.slice(0, 7) >= asOfMonth
  })
}

export function trimLoanSchedulesForAi(
  schedules: LoanScheduleExport[],
  asOf: string,
): LoanScheduleExport[] {
  return schedules
    .map((s) => ({
      ...s,
      installments: trimLoanInstallmentRowsForAi(s.installments, asOf),
    }))
    .filter((s) => s.installments.length > 0)
}

export function trimInstallmentAdvanceSchedulesForAi(
  schedules: InstallmentAdvanceScheduleExport[],
  asOf: string,
): InstallmentAdvanceScheduleExport[] {
  return schedules
    .map((s) => ({
      ...s,
      installments: trimLoanInstallmentRowsForAi(s.installments, asOf),
    }))
    .filter((s) => s.installments.length > 0)
}

/**
 * Kart dönem vadeleri: güncel ay ve sonrası ödenmemiş satırlar.
 * Geçmiş ay vadeleri bağlamda yer almaz — kalan borç üst özette kalır.
 */
export function trimCreditCardPeriodRowsForAi(
  periods: CreditCardPeriodRowExport[],
  asOf: string,
): CreditCardPeriodRowExport[] {
  const asOfMonth = asOf.slice(0, 7)
  return periods.filter((row) => {
    if (row.status === 'paid') return false
    return row.dueDate.iso.slice(0, 7) >= asOfMonth
  })
}

export function trimCreditCardPeriodSchedulesForAi(
  schedules: CreditCardPeriodScheduleExport[],
  asOf: string,
): CreditCardPeriodScheduleExport[] {
  return schedules
    .map((s) => ({ ...s, periods: trimCreditCardPeriodRowsForAi(s.periods, asOf) }))
    .filter((s) => s.periods.length > 0)
}

export function trimCashAdvancePeriodSchedulesForAi(
  schedules: CashAdvancePeriodScheduleExport[],
): CashAdvancePeriodScheduleExport[] {
  return schedules
    .map((s) => ({ ...s, periods: trimPeriodRowsForAi(s.periods) }))
    .filter((s) => s.periods.length > 0)
}

/** Tahakkuk etmiş taksit satırlarını çıkarır; yalnızca gelecek taksitler kalır. */
export function trimCreditCardInstallmentSchedulesForAi(
  schedules: CreditCardInstallmentScheduleExport[],
): CreditCardInstallmentScheduleExport[] {
  return schedules
    .map((s) => ({
      ...s,
      installments: s.installments.filter((i) => i.status === 'future'),
    }))
    .filter((s) => s.installments.length > 0)
}
