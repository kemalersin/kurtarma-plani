import { computed, onMounted, type ComputedRef } from 'vue'
import { useEntitiesStore } from '@/stores/entities'
import {
  collectMovements,
  type AccountMovement,
} from '@/features/cashflow/movements'
import {
  accountBalance,
  cashRegisterBalance,
} from '@/features/cashflow/balanceHelpers'
import type {
  Account,
  CashAdvanceTransaction,
  CashRegister,
  CreditCardTransaction,
  Expense,
  Income,
  InstallmentCashAdvancePayment,
  LoanPayment,
  Transfer,
} from '@/core/types/entities'

/**
 * Tüm gerçekleşmiş finansal hareketleri (gelir / gider / transfer / borç ödemeleri /
 * kart ödemeleri & nakit avansları / kredili mevduat çekim & ödemeleri / taksitli
 * KMH ödemeleri) toplayıp her hesap ve kasa için **güncel** bakiyeyi hesaplayan
 * paylaşılan composable.
 *
 * Bakiye hesabı tek bir kanonik akış üzerinden yapılır: `collectMovements()` →
 * `accountBalance()` / `cashRegisterBalance()`. Liste ve drawer tüketicileri
 * tekrar tekrar store yüklemesin / map kurmasın diye buradan paylaşılır.
 */
export interface AccountBalancesApi {
  /** `accountId → güncel bakiye (string, profil para birimi)` */
  balancesByAccount: ComputedRef<Record<string, string>>
  /** `cashRegisterId → güncel bakiye (string)` */
  balancesByCashRegister: ComputedRef<Record<string, string>>
  /** Saf hareket listesi — drill-through tabloları için. */
  movements: ComputedRef<AccountMovement[]>
}

/**
 * Movements ve bakiye haritalarını hazırlar; bileşen mount olduğunda eksik
 * store'ları paralel yükler (`catch → undefined`, hata yutulur — eksik veriyle
 * de UI çalışmalı, sadece o hareketler atlanır).
 */
export function useAccountBalances(): AccountBalancesApi {
  const entities = useEntitiesStore()

  const incomes = entities.list<Income>('income')
  const expenses = entities.list<Expense>('expense')
  const transfers = entities.list<Transfer>('transfer')
  const loanPayments = entities.list<LoanPayment>('loanPayment')
  const creditCardTxns = entities.list<CreditCardTransaction>(
    'creditCardTransaction',
  )
  const cashAdvanceTxns = entities.list<CashAdvanceTransaction>(
    'cashAdvanceTransaction',
  )
  const installmentAdvancePayments = entities.list<InstallmentCashAdvancePayment>(
    'installmentCashAdvancePayment',
  )

  onMounted(async () => {
    const tasks: Promise<unknown>[] = []
    for (const type of [
      'income',
      'expense',
      'transfer',
      'loanPayment',
      'creditCardTransaction',
      'cashAdvanceTransaction',
      'installmentCashAdvancePayment',
    ] as const) {
      if (!entities.loaded(type).value) {
        tasks.push(entities.load(type).catch(() => undefined))
      }
    }
    if (tasks.length) await Promise.all(tasks)
  })

  const movements = computed<AccountMovement[]>(() =>
    collectMovements({
      incomes: incomes.value,
      expenses: expenses.value,
      transfers: transfers.value,
      loanPayments: loanPayments.value,
      creditCardTransactions: creditCardTxns.value,
      cashAdvanceTransactions: cashAdvanceTxns.value,
      installmentAdvancePayments: installmentAdvancePayments.value,
    }),
  )

  const accounts = entities.list<Account>('account')
  const cashRegisters = entities.list<CashRegister>('cashRegister')

  const balancesByAccount = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    const ms = movements.value
    for (const acc of accounts.value) {
      map[acc.id] = accountBalance(acc, ms)
    }
    return map
  })

  const balancesByCashRegister = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    const ms = movements.value
    for (const reg of cashRegisters.value) {
      map[reg.id] = cashRegisterBalance(reg, ms)
    }
    return map
  })

  return { balancesByAccount, balancesByCashRegister, movements }
}
