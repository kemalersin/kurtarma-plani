import { describe, expect, it } from 'vitest'
import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
} from '@/core/types/entities'
import {
  cashAdvanceDrawCapacity,
  earliestCashAdvanceTransactionDate,
  isCashAdvanceOpeningDateOnOrBeforeFirstTxn,
  isCashAdvanceTxnDateOnOrAfterOpening,
} from '@/features/debts/cashAdvanceHelpers'

const account: CashAdvanceAccount = {
  id: 'ca-1',
  name: 'KMH',
  bankId: 'b1',
  currency: 'TRY',
  limit: 10_000,
  openingBalance: 0,
  openingDate: '2026-01-01T00:00:00.000Z',
  interestRate: 0,
  interestPeriod: 'monthly',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function txn(
  partial: Pick<CashAdvanceTransaction, 'id' | 'date' | 'amount' | 'type'>,
): CashAdvanceTransaction {
  return {
    accountId: 'ca-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('cash advance opening date rules', () => {
  it('hareket açılıştan önce geçersiz', () => {
    expect(
      isCashAdvanceTxnDateOnOrAfterOpening(account, '2025-12-31T00:00:00.000Z'),
    ).toBe(false)
    expect(
      isCashAdvanceTxnDateOnOrAfterOpening(account, '2026-01-01T00:00:00.000Z'),
    ).toBe(true)
  })

  it('açılış tarihi ilk hareketten sonra olamaz', () => {
    const earliest = earliestCashAdvanceTransactionDate('ca-1', [
      txn({ id: 'a', date: '2026-03-01T00:00:00.000Z', amount: 1, type: 'draw' }),
    ])
    expect(earliest).toBe('2026-03-01T00:00:00.000Z')
    expect(
      isCashAdvanceOpeningDateOnOrBeforeFirstTxn(
        '2026-03-15T00:00:00.000Z',
        earliest,
      ),
    ).toBe(false)
  })

  it('açılış öncesi hareket motor hesabına dahil edilmez', () => {
    const txns = [
      txn({
        id: 'early',
        date: '2025-12-15T00:00:00.000Z',
        amount: 5_000,
        type: 'draw',
      }),
      txn({
        id: 'ok',
        date: '2026-02-01T00:00:00.000Z',
        amount: 1_000,
        type: 'draw',
      }),
    ]
    expect(
      cashAdvanceDrawCapacity(account, txns, '2026-06-15T12:00:00.000Z'),
    ).toBe(9_000)
  })
})

describe('cashAdvanceDrawCapacity', () => {
  it('boş hesapta limit kadar kullanım kapasitesi verir', () => {
    expect(
      cashAdvanceDrawCapacity(account, [], '2026-06-15T12:00:00.000Z'),
    ).toBe(10_000)
  })

  it('mevcut anapara düşülür', () => {
    const txns = [
      txn({
        id: 'd1',
        date: '2026-06-01T00:00:00.000Z',
        amount: 3_000,
        type: 'draw',
      }),
    ]
    expect(
      cashAdvanceDrawCapacity(account, txns, '2026-06-15T12:00:00.000Z'),
    ).toBe(7_000)
  })

  it('düzenlemede mevcut kullanım tutarı kapasiteye geri eklenir', () => {
    const txns = [
      txn({
        id: 'd1',
        date: '2026-06-01T00:00:00.000Z',
        amount: 8_000,
        type: 'draw',
      }),
    ]
    expect(
      cashAdvanceDrawCapacity(account, txns, '2026-06-15T12:00:00.000Z', {
        excludeTransactionId: 'd1',
      }),
    ).toBe(10_000)
  })

  it('kullanım tarihinden sonraki hareketler kapasiteyi etkilemez', () => {
    const txns = [
      txn({
        id: 'd1',
        date: '2026-06-01T00:00:00.000Z',
        amount: 2_000,
        type: 'draw',
      }),
      txn({
        id: 'd2',
        date: '2026-06-20T00:00:00.000Z',
        amount: 5_000,
        type: 'draw',
      }),
    ]
    expect(
      cashAdvanceDrawCapacity(account, txns, '2026-06-10T12:00:00.000Z'),
    ).toBe(8_000)
  })
})
