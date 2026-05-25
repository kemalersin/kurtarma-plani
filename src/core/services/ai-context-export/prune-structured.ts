import type { AiContextDocument } from '@/core/services/ai-context-export/types'

/** JSON dışa aktarımda ödenmiş taksit satırlarını çıkarır. */
export function prunePaidInstallments(doc: AiContextDocument): AiContextDocument {
  return {
    ...doc,
    schedules: {
      loans: doc.schedules.loans.map((s) => ({
        ...s,
        installments: s.installments.filter((row) => row.status !== 'paid'),
      })),
      installmentAdvances: doc.schedules.installmentAdvances.map((s) => ({
        ...s,
        installments: s.installments.filter((row) => row.status !== 'paid'),
      })),
    },
  }
}
