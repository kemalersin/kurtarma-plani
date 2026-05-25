export const RecurrenceIntervals = ['daily', 'weekly', 'monthly', 'yearly'] as const
export type RecurrenceInterval = (typeof RecurrenceIntervals)[number]

export const RECURRENCE_LABELS: Record<RecurrenceInterval, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  yearly: 'Yıllık',
}
