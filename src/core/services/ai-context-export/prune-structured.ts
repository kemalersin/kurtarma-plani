import type { AiContextDocument } from '@/core/services/ai-context-export/types'
import {
  trimCashAdvancePeriodSchedulesForAi,
  trimCreditCardInstallmentSchedulesForAi,
  trimCreditCardPeriodSchedulesForAi,
  trimInstallmentAdvanceSchedulesForAi,
  trimLoanSchedulesForAi,
  trimPeriodRowsForAi,
} from '@/core/services/ai-context-export/schedule-prune'

/** JSON / Markdown dışa aktarımda geçmiş ödenmiş / geçmiş ay satırlarını çıkarır. */
export function prunePaidInstallments(doc: AiContextDocument): AiContextDocument {
  const asOf = doc.summary.asOf
  return {
    ...doc,
    schedules: {
      loans: trimLoanSchedulesForAi(
        doc.schedules.loans.map((s) => ({
          ...s,
          installments: s.installments.filter((row) => row.status !== 'paid'),
        })),
        asOf,
      ),
      installmentAdvances: trimInstallmentAdvanceSchedulesForAi(
        doc.schedules.installmentAdvances.map((s) => ({
          ...s,
          installments: s.installments.filter((row) => row.status !== 'paid'),
        })),
        asOf,
      ),
      creditCards: trimCreditCardInstallmentSchedulesForAi(doc.schedules.creditCards),
      creditCardPeriods: trimCreditCardPeriodSchedulesForAi(doc.schedules.creditCardPeriods, asOf),
      cashAdvancePeriods: trimCashAdvancePeriodSchedulesForAi(doc.schedules.cashAdvancePeriods),
    },
  }
}

export {
  trimCashAdvancePeriodSchedulesForAi,
  trimCreditCardInstallmentSchedulesForAi,
  trimCreditCardPeriodRowsForAi,
  trimCreditCardPeriodSchedulesForAi,
  trimInstallmentAdvanceSchedulesForAi,
  trimLoanInstallmentRowsForAi,
  trimLoanSchedulesForAi,
  trimPeriodRowsForAi,
} from '@/core/services/ai-context-export/schedule-prune'
