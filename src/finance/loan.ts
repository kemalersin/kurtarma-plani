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
  /** Kullanım / sözleşme başlangıcı — ilk dönem kıst faizi için */
  startDate?: string
  /**
   * İlk dönem faiz katsayısı (0–1). Verilmezse `startDate` → ilk taksit gün sayısı / 30.
   */
  firstPeriodInterestFactor?: number
  /**
   * KKDF + BSMV toplam oranı — **faiz tutarı üzerinden** (örn. 0,15 + 0,15 = 0,30).
   */
  taxRateMonthly?: DecimalInput
}

export interface ScheduleRow {
  /** 1..termMonths */
  index: number
  dueDate: string
  /** Taksit tutarı (eşit) */
  installment: string
  /** Bu dönemin sözleşme faizi (vergi hariç) */
  interest: string
  /** KKDF + BSMV vb. (faiz üzerinden) */
  tax: string
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
  totalTax: string
  totalPayment: string
  effectiveMonthlyRate: string
  rows: ScheduleRow[]
}

const STANDARD_MONTH_DAYS = 30

/** Başlangıç → ilk taksit arası kıst faiz katsayısı (max 1, 30 gün = tam ay). */
export function firstPeriodInterestFactorFromDates(
  startDate: string | undefined,
  firstInstallmentDate: string,
): number {
  if (!startDate) return 1
  const days = differenceInCalendarDays(
    parseISO(firstInstallmentDate.slice(0, 10)),
    parseISO(startDate.slice(0, 10)),
  )
  if (days <= 0) return 1
  if (days >= STANDARD_MONTH_DAYS) return 1
  // Kullandırım günü faiz yürümez; kalan günler 30 günlük aya oranlanır.
  return Math.max(0, days - 1) / STANDARD_MONTH_DAYS
}

function resolveFirstPeriodFactor(input: LoanInput): Decimal {
  if (input.firstPeriodInterestFactor != null) {
    return D(input.firstPeriodInterestFactor)
  }
  return D(firstPeriodInterestFactorFromDates(input.startDate, input.firstInstallmentDate))
}

function endBalanceAfterPayments(
  principal: Decimal,
  termMonths: number,
  payment: Decimal,
  monthlyRate: Decimal,
  taxOnInterest: Decimal,
  firstPeriodFactor: Decimal,
): Decimal {
  let balance = principal
  for (let i = 1; i <= termMonths; i++) {
    const periodFactor = i === 1 ? firstPeriodFactor : D(1)
    const contractInterest = balance.times(monthlyRate).times(periodFactor)
    const taxAmount = contractInterest.times(taxOnInterest)
    balance = balance.minus(payment.minus(contractInterest).minus(taxAmount))
  }
  return balance
}

/** Eşit taksit tutarını ikili arama ile bulur (vergi faiz üzerinden + kıst ilk dönem). */
function solveEqualInstallment(
  principal: Decimal,
  termMonths: number,
  monthlyRate: Decimal,
  taxOnInterest: Decimal,
  firstPeriodFactor: Decimal,
): Decimal {
  if (monthlyRate.isZero() && taxOnInterest.isZero()) {
    return roundMoney(principal.div(termMonths))
  }

  const maxFinance = monthlyRate.times(firstPeriodFactor).times(D(1).plus(taxOnInterest))
  let lo = principal.div(termMonths)
  let hi = principal.div(termMonths).plus(principal.times(maxFinance))

  for (let iter = 0; iter < 80; iter++) {
    const mid = lo.plus(hi).div(2)
    const end = endBalanceAfterPayments(
      principal,
      termMonths,
      mid,
      monthlyRate,
      taxOnInterest,
      firstPeriodFactor,
    )
    if (end.gt(0)) {
      lo = mid
    } else {
      hi = mid
    }
  }

  return roundMoney(lo.plus(hi).div(2))
}

/**
 * Anüite (eşit taksitli) amortisman planı.
 *
 * Sözleşme faizi kalan anapara × aylık oran; KKDF/BSMV faiz tutarı üzerinden eklenir.
 * İlk dönemde başlangıç → ilk taksit gün sayısına göre kıst faiz uygulanır
 * (kullandırım günü hariç; 30 takvim günü = tam ay).
 */
