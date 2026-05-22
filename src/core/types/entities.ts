import { z } from 'zod'

const Iso = z.string().min(1)

export const BankSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  shortName: z.string().optional(),
  bicSwift: z.string().optional(),
  branchCode: z.string().optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type Bank = z.infer<typeof BankSchema>

export const AccountTypes = ['checking', 'savings', 'fx', 'other'] as const
export type AccountType = (typeof AccountTypes)[number]

export const AccountSchema = z.object({
  id: z.string(),
  bankId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(AccountTypes),
  /** ISO 4217; profil para biriminden farklı olabilir */
  currency: z.string().length(3),
  iban: z.string().optional(),
  openingBalance: z.number().default(0),
  openingDate: Iso,
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type Account = z.infer<typeof AccountSchema>

export const CashRegisterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  currency: z.string().length(3),
  openingBalance: z.number().default(0),
  openingDate: Iso,
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type CashRegister = z.infer<typeof CashRegisterSchema>

export const IncomeTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  /** Hex ya da AntDV token; opsiyonel */
  color: z.string().optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type IncomeType = z.infer<typeof IncomeTypeSchema>

export const RatePeriods = ['monthly', 'annual'] as const
export type RatePeriodEnum = (typeof RatePeriods)[number]

export const LoanSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  bankId: z.string().min(1),
  /** Anaparayı yatıran hesap (opsiyonel — bilgi amaçlı) */
  disbursementAccountId: z.string().optional(),
  currency: z.string().length(3),
  principal: z.number().positive(),
  termMonths: z.number().int().positive(),
  startDate: Iso,
  firstInstallmentDate: Iso,
  interestRate: z.number().min(0),
  interestPeriod: z.enum(RatePeriods),
  lateInterestRate: z.number().min(0).optional(),
  lateInterestPeriod: z.enum(RatePeriods).optional(),
  /** Aylık KKDF + BSMV gibi vergi toplamı; faize gömülür */
  taxRateMonthly: z.number().min(0).optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type Loan = z.infer<typeof LoanSchema>

/**
 * Bir kredi taksitinin ödeme durumu.
 * Taksit planı türetilebilir (Loan'dan), ama kullanıcı ödeme işaretledikçe
 * bu kayıtlar profil DB'sinde tutulur.
 */
export const LoanPaymentSchema = z.object({
  id: z.string(),
  loanId: z.string().min(1),
  /** 1..termMonths */
  installmentIndex: z.number().int().positive(),
  /** Plan vade tarihi (ISO) */
  dueDate: Iso,
  /** Plan üzerindeki tutar (snapshot) */
  scheduledAmount: z.number(),
  /** Gerçek ödeme tarihi (varsa) */
  paidDate: Iso.optional(),
  /** Gerçek ödenen tutar (varsa); gecikme faizi dahil */
  paidAmount: z.number().optional(),
  /** Hesaplanan gecikme faizi (snapshot) */
  lateFee: z.number().optional(),
  /** Ödemenin yapıldığı banka hesabı (cashflow bakiyesinden düşülür) */
  sourceAccountId: z.string().optional(),
  /** Ödemenin yapıldığı kasa */
  sourceCashRegisterId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type LoanPayment = z.infer<typeof LoanPaymentSchema>

// =============================================================================
// Kredi kartı
// =============================================================================

export const CreditCardSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  bankId: z.string().min(1),
  currency: z.string().length(3),
  limit: z.number().positive(),
  /** Önceki dönemden devreden bakiye (kuruluşta) */
  openingBalance: z.number().default(0),
  /** Hesap kesim günü 1–28 */
  statementCutoffDay: z.number().int().min(1).max(28),
  /** Son ödeme günü 1–28 */
  paymentDueDay: z.number().int().min(1).max(28),
  /** Alışveriş aylık akdi faizi (örn. 0.0375) */
  purchaseAprMonthly: z.number().min(0),
  /** Gecikme aylık faizi (varsayılan: alışveriş × 1.087) */
  lateAprMonthly: z.number().min(0).optional(),
  /** Nakit avans aylık faizi */
  cashAdvanceAprMonthly: z.number().min(0).optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type CreditCard = z.infer<typeof CreditCardSchema>

export const CreditCardTxnTypes = ['purchase', 'payment', 'cashAdvance'] as const
export type CreditCardTxnType = (typeof CreditCardTxnTypes)[number]

export const CreditCardTransactionSchema = z.object({
  id: z.string(),
  cardId: z.string().min(1),
  date: Iso,
  type: z.enum(CreditCardTxnTypes),
  amount: z.number().positive(),
  description: z.string().optional(),
  /** Taksitli alışveriş için toplam taksit sayısı (opsiyonel) */
  installmentCount: z.number().int().positive().optional(),
  /**
   * `payment` türünde — ödemenin yapıldığı banka hesabı / kasa
   * (cashflow bakiyesinden düşülür).
   */
  sourceAccountId: z.string().optional(),
  sourceCashRegisterId: z.string().optional(),
  /**
   * `cashAdvance` türünde — nakitin yatırıldığı banka hesabı / kasa
   * (cashflow bakiyesine eklenir; eş zamanlı olarak kart borcu artar).
   */
  targetAccountId: z.string().optional(),
  targetCashRegisterId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type CreditCardTransaction = z.infer<typeof CreditCardTransactionSchema>

// =============================================================================
// Nakit avans hesabı (revolving)
// =============================================================================

export const CashAdvanceAccountSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  bankId: z.string().min(1),
  currency: z.string().length(3),
  limit: z.number().positive(),
  openingBalance: z.number().default(0),
  openingDate: Iso,
  /** Aylık akdi faiz */
  interestRate: z.number().min(0),
  interestPeriod: z.enum(RatePeriods),
  /** Gecikme aylık faizi (opsiyonel) */
  lateInterestRate: z.number().min(0).optional(),
  lateInterestPeriod: z.enum(RatePeriods).optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type CashAdvanceAccount = z.infer<typeof CashAdvanceAccountSchema>

export const CashAdvanceTxnTypes = ['draw', 'payment'] as const
export type CashAdvanceTxnType = (typeof CashAdvanceTxnTypes)[number]

export const CashAdvanceTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string().min(1),
  date: Iso,
  type: z.enum(CashAdvanceTxnTypes),
  amount: z.number().positive(),
  description: z.string().optional(),
  /**
   * `payment` türünde — ödemenin yapıldığı banka hesabı / kasa
   * (cashflow bakiyesinden düşülür).
   */
  sourceAccountId: z.string().optional(),
  sourceCashRegisterId: z.string().optional(),
  /**
   * `draw` türünde — çekilen nakitin yatırıldığı banka hesabı / kasa
   * (cashflow bakiyesine eklenir).
   */
  targetAccountId: z.string().optional(),
  targetCashRegisterId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type CashAdvanceTransaction = z.infer<typeof CashAdvanceTransactionSchema>

// =============================================================================
// Taksitli nakit avans (Loan ile aynı yapı; ayrı tip)
// =============================================================================

export const InstallmentCashAdvanceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  bankId: z.string().min(1),
  /** Bağlı nakit avans hesabı (opsiyonel) */
  cashAdvanceAccountId: z.string().optional(),
  currency: z.string().length(3),
  principal: z.number().positive(),
  termMonths: z.number().int().positive(),
  startDate: Iso,
  firstInstallmentDate: Iso,
  interestRate: z.number().min(0),
  interestPeriod: z.enum(RatePeriods),
  lateInterestRate: z.number().min(0).optional(),
  lateInterestPeriod: z.enum(RatePeriods).optional(),
  taxRateMonthly: z.number().min(0).optional(),
  /** Erken kapama faizsiz olabilir mi (bilgi amaçlı bayrak) */
  earlyPayoffWithoutInterest: z.boolean().optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type InstallmentCashAdvance = z.infer<typeof InstallmentCashAdvanceSchema>

export const InstallmentCashAdvancePaymentSchema = z.object({
  id: z.string(),
  installmentAdvanceId: z.string().min(1),
  installmentIndex: z.number().int().positive(),
  dueDate: Iso,
  scheduledAmount: z.number(),
  paidDate: Iso.optional(),
  paidAmount: z.number().optional(),
  lateFee: z.number().optional(),
  /** Ödemenin yapıldığı banka hesabı (cashflow bakiyesinden düşülür) */
  sourceAccountId: z.string().optional(),
  /** Ödemenin yapıldığı kasa */
  sourceCashRegisterId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type InstallmentCashAdvancePayment = z.infer<
  typeof InstallmentCashAdvancePaymentSchema
>

export const ExpenseTypeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  notes: z.string().optional(),
  archived: z.boolean().optional(),
  createdAt: Iso,
  updatedAt: Iso,
})
export type ExpenseType = z.infer<typeof ExpenseTypeSchema>

// =============================================================================
// Nakit akışı: gelir, gider, transfer
// =============================================================================

/**
 * Bir gelir veya gider kaydında **hedef** (gelir için) ya da **kaynak** (gider için)
 * tam olarak bir tane: hesap **veya** kasa. Zod refine ile zorlanır.
 */
const accountOrCashRegister = {
  accountId: z.string().optional(),
  cashRegisterId: z.string().optional(),
}

function exactlyOneTarget(data: {
  accountId?: string
  cashRegisterId?: string
}): boolean {
  return Boolean(data.accountId) !== Boolean(data.cashRegisterId)
}

export const IncomeSchema = z
  .object({
    id: z.string(),
    incomeTypeId: z.string().optional(),
    ...accountOrCashRegister,
    currency: z.string().length(3),
    amount: z.number().positive(),
    /** Plan vade tarihi (ISO) */
    plannedDate: Iso,
    /** Gerçek tahsil tarihi (ISO) — doluysa "gerçekleşti" */
    actualDate: Iso.optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    archived: z.boolean().optional(),
    createdAt: Iso,
    updatedAt: Iso,
  })
  .refine(exactlyOneTarget, {
    message: 'Hesap veya kasadan tam olarak biri seçilmeli.',
    path: ['accountId'],
  })
export type Income = z.infer<typeof IncomeSchema>

export const ExpenseSchema = z
  .object({
    id: z.string(),
    expenseTypeId: z.string().optional(),
    ...accountOrCashRegister,
    currency: z.string().length(3),
    amount: z.number().positive(),
    plannedDate: Iso,
    actualDate: Iso.optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
    archived: z.boolean().optional(),
    createdAt: Iso,
    updatedAt: Iso,
  })
  .refine(exactlyOneTarget, {
    message: 'Hesap veya kasadan tam olarak biri seçilmeli.',
    path: ['accountId'],
  })
export type Expense = z.infer<typeof ExpenseSchema>

/**
 * Transfer: para bir kaynaktan bir hedefe taşınır. Kaynak ve hedef her biri
 * hesap **veya** kasadır. Aynı hesabın kendisine transfer engellenir.
 */
function transferEndpointValid(data: {
  fromAccountId?: string
  fromCashRegisterId?: string
  toAccountId?: string
  toCashRegisterId?: string
}): boolean {
  const fromOk = Boolean(data.fromAccountId) !== Boolean(data.fromCashRegisterId)
  const toOk = Boolean(data.toAccountId) !== Boolean(data.toCashRegisterId)
  if (!fromOk || !toOk) return false
  if (data.fromAccountId && data.fromAccountId === data.toAccountId) return false
  if (
    data.fromCashRegisterId &&
    data.fromCashRegisterId === data.toCashRegisterId
  )
    return false
  return true
}

export const TransferSchema = z
  .object({
    id: z.string(),
    fromAccountId: z.string().optional(),
    fromCashRegisterId: z.string().optional(),
    toAccountId: z.string().optional(),
    toCashRegisterId: z.string().optional(),
    /** Kaynak hesap/kasa para birimi (3 harfli ISO kodu). */
    currency: z.string().length(3),
    /** Kaynaktan çıkan tutar (kaynak `currency` cinsinden). */
    amount: z.number().positive(),
    /**
     * Çapraz kur — yalnız raporlama / UI referansı. Kullanıcı her zaman
     * `1 [yabancı] = ? [yerel]` formatında girer (UI bu yöne göre çevirir).
     * Bakiye hesabı bu alana **bağlı değildir**; `targetAmount` ile hesaplanır.
     */
    exchangeRate: z.number().positive().optional(),
    /**
     * Çapraz transferde hedefe yansıyan tutar (hedef `currency`'sinde). Eşit
     * currency'de undefined → `amount` aynen yansır. movements yalnız bunu
     * dikkate alır; UI submit'te kur + tutar üzerinden hesaplayıp depolar.
     */
    targetAmount: z.number().positive().optional(),
    date: Iso,
    description: z.string().optional(),
    notes: z.string().optional(),
    archived: z.boolean().optional(),
    createdAt: Iso,
    updatedAt: Iso,
  })
  .refine(transferEndpointValid, {
    message:
      'Kaynak ve hedef her biri hesap veya kasa olmalı; ikisi aynı varlık olamaz.',
    path: ['toAccountId'],
  })
export type Transfer = z.infer<typeof TransferSchema>

export interface NamedEntity {
  id: string
  name: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}
