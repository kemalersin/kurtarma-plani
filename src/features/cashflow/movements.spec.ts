import { describe, expect, it } from 'vitest'
import { collectMovements } from './movements'
import { accountBalance, cashRegisterBalance } from './balanceHelpers'
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

const ISO = '2026-05-01T00:00:00.000Z'

function stubAccount(over: Partial<Account> = {}): Account {
  return {
    id: 'acc1',
    name: 'Vadesiz TRY',
    bankId: 'bnk1',
    currency: 'TRY',
    openingBalance: 1000,
    openingDate: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as Account
}

function stubCashRegister(over: Partial<CashRegister> = {}): CashRegister {
  return {
    id: 'kasa1',
    name: 'Ana kasa',
    currency: 'TRY',
    openingBalance: 200,
    openingDate: ISO,
    createdAt: ISO,
    updatedAt: ISO,
    ...over,
  } as CashRegister
}

describe('collectMovements', () => {
  it('planlı (actualDate yok) gelir/giderleri es geçer', () => {
    const incomes: Income[] = [
      {
        id: 'i1',
        accountId: 'acc1',
        currency: 'TRY',
        amount: 500,
        plannedDate: '2026-05-10',
        // actualDate yok
        createdAt: ISO,
        updatedAt: ISO,
      } as Income,
    ]
    const moves = collectMovements({ incomes })
    expect(moves).toHaveLength(0)
  })

  it('gerçekleşmiş gelir/gider/transferleri doğru yönde ekler', () => {
    const moves = collectMovements({
      incomes: [
        {
          id: 'i1',
          accountId: 'acc1',
          currency: 'TRY',
          amount: 1000,
          plannedDate: '2026-05-01',
          actualDate: '2026-05-02',
          createdAt: ISO,
          updatedAt: ISO,
        } as Income,
      ],
      expenses: [
        {
          id: 'e1',
          accountId: 'acc1',
          currency: 'TRY',
          amount: 200,
          plannedDate: '2026-05-03',
          actualDate: '2026-05-04',
          createdAt: ISO,
          updatedAt: ISO,
        } as Expense,
      ],
      transfers: [
        {
          id: 't1',
          fromAccountId: 'acc1',
          toCashRegisterId: 'kasa1',
          currency: 'TRY',
          amount: 50,
          date: '2026-05-05',
          createdAt: ISO,
          updatedAt: ISO,
        } as Transfer,
      ],
    })
    // 1 income + 1 expense + 2 transfer leg = 4
    expect(moves).toHaveLength(4)
    expect(moves.find((m) => m.source === 'income')?.amount).toBe(1000)
    expect(moves.find((m) => m.source === 'expense')?.amount).toBe(-200)
    const tLegs = moves.filter((m) => m.source === 'transfer')
    expect(tLegs.map((m) => m.amount).sort((a, b) => a - b)).toEqual([-50, 50])
  })

  it('borç ödemeleri sourceAccountId yoksa hareket üretmez (geriye dönük uyum)', () => {
    const loanPayments: LoanPayment[] = [
      {
        id: 'lp1',
        loanId: 'l1',
        installmentIndex: 1,
        dueDate: '2026-05-15',
        scheduledAmount: 1500,
        paidDate: '2026-05-15',
        paidAmount: 1500,
        createdAt: ISO,
        updatedAt: ISO,
      } as LoanPayment,
    ]
    const moves = collectMovements({ loanPayments })
    expect(moves).toHaveLength(0)
  })

  it('borç ödemeleri bağlandığında negatif hareket üretir', () => {
    const loanPayments: LoanPayment[] = [
      {
        id: 'lp1',
        loanId: 'l1',
        installmentIndex: 1,
        dueDate: '2026-05-15',
        scheduledAmount: 1500,
        paidDate: '2026-05-15',
        paidAmount: 1500,
        sourceAccountId: 'acc1',
        createdAt: ISO,
        updatedAt: ISO,
      } as LoanPayment,
    ]
    const moves = collectMovements({ loanPayments })
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({
      amount: -1500,
      accountId: 'acc1',
      source: 'loanPayment',
    })
  })

  it('kart payment çıkış / cashAdvance giriş; purchase yok sayılır', () => {
    const txns: CreditCardTransaction[] = [
      {
        id: 'ct-buy',
        cardId: 'kk1',
        date: '2026-05-10',
        type: 'purchase',
        amount: 300,
        createdAt: ISO,
        updatedAt: ISO,
      } as CreditCardTransaction,
      {
        id: 'ct-pmt',
        cardId: 'kk1',
        date: '2026-05-20',
        type: 'payment',
        amount: 500,
        sourceAccountId: 'acc1',
        createdAt: ISO,
        updatedAt: ISO,
      } as CreditCardTransaction,
      {
        id: 'ct-ca',
        cardId: 'kk1',
        date: '2026-05-25',
        type: 'cashAdvance',
        amount: 400,
        targetCashRegisterId: 'kasa1',
        createdAt: ISO,
        updatedAt: ISO,
      } as CreditCardTransaction,
    ]
    const moves = collectMovements({ creditCardTransactions: txns })
    expect(moves).toHaveLength(2)
    expect(moves.find((m) => m.source === 'creditCardPayment')?.amount).toBe(-500)
    expect(moves.find((m) => m.source === 'creditCardCashAdvance')?.amount).toBe(400)
  })

  it('nakit avans draw → hesaba giriş, payment → hesaptan çıkış', () => {
    const txns: CashAdvanceTransaction[] = [
      {
        id: 'd1',
        accountId: 'ca1',
        date: '2026-05-10',
        type: 'draw',
        amount: 2000,
        targetAccountId: 'acc1',
        createdAt: ISO,
        updatedAt: ISO,
      } as CashAdvanceTransaction,
      {
        id: 'p1',
        accountId: 'ca1',
        date: '2026-05-20',
        type: 'payment',
        amount: 800,
        sourceAccountId: 'acc1',
        createdAt: ISO,
        updatedAt: ISO,
      } as CashAdvanceTransaction,
    ]
    const moves = collectMovements({ cashAdvanceTransactions: txns })
    expect(moves.find((m) => m.source === 'cashAdvanceDraw')?.amount).toBe(2000)
    expect(moves.find((m) => m.source === 'cashAdvancePayment')?.amount).toBe(-800)
  })

  it('taksitli avans ödemesi negatif hareket', () => {
    const pays: InstallmentCashAdvancePayment[] = [
      {
        id: 'iap1',
        installmentAdvanceId: 'ia1',
        installmentIndex: 1,
        dueDate: '2026-05-15',
        scheduledAmount: 750,
        paidDate: '2026-05-15',
        paidAmount: 800,
        sourceAccountId: 'acc1',
        createdAt: ISO,
        updatedAt: ISO,
      } as InstallmentCashAdvancePayment,
    ]
    const moves = collectMovements({ installmentAdvancePayments: pays })
    expect(moves).toHaveLength(1)
    expect(moves[0].amount).toBe(-800)
  })
})

describe('accountBalance / cashRegisterBalance — entegrasyon', () => {
  it('açılış + gelir − gider − kredi ödemesi + transfer-out', () => {
    const acc = stubAccount() // openingBalance 1000
    const moves = collectMovements({
      incomes: [
        {
          id: 'i1',
          accountId: 'acc1',
          currency: 'TRY',
          amount: 3000,
          plannedDate: '2026-05-01',
          actualDate: '2026-05-01',
          createdAt: ISO,
          updatedAt: ISO,
        } as Income,
      ],
      expenses: [
        {
          id: 'e1',
          accountId: 'acc1',
          currency: 'TRY',
          amount: 500,
          plannedDate: '2026-05-02',
          actualDate: '2026-05-02',
          createdAt: ISO,
          updatedAt: ISO,
        } as Expense,
      ],
      loanPayments: [
        {
          id: 'lp1',
          loanId: 'l1',
          installmentIndex: 1,
          dueDate: '2026-05-10',
          scheduledAmount: 1200,
          paidDate: '2026-05-10',
          paidAmount: 1200,
          sourceAccountId: 'acc1',
          createdAt: ISO,
          updatedAt: ISO,
        } as LoanPayment,
      ],
      transfers: [
        {
          id: 't1',
          fromAccountId: 'acc1',
          toCashRegisterId: 'kasa1',
          currency: 'TRY',
          amount: 300,
          date: '2026-05-15',
          createdAt: ISO,
          updatedAt: ISO,
        } as Transfer,
      ],
    })
    // 1000 + 3000 − 500 − 1200 − 300 = 2000
    expect(accountBalance(acc, moves, '2026-05-31')).toBe('2000')

    const kasa = stubCashRegister() // openingBalance 200
    // kasa: +300 transfer-in → 500
    expect(cashRegisterBalance(kasa, moves, '2026-05-31')).toBe('500')
  })

  it('cross-currency transfer: kaynaktan -amount, hedefe +targetAmount yansıtır (yeni şema)', () => {
    const tryAcc = stubAccount({ id: 'acc-try', currency: 'TRY', openingBalance: 50000 })
    const usdAcc = stubAccount({
      id: 'acc-usd',
      name: 'USD vadesiz',
      currency: 'USD',
      openingBalance: 0,
    })
    const transfers: Transfer[] = [
      {
        id: 't-fx',
        fromAccountId: 'acc-try',
        toAccountId: 'acc-usd',
        currency: 'TRY',
        amount: 33000,
        exchangeRate: 33,
        targetAmount: 1000,
        date: '2026-05-15',
        createdAt: ISO,
        updatedAt: ISO,
      } as Transfer,
    ]
    const moves = collectMovements({ transfers })
    expect(moves).toHaveLength(2)
    const out = moves.find((m) => m.accountId === 'acc-try')
    const inb = moves.find((m) => m.accountId === 'acc-usd')
    expect(out?.amount).toBe(-33000)
    expect(inb?.amount).toBe(1000)
    expect(accountBalance(tryAcc, moves, '2026-05-31')).toBe('17000')
    expect(accountBalance(usdAcc, moves, '2026-05-31')).toBe('1000')
  })

  it('eski kayıt (targetAmount yok, exchangeRate var) için fallback: amount * exchangeRate', () => {
    const tryAcc = stubAccount({ id: 'acc-try', openingBalance: 50000 })
    const usdAcc = stubAccount({
      id: 'acc-usd',
      currency: 'USD',
      openingBalance: 0,
    })
    const transfers: Transfer[] = [
      {
        id: 't-legacy',
        fromAccountId: 'acc-try',
        toAccountId: 'acc-usd',
        currency: 'TRY',
        amount: 33000,
        exchangeRate: 1 / 33,
        date: '2026-05-15',
        createdAt: ISO,
        updatedAt: ISO,
      } as Transfer,
    ]
    const moves = collectMovements({ transfers })
    expect(moves.find((m) => m.accountId === 'acc-usd')?.amount).toBeCloseTo(1000, 6)
    expect(accountBalance(usdAcc, moves, '2026-05-31')).toBe('1000')
    expect(accountBalance(tryAcc, moves, '2026-05-31')).toBe('17000')
  })

  it('exchangeRate undefined → eşit currency davranışı (amount aynen yansır)', () => {
    const tryFrom = stubAccount({ id: 'acc-a', openingBalance: 500 })
    const tryTo = stubAccount({ id: 'acc-b', name: 'Diğer', openingBalance: 0 })
    const moves = collectMovements({
      transfers: [
        {
          id: 't-same',
          fromAccountId: 'acc-a',
          toAccountId: 'acc-b',
          currency: 'TRY',
          amount: 250,
          date: '2026-05-15',
          createdAt: ISO,
          updatedAt: ISO,
        } as Transfer,
      ],
    })
    expect(accountBalance(tryFrom, moves, '2026-05-31')).toBe('250')
    expect(accountBalance(tryTo, moves, '2026-05-31')).toBe('250')
  })

  it('asOf öncesi hareketleri filtreler', () => {
    const acc = stubAccount({ openingBalance: 100 })
    const moves = collectMovements({
      incomes: [
        {
          id: 'i1',
          accountId: 'acc1',
          currency: 'TRY',
          amount: 500,
          plannedDate: '2026-05-15',
          actualDate: '2026-05-15',
          createdAt: ISO,
          updatedAt: ISO,
        } as Income,
      ],
    })
    expect(accountBalance(acc, moves, '2026-05-10')).toBe('100')
    expect(accountBalance(acc, moves, '2026-05-20')).toBe('600')
  })
})
