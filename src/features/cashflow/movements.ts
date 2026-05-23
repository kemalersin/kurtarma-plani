import type {
  CashAdvanceTransaction,
  CreditCardTransaction,
  Expense,
  Income,
  InstallmentCashAdvancePayment,
  LoanPayment,
  Transfer,
} from '@/core/types/entities'
import { expandRecurrenceOccurrences } from '@/finance/recurrence'

/**
 * Bir hesap/kasa bakiyesine yansıyan **gerçekleşmiş** tekil hareket.
 * Negatif `amount` çıkış, pozitif giriştir.
 *
 * Tüm M4/M5/M6 entity'leri tek bir kanonik akışa indirgenir; bakiye hesabı
 * yalnızca bu liste üzerinden yapılır (tek-yön / tek-veri ilkesi).
 */
export interface AccountMovement {
  /** ISO tarih — sıralama için */
  date: string
  /** Negatif = çıkış, pozitif = giriş; Number (Decimal değil — toplam küçük) */
  amount: number
  accountId?: string
  cashRegisterId?: string
  /** Kayıt kaynağı (analiz/rapor için) */
  source:
    | 'income'
    | 'expense'
    | 'transfer'
    | 'loanPayment'
    | 'creditCardPayment'
    | 'creditCardCashAdvance'
    | 'cashAdvanceDraw'
    | 'cashAdvancePayment'
    | 'installmentAdvancePayment'
  /** Kaynak entity id'si (drill-through için) */
  sourceId: string
}

export interface CollectInput {
  incomes?: Income[]
  expenses?: Expense[]
  transfers?: Transfer[]
  loanPayments?: LoanPayment[]
  creditCardTransactions?: CreditCardTransaction[]
  cashAdvanceTransactions?: CashAdvanceTransaction[]
  installmentAdvancePayments?: InstallmentCashAdvancePayment[]
}

/**
 * Tüm gerçekleşmiş finansal hareketleri kanonik `AccountMovement[]` listesine
 * dönüştürür. Yalnızca `actualDate` / `paidDate` dolu kayıtlar dahil edilir;
 * borç ödemelerinde ek olarak `sourceAccount/CashRegisterId` dolu olmalıdır
 * (kullanıcı bağlamamışsa hareket olarak sayılmaz — eski kayıtlar etkilenmez).
 */
export function collectMovements(input: CollectInput): AccountMovement[] {
  const out: AccountMovement[] = []

  for (const inc of input.incomes ?? []) {
    if (inc.archived) continue
    if (inc.recurrence) {
      for (const occ of expandRecurrenceOccurrences(inc, { to: new Date().toISOString() })) {
        out.push({
          date: occ.date,
          amount: Number(occ.amount),
          accountId: inc.accountId,
          cashRegisterId: inc.cashRegisterId,
          source: 'income',
          sourceId: inc.id,
        })
      }
      continue
    }
    if (!inc.actualDate) continue
    out.push({
      date: inc.actualDate,
      amount: inc.amount,
      accountId: inc.accountId,
      cashRegisterId: inc.cashRegisterId,
      source: 'income',
      sourceId: inc.id,
    })
  }

  for (const exp of input.expenses ?? []) {
    if (exp.archived) continue
    if (exp.recurrence) {
      for (const occ of expandRecurrenceOccurrences(exp, { to: new Date().toISOString() })) {
        out.push({
          date: occ.date,
          amount: -Number(occ.amount),
          accountId: exp.accountId,
          cashRegisterId: exp.cashRegisterId,
          source: 'expense',
          sourceId: exp.id,
        })
      }
      continue
    }
    if (!exp.actualDate) continue
    out.push({
      date: exp.actualDate,
      amount: -exp.amount,
      accountId: exp.accountId,
      cashRegisterId: exp.cashRegisterId,
      source: 'expense',
      sourceId: exp.id,
    })
  }

  for (const t of input.transfers ?? []) {
    if (t.archived) continue
    /**
     * Hedef leg: cross-currency'de `targetAmount` (UI tarafından kur + base/quote
     * yönüne göre hesaplanıp kaydedilir). Eşit currency'de undefined → `amount`
     * aynen yansır. exchangeRate yalnız raporlama referansıdır; ancak eski
     * (targetAmount içermeyen) kayıtlar için geriye uyumlu fallback olarak
     * `amount * exchangeRate` kullanılır.
     */
    const targetAmount =
      t.targetAmount ??
      (t.exchangeRate != null ? t.amount * t.exchangeRate : t.amount)
    out.push({
      date: t.date,
      amount: -t.amount,
      accountId: t.fromAccountId,
      cashRegisterId: t.fromCashRegisterId,
      source: 'transfer',
      sourceId: t.id,
    })
    out.push({
      date: t.date,
      amount: targetAmount,
      accountId: t.toAccountId,
      cashRegisterId: t.toCashRegisterId,
      source: 'transfer',
      sourceId: t.id,
    })
  }

  for (const lp of input.loanPayments ?? []) {
    if (!lp.paidDate) continue
    if (!lp.sourceAccountId && !lp.sourceCashRegisterId) continue
    const amount = lp.paidAmount ?? lp.scheduledAmount
    out.push({
      date: lp.paidDate,
      amount: -amount,
      accountId: lp.sourceAccountId,
      cashRegisterId: lp.sourceCashRegisterId,
      source: 'loanPayment',
      sourceId: lp.id,
    })
  }

  for (const ct of input.creditCardTransactions ?? []) {
    if (ct.type === 'payment') {
      if (!ct.sourceAccountId && !ct.sourceCashRegisterId) continue
      out.push({
        date: ct.date,
        amount: -ct.amount,
        accountId: ct.sourceAccountId,
        cashRegisterId: ct.sourceCashRegisterId,
        source: 'creditCardPayment',
        sourceId: ct.id,
      })
    } else if (ct.type === 'cashAdvance') {
      if (!ct.targetAccountId && !ct.targetCashRegisterId) continue
      out.push({
        date: ct.date,
        amount: ct.amount,
        accountId: ct.targetAccountId,
        cashRegisterId: ct.targetCashRegisterId,
        source: 'creditCardCashAdvance',
        sourceId: ct.id,
      })
    }
    // `purchase`: hesap/kasa etkilemez — yalnızca kart borcuna eklenir.
  }

  for (const cat of input.cashAdvanceTransactions ?? []) {
    if (cat.type === 'payment') {
      if (!cat.sourceAccountId && !cat.sourceCashRegisterId) continue
      out.push({
        date: cat.date,
        amount: -cat.amount,
        accountId: cat.sourceAccountId,
        cashRegisterId: cat.sourceCashRegisterId,
        source: 'cashAdvancePayment',
        sourceId: cat.id,
      })
    } else if (cat.type === 'draw') {
      if (!cat.targetAccountId && !cat.targetCashRegisterId) continue
      out.push({
        date: cat.date,
        amount: cat.amount,
        accountId: cat.targetAccountId,
        cashRegisterId: cat.targetCashRegisterId,
        source: 'cashAdvanceDraw',
        sourceId: cat.id,
      })
    }
  }

  for (const ip of input.installmentAdvancePayments ?? []) {
    if (!ip.paidDate) continue
    if (!ip.sourceAccountId && !ip.sourceCashRegisterId) continue
    const amount = ip.paidAmount ?? ip.scheduledAmount
    out.push({
      date: ip.paidDate,
      amount: -amount,
      accountId: ip.sourceAccountId,
      cashRegisterId: ip.sourceCashRegisterId,
      source: 'installmentAdvancePayment',
      sourceId: ip.id,
    })
  }

  return out
}
