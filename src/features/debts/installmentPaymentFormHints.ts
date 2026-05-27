import type { KpStat } from '@/components/KpStatRow.vue'
import { lateDays } from '@/finance/loan'
import { canMarkInstallmentAsPaid } from './installmentDisplay'

export function installmentPaymentSourceTooltip(profileCurrency: string): string {
  return `Boş bırakılırsa cashflow bakiyesinden düşülmez. Yalnız profil para biriminde (${profileCurrency}) tanımlı hesap ve kasalar listelenir. Dövizli hesap/kasalar borç ödemesi için kullanılamaz.`
}

const PLAN_INSTALLMENT_TOOLTIP = 'Sözleşmeye göre hesaplanan plan taksit tutarı.'

const LATE_DAYS_TOOLTIP =
  'Ödeme tarihi vadeden sonraysa gecikme günü sayılır; gecikme faizi buna göre hesaplanır.'

const LATE_FEE_TOOLTIP =
  'Gecikme faizi plan taksiti ve sözleşme gecikme oranına göre hesaplanır.'

const TOTAL_DUE_TOOLTIP =
  'Plan taksiti + gecikme faizi toplamı; ödenen tutar için önerilir.'

export function installmentPaymentDateHint(
  nextPaymentDateFormatted: string | undefined,
): string | undefined {
  if (!nextPaymentDateFormatted) return undefined
  return `Sonraki ödeme ${nextPaymentDateFormatted} — bu tarihe kadar ileri alınabilir.`
}

/** Önceki taksit ödenmeden ödeme işaretlenemez; kapatılması gereken taksit numarası. */
export function priorInstallmentIndexRequired(
  installmentIndex: number,
  paidThroughIndex: number,
  hasExistingPaidDate: boolean,
): number | undefined {
  if (hasExistingPaidDate) return undefined
  if (canMarkInstallmentAsPaid(installmentIndex, paidThroughIndex)) return undefined
  return paidThroughIndex + 1
}

export function priorInstallmentPaymentBlockedMessage(priorInstallmentIndex: number): string {
  return `Önceki dönem borcu kapanmadı. Ödendi olarak işaretlemek için önce ${priorInstallmentIndex}. taksiti kapatın.`
}

/**
 * Taksit ödemesi drawer gecikme günü — ödeme tarihi yoksa vade → bugün (veya `asOf`).
 * Önceki taksit kapatılmamış olsa bile vadesi geçmiş satırın gecikmesi görünür.
 */
export function installmentPaymentLateDaysCount(
  dueDate: string,
  paidDateIso?: string,
  asOfIso = new Date().toISOString(),
): number {
  const ref = paidDateIso ?? asOfIso
  return Math.max(0, lateDays(dueDate, ref))
}

export function installmentAmountHint(params: {
  markAsPaid: boolean
  hasLaterPayments: boolean
  hasLateFee: boolean
}): string | undefined {
  if (params.hasLaterPayments) {
    return 'Sonraki taksit ödemeleri olduğu için tutar plan taksitine eşitlenir.'
  }
  if (params.markAsPaid && params.hasLateFee) {
    return 'Önerilen tutar plan taksiti + gecikme faizi; banka ekstrenizdeki tutarla farklı olabilir.'
  }
  if (!params.markAsPaid) {
    return 'Vade gelmeden plan taksit tutarını özelleştirebilirsiniz.'
  }
  return undefined
}

interface PaymentStatParams {
  dueDateLabel: string
  planInstallmentLabel: string
  markAsPaid: boolean
  lateDaysCount: number
  lateFeeLabel: string
  totalDueLabel: string
}

/** Taksit ödemesi drawer üst özeti — gecikme varsa faiz/toplam satırları. */
export function buildInstallmentPaymentStats(params: PaymentStatParams): KpStat[] {
  const items: KpStat[] = [
    { label: 'Vade', value: params.dueDateLabel },
    {
      label: 'Plan taksit',
      value: params.planInstallmentLabel,
      tone: 'primary',
      labelTooltip: PLAN_INSTALLMENT_TOOLTIP,
    },
  ]

  if (params.markAsPaid && params.lateDaysCount > 0) {
    items.push(
      {
        label: 'Gecikme faizi',
        value: params.lateFeeLabel,
        tone: 'danger',
        labelTooltip: LATE_FEE_TOOLTIP,
      },
      {
        label: 'Önerilen toplam',
        value: params.totalDueLabel,
        tone: 'warning',
        labelTooltip: TOTAL_DUE_TOOLTIP,
      },
    )
  } else {
    items.push({
      label: 'Gecikme',
      value: `${params.lateDaysCount} gün`,
      tone: params.lateDaysCount > 0 ? 'danger' : 'default',
      labelTooltip: LATE_DAYS_TOOLTIP,
    })
  }

  return items
}
