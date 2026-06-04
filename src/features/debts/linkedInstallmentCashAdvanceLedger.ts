import type {
  CashAdvanceAccount,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import {
  advancePaidThroughIndex,
  buildScheduleForInstallmentAdvance,
  remainingDebtForInstallmentAdvance,
} from './installmentAdvanceHelpers'

/**
 * Nakit avans hesabına bağlı taksitli avansların limit bağlamı.
 *
 * Bağlı kullanımlar revolving anapara/faiz hesabına girmez; yalnızca
 * kullanılabilir limiti düşürür (plandaki kalan borç toplamı).
 */
export interface CashAdvanceLedgerContext {
  installmentAdvances: readonly InstallmentCashAdvance[]
  installmentAdvancePayments: readonly InstallmentCashAdvancePayment[]
}

/** Taksitli avans, bir nakit avans hesabına bağlı mı? */
export function isInstallmentAdvanceLinkedToCashAdvance(
  advance: Pick<InstallmentCashAdvance, 'cashAdvanceAccountId'>,
): boolean {
  return !!advance.cashAdvanceAccountId
}

function linkedAdvancesForAccount(
  account: CashAdvanceAccount,
  advances: readonly InstallmentCashAdvance[],
): InstallmentCashAdvance[] {
  return advances.filter(
    (a) => a.cashAdvanceAccountId === account.id && !a.archived,
  )
}

/**
 * Bağlı taksitli avansların limit üzerindeki net kullanımı.
 *
 * Her avans için plandaki kalan borç (ödenmemiş taksitler + gecikme faizi)
 * limiti bloke eder.
 */
export function linkedInstallmentLimitUsage(
  account: CashAdvanceAccount,
  advances: readonly InstallmentCashAdvance[],
  payments: readonly InstallmentCashAdvancePayment[],
  asOf?: string,
): number {
  const linked = linkedAdvancesForAccount(account, advances)
  if (linked.length === 0) return 0

  const asOfIso = asOf ?? new Date().toISOString()
  const asOfKey = asOfIso.slice(0, 10)
  let total = 0

  for (const adv of linked) {
    if (adv.startDate.slice(0, 10) > asOfKey) continue
    const schedule = buildScheduleForInstallmentAdvance(adv)
    const own = payments.filter(
      (p) =>
        p.installmentAdvanceId === adv.id &&
        p.paidDate != null &&
        p.paidDate.slice(0, 10) <= asOfKey,
    )
    const paidIdx = advancePaidThroughIndex(own)
    total += Number(
      remainingDebtForInstallmentAdvance(adv, schedule, paidIdx, asOfIso, own),
    )
  }

  return total
}
