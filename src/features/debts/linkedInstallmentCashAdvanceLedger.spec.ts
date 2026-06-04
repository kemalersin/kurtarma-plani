import { describe, it, expect } from 'vitest'
import type {
  CashAdvanceAccount,
  InstallmentCashAdvance,
  InstallmentCashAdvancePayment,
} from '@/core/types/entities'
import { linkedInstallmentLimitUsage } from './linkedInstallmentCashAdvanceLedger'
import { cashAdvanceAvailableLimit, cashAdvanceState } from './cashAdvanceHelpers'
import { buildScheduleForInstallmentAdvance, remainingDebtForInstallmentAdvance } from './installmentAdvanceHelpers'

const NOW = new Date().toISOString()

function makeAccount(overrides?: Partial<CashAdvanceAccount>): CashAdvanceAccount {
  return {
    id: 'acc-1',
    name: 'Nakit Avans',
    bankId: 'bank-1',
    currency: 'TRY',
    limit: 175_000,
    openingBalance: 0,
    openingDate: '2026-01-01T00:00:00.000Z',
    interestRate: 0.04,
    interestPeriod: 'monthly',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeAdvance(
  overrides?: Partial<InstallmentCashAdvance>,
): InstallmentCashAdvance {
  return {
    id: 'adv-1',
    name: 'Taksitli Avans',
    bankId: 'bank-1',
    cashAdvanceAccountId: 'acc-1',
    currency: 'TRY',
    principal: 25_000,
    termMonths: 3,
    startDate: '2026-03-15T00:00:00.000Z',
    firstInstallmentDate: '2026-04-15T00:00:00.000Z',
    interestRate: 0.04,
    interestPeriod: 'monthly',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makePayment(
  overrides?: Partial<InstallmentCashAdvancePayment>,
): InstallmentCashAdvancePayment {
  return {
    id: 'pay-1',
    installmentAdvanceId: 'adv-1',
    installmentIndex: 1,
    dueDate: '2026-04-15T00:00:00.000Z',
    scheduledAmount: 8800,
    paidDate: '2026-04-15T00:00:00.000Z',
    paidAmount: 8800,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('linkedInstallmentLimitUsage', () => {
  it('kullanım tutarı limit kullanımına kalan borç olarak eklenir', () => {
    const account = makeAccount()
    const advance = makeAdvance()
    const schedule = buildScheduleForInstallmentAdvance(advance)
    const expected = Number(
      remainingDebtForInstallmentAdvance(advance, schedule, 0, '2026-04-01'),
    )
    expect(linkedInstallmentLimitUsage(account, [advance], [], '2026-04-01')).toBe(expected)
    expect(expected).toBeGreaterThan(advance.principal)
  })

  it('taksit ödemesi limit kullanımını kalan borca göre düşürür', () => {
    const account = makeAccount()
    const advance = makeAdvance()
    const payment = makePayment()
    const schedule = buildScheduleForInstallmentAdvance(advance)
    const expected = Number(
      remainingDebtForInstallmentAdvance(advance, schedule, 1, '2026-05-01', [payment]),
    )
    expect(linkedInstallmentLimitUsage(account, [advance], [payment], '2026-05-01')).toBe(
      expected,
    )
    expect(expected).toBeLessThan(25_000)
  })

  it('bağlı olmayan avansı dahil etmez', () => {
    const account = makeAccount()
    const unlinked = makeAdvance({ cashAdvanceAccountId: 'other-acc' })
    expect(linkedInstallmentLimitUsage(account, [unlinked], [])).toBe(0)
  })

  it('henüz başlamamış avansı dahil etmez', () => {
    const account = makeAccount()
    const future = makeAdvance({ startDate: '2026-06-01T00:00:00.000Z' })
    expect(linkedInstallmentLimitUsage(account, [future], [], '2026-05-01')).toBe(0)
  })

  it('birden fazla bağlı avansın kalan borcunu toplar', () => {
    const account = makeAccount()
    const adv1 = makeAdvance({ id: 'adv-1', principal: 10_000, startDate: '2026-02-01T00:00:00.000Z' })
    const adv2 = makeAdvance({
      id: 'adv-2',
      principal: 15_000,
      startDate: '2026-03-01T00:00:00.000Z',
    })
    const expected =
      Number(
        remainingDebtForInstallmentAdvance(
          adv1,
          buildScheduleForInstallmentAdvance(adv1),
          0,
          '2026-04-01',
        ),
      ) +
      Number(
        remainingDebtForInstallmentAdvance(
          adv2,
          buildScheduleForInstallmentAdvance(adv2),
          0,
          '2026-04-01',
        ),
      )
    expect(linkedInstallmentLimitUsage(account, [adv1, adv2], [], '2026-04-01')).toBe(expected)
  })
})

describe('cashAdvanceAvailableLimit', () => {
  it('bağlı taksitli avans anapara/faiz/toplam etkilemez; yalnızca kullanılabilir düşer', () => {
    const account = makeAccount()
    const advance = makeAdvance({ principal: 25_320 })
    const context = {
      installmentAdvances: [advance],
      installmentAdvancePayments: [],
    }

    const state = cashAdvanceState(account, [], '2026-04-01')
    const available = cashAdvanceAvailableLimit(account, [], '2026-04-01', undefined, context)
    const linked = linkedInstallmentLimitUsage(account, [advance], [], '2026-04-01')
    const remaining = Number(
      remainingDebtForInstallmentAdvance(advance, buildScheduleForInstallmentAdvance(advance), 0, '2026-04-01'),
    )

    expect(Number(state.principal)).toBe(0)
    expect(Number(state.total)).toBe(0)
    expect(linked).toBe(remaining)
    expect(available).toBeCloseTo(175_000 - remaining, 2)
  })
})