export function buildAnnuitySchedule(input: LoanInput): LoanSchedule {
  const monthlyRate = toMonthly(input.interestRate)
  const taxOnInterest = input.taxRateMonthly ? D(input.taxRateMonthly) : ZERO
  const firstPeriodFactor = resolveFirstPeriodFactor(input)
  const effectiveMonthlyRate = monthlyRate.times(D(1).plus(taxOnInterest))

  const principal = D(input.principal)
  const n = input.termMonths
  if (n <= 0) {
    throw new Error('Vade sıfırdan büyük olmalı.')
  }

  const installmentR = solveEqualInstallment(
    principal,
    n,
    monthlyRate,
    taxOnInterest,
    firstPeriodFactor,
  )

  const rows: ScheduleRow[] = []
  let balance = principal
  let totalInterest = ZERO
  let totalTax = ZERO
  const firstDate = parseISO(input.firstInstallmentDate)

  for (let i = 1; i <= n; i++) {
    const periodFactor = i === 1 ? firstPeriodFactor : D(1)
    const contractInterest = balance.times(monthlyRate).times(periodFactor)
    const taxAmount = contractInterest.times(taxOnInterest)
    let principalPart = installmentR.minus(contractInterest).minus(taxAmount)
    let installmentForRow = installmentR
    let ending = balance.minus(principalPart)

    if (i === n) {
      principalPart = balance
      installmentForRow = roundMoney(principalPart.plus(contractInterest).plus(taxAmount))
      ending = ZERO
    }

    const dueDate = addMonths(firstDate, i - 1)
    rows.push({
      index: i,
      dueDate: dueDate.toISOString(),
      installment: roundMoney(installmentForRow).toString(),
      interest: roundMoney(contractInterest).toString(),
      tax: roundMoney(taxAmount).toString(),
      principal: roundMoney(principalPart).toString(),
      beginningBalance: roundMoney(balance).toString(),
      endingBalance: roundMoney(ending).toString(),
    })

    totalInterest = totalInterest.plus(contractInterest)
    totalTax = totalTax.plus(taxAmount)
    balance = ending
  }

  const totalPayment = rows.reduce((acc, row) => acc.plus(D(row.installment)), ZERO)

  return {
    installment: roundMoney(installmentR).toString(),
    totalInterest: roundMoney(totalInterest).toString(),
    totalTax: roundMoney(totalTax).toString(),
    totalPayment: roundMoney(totalPayment).toString(),
    effectiveMonthlyRate: effectiveMonthlyRate.toString(),
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
  /** Sözleşme başlangıcı — ilk dönem erken kapama faiz tahakkuku için */
  startDate?: string
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
  accrualStartDate?: string,
  /** disbursement: kullandırım günü sayılmaz; installmentDue: son ödeme vadesi dahil */
  accrualStartKind?: 'disbursement' | 'installmentDue',
): Decimal {
  const asOf = parseISO(asOfDate.slice(0, 10))
  const nextDue = parseISO(nextDueDate.slice(0, 10))
  const daysToNext = differenceInCalendarDays(nextDue, asOf)
  const daily = toDailyFromMonthly(dailyMonthly)

  const daysAccruedFromStart = accrualStartDate
    ? (() => {
        const raw = differenceInCalendarDays(
          asOf,
          parseISO(accrualStartDate.slice(0, 10)),
        )
        if (accrualStartKind === 'disbursement') return Math.max(0, raw - 1)
        if (accrualStartKind === 'installmentDue') return Math.max(0, raw + 1)
        return Math.max(0, raw)
      })()
    : daysToNext > 0 && daysToNext < STANDARD_MONTH_DAYS
      ? STANDARD_MONTH_DAYS - daysToNext
      : 0

  if (daysToNext > 0 && daysAccruedFromStart > 0) {
    return lastPaidEnd
      .times(daily)
      .times(Math.min(daysAccruedFromStart, STANDARD_MONTH_DAYS))
  }
  if (daysToNext <= 0) {
    const daysOverdue = lateDays(nextDueDate, asOfDate)
    if (daysOverdue > 0) {
      return lastPaidEnd.times(daily).times(daysOverdue)
    }
    if (daysAccruedFromStart > 0) {
      return lastPaidEnd
        .times(daily)
        .times(Math.min(daysAccruedFromStart, STANDARD_MONTH_DAYS))
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
  const accrualStartDate =
    paidThroughIndex > 0
      ? schedule.rows[paidThroughIndex - 1]!.dueDate
      : params.startDate
  const accrualStartKind =
    paidThroughIndex > 0
      ? ('installmentDue' as const)
      : params.startDate
        ? ('disbursement' as const)
        : undefined
  const partialInterest = accruedPayoffInterest(
    lastPaidEnd,
    nextRow.dueDate,
    asOfDate,
    D(schedule.effectiveMonthlyRate),
    accrualStartDate,
    accrualStartKind,
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
