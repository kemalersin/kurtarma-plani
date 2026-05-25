import type { ScheduleRow, LoanSchedule } from '@/finance/loan'

export interface EarlyPayoffPaymentDraft {
  id?: string
  installmentIndex: number
  dueDate: string
  scheduledAmount: number
  paidDate: string
  paidAmount: number
  sourceAccountId?: string
  sourceCashRegisterId?: string
  notes?: string
}

interface BuildEarlyPayoffParams {
  schedule: LoanSchedule
  paidThroughIndex: number
  paymentMap: Map<number, { id?: string }>
  paidDate: string
  paidAmount: number
  sourceAccountId?: string
  sourceCashRegisterId?: string
  notes?: string
}

/** Kalan taksitleri erken kapama ile ödendi olarak işaretlemek için kayıt taslakları. */
export function buildEarlyPayoffPayments(
  params: BuildEarlyPayoffParams,
): EarlyPayoffPaymentDraft[] {
  const remaining = params.schedule.rows.filter((r) => r.index > params.paidThroughIndex)
  if (remaining.length === 0) return []

  const note = params.notes?.trim()
  const primaryNote = note || 'Erken kapama'
  const tailNote = note ? `${note} (kapatıldı)` : 'Erken kapama — kapatıldı'

  return remaining.map((row: ScheduleRow, index) => {
    const existing = params.paymentMap.get(row.index)
    const isFirst = index === 0
    return {
      id: existing?.id,
      installmentIndex: row.index,
      dueDate: row.dueDate,
      scheduledAmount: Number(row.installment),
      paidDate: params.paidDate,
      paidAmount: isFirst ? params.paidAmount : 0,
      sourceAccountId: isFirst ? params.sourceAccountId : undefined,
      sourceCashRegisterId: isFirst ? params.sourceCashRegisterId : undefined,
      notes: isFirst ? primaryNote : tailNote,
    }
  })
}
