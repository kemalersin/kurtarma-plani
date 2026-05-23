import { addMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import { D, roundMoney, ZERO, type DecimalInput } from '@/finance/decimal'
import { toDailyFromMonthly, toMonthly, type RateInput } from '@/finance/rates'
import type Decimal from 'decimal.js'

export interface LoanInput {
  /** Anapara */
  principal: DecimalInput
  /** Vade (ay) */
  termMonths: number
  /** Sözleşme faizi */
  interestRate: RateInput
  /** Gecikme faizi (opsiyonel; verilmezse sözleşme faizinin 1.3 katı varsayılır) */
  lateInterestRate?: RateInput
  /** İlk taksit tarihi (ISO). Genellikle başlangıç + 1 ay */
  firstInstallmentDate: string
  /** Aylık vergi/giderler (KKDF + BSMV vb.) — toplam oran, faize eklenir */
  taxRateMonthly?: DecimalInput
}

export interface ScheduleRow {
  /** 1..termMonths */
  index: number
  dueDate: string
  /** Taksit tutarı (eşit) */
  installment: string
  /** Bu dönemin faizi (vergi dahil) */
  interest: string
  /** Bu dönemin anapara payı */
  principal: string
  /** Ödenmeden önce dönem başı kalan */
  beginningBalance: string
  /** Ödendikten sonra kalan */
  endingBalance: string
}

export interface LoanSchedule {
  installment: string
  totalInterest: string
  totalPayment: string
  effectiveMonthlyRate: string
  rows: ScheduleRow[]
}

/**
 * Anüite (eşit taksitli) amortisman planı.
 *
 * A = P * (i * (1+i)^n) / ((1+i)^n - 1)
 *
 * `taxRateMonthly` verilirse efektif aylık oran `i + tax` olarak alınır
 * (KKDF/BSMV gibi sabit oranlı vergileri faize gömmek için basit yöntem).
 */
export function buildAnnuitySchedule(input: LoanInput): LoanSchedule {
  const baseMonthly = toMonthly(input.interestRate)
  const taxMonthly = input.taxRateMonthly ? D(input.taxRateMonthly) : ZERO
  const effective = baseMonthly.times(D(1).plus(taxMonthly))

  const principal = D(input.principal)
  const n = input.termMonths
  if (n <= 0) {
    throw new Error('Vade sıfırdan büyük olmalı.')
  }

  let installment: Decimal
  if (effective.isZero()) {
    installment = principal.div(n)
  } else {
    const onePlusI = D(1).plus(effective)
    const pow = onePlusI.pow(n)
    installment = principal.times(effective).times(pow).div(pow.minus(1))
  }

  const installmentR = roundMoney(installment)
  const rows: ScheduleRow[] = []
  let balance = principal
  let totalInterest = ZERO
  const firstDate = parseISO(input.firstInstallmentDate)

  for (let i = 1; i <= n; i++) {
    const interest = balance.times(effective)
    let principalPart = installmentR.minus(interest)
    let installmentForRow = installmentR
    let ending = balance.minus(principalPart)

    // Son taksitte yuvarlama farkını kapat
    if (i === n) {
      principalPart = balance
      installmentForRow = roundMoney(principalPart.plus(interest))
      ending = ZERO
    }

    const dueDate = addMonths(firstDate, i - 1)
    rows.push({
      index: i,
      dueDate: dueDate.toISOString(),
      installment: roundMoney(installmentForRow).toString(),
      interest: roundMoney(interest).toString(),
      principal: roundMoney(principalPart).toString(),
      beginningBalance: roundMoney(balance).toString(),
      endingBalance: roundMoney(ending).toString(),
    })

    totalInterest = totalInterest.plus(interest)
    balance = ending
  }

  const totalPayment = rows.reduce((acc, row) => acc.plus(D(row.installment)), ZERO)

  return {
    installment: roundMoney(installmentR).toString(),
    totalInterest: roundMoney(totalInterest).toString(),
    totalPayment: roundMoney(totalPayment).toString(),
    effectiveMonthlyRate: effective.toString(),
    rows,
  }
}

export interface PaymentSummary {
  /** Plana göre toplam taksit (ödenmiş + ödenmemiş) */
  scheduledTotal: string
  /** Plana göre ödenmiş tutar (gecikme faizi hariç) */
  paidTotal: string
  /** Gecikmeden dolayı ödenen ek faiz */
  paidLateFee: string
  /** Plana göre kalan anapara (henüz vadesi gelmemiş + gecikmiş ödenmemiş) */
  remainingPrincipal: string
  /** Bugüne göre gecikmiş taksit sayısı */
  overdueCount: number
}

export interface InstallmentPayment {
  index: number
  /** Ödenmiş tutar (faiz/anapara ayrımı yapmadan; varsa gecikme faizi dahil) */
  paid: DecimalInput
  paidDate: string
}

/**
 * Tek bir taksit için gecikme günlerini hesaplar (negatifse 0).
 */
export function lateDays(dueDate: string, paidDate: string): number {
  const due = parseISO(dueDate)
  const paid = parseISO(paidDate)
  return Math.max(0, differenceInCalendarDays(paid, due))
}

/**
 * Gecikme faizi (basit, günlük). `lateInterestRate` yoksa sözleşmenin 1.3 katı.
 */
export function computeLateFee(
  scheduledInstallment: DecimalInput,
  daysLate: number,
  contractRate: RateInput,
  lateRate?: RateInput,
): string {
  if (daysLate <= 0) return '0'
  const monthlyContract = toMonthly(contractRate)
  const monthlyLate = lateRate ? toMonthly(lateRate) : monthlyContract.times('1.3')
  const daily = toDailyFromMonthly(monthlyLate)
  const fee = D(scheduledInstallment).times(daily).times(daysLate)
  return roundMoney(fee).toString()
}

export interface RemainingDebtParams {
  schedule: LoanSchedule
  /** Hangi taksit numarasına kadar ödenmiş (0 ise hiç ödenmemiş) */
  paidThroughIndex: number
  /** Bugün (ISO) */
  asOfDate: string
  contractRate: RateInput
  lateRate?: RateInput
  /** Ödenmemiş taksitler için kullanıcı override (index → tutar) */
  installmentOverrides?: ReadonlyMap<number, number>
}

/** Plan taksiti veya override tutarı. */
export function effectiveInstallmentForRow(
  row: ScheduleRow,
  overrides?: ReadonlyMap<number, number>,
): string {
  const override = overrides?.get(row.index)
  return override != null ? String(override) : row.installment
}

function accruedPayoffInterest(
  lastPaidEnd: Decimal,
  nextDueDate: string,
  asOfDate: string,
  dailyMonthly: Decimal,
): Decimal {
  const daysToNext = differenceInCalendarDays(parseISO(nextDueDate), parseISO(asOfDate))
  const daily = toDailyFromMonthly(dailyMonthly)

  if (daysToNext > 0 && daysToNext < 30) {
    return lastPaidEnd.times(daily).times(30 - daysToNext)
  }
  if (daysToNext <= 0) {
    const daysOverdue = lateDays(nextDueDate, asOfDate)
    if (daysOverdue > 0) {
      return lastPaidEnd.times(daily).times(daysOverdue)
    }
  }
  return ZERO
}

/**
 * Kalan borcu vadeden önce kapatma tutarı.
 *
 * Türk tüketici kredisi mevzuatına göre erken kapama tahsil edilebilecek
 * yapılandırma ücreti vardır; biz burada **saf finansal** tahmini döneriz:
 * kalan anapara + kısmi dönem faizi + biriken gecikme faizi (vadesi geçmiş taksitler).
 *
 * UI tarafında kullanıcı sözleşmesine göre erken kapama komisyonu eklenebilir.
 */
export function payoffAmount(params: RemainingDebtParams): string {
  const { schedule, paidThroughIndex, asOfDate, contractRate, lateRate } = params
  const remaining = schedule.rows.filter((r) => r.index > paidThroughIndex)
  if (remaining.length === 0) return '0'

  const lastPaidEnd =
    paidThroughIndex > 0
      ? D(schedule.rows[paidThroughIndex - 1]!.endingBalance)
      : D(schedule.rows[0]!.beginningBalance)

  const nextRow = remaining[0]!
  const partialInterest = accruedPayoffInterest(
    lastPaidEnd,
    nextRow.dueDate,
    asOfDate,
    D(schedule.effectiveMonthlyRate),
  )

  const lateFees = outstandingLateFeesTotal({
    schedule,
    paidThroughIndex,
    asOfDate,
    contractRate,
    lateRate,
    installmentOverrides: params.installmentOverrides,
  })

  return roundMoney(lastPaidEnd.plus(partialInterest).plus(lateFees)).toString()
}

/** Ödenmemiş ve vadesi geçmiş taksitler için bugüne kadar biriken gecikme faizi. */
export function outstandingLateFeesTotal(params: RemainingDebtParams): string {
  const { schedule, paidThroughIndex, asOfDate, contractRate, lateRate, installmentOverrides } =
    params
  let total = ZERO
  for (const row of schedule.rows) {
    if (row.index <= paidThroughIndex) continue
    const days = lateDays(row.dueDate, asOfDate)
    if (days <= 0) continue
    const installment = effectiveInstallmentForRow(row, installmentOverrides)
    total = total.plus(computeLateFee(installment, days, contractRate, lateRate))
  }
  return roundMoney(total).toString()
}

/** Kalan borç = ödenmemiş taksit tutarları + biriken gecikme faizi. */
export function remainingDebtTotal(params: RemainingDebtParams): string {
  const installments = remainingInstallmentsTotal(
    params.schedule,
    params.paidThroughIndex,
    params.installmentOverrides,
  )
  const lateFees = outstandingLateFeesTotal(params)
  return roundMoney(D(installments).plus(lateFees)).toString()
}

/** Plana göre kalan anapara bakiyesi (son ödenen taksit sonrası). */
export function remainingPrincipalBalance(
  schedule: LoanSchedule,
  paidThroughIndex: number,
): string {
  if (paidThroughIndex >= schedule.rows.length) return '0'
  if (paidThroughIndex === 0) return schedule.rows[0]!.beginningBalance
  return schedule.rows[paidThroughIndex - 1]!.endingBalance
}

/** Ödenmemiş taksitlerin tutarları toplamı (override dahil). */
export function remainingInstallmentsTotal(
  schedule: LoanSchedule,
  paidThroughIndex: number,
  installmentOverrides?: ReadonlyMap<number, number>,
): string {
  const total = schedule.rows
    .filter((r) => r.index > paidThroughIndex)
    .reduce(
      (acc, row) => acc.plus(D(effectiveInstallmentForRow(row, installmentOverrides))),
      ZERO,
    )
  return roundMoney(total).toString()
}
