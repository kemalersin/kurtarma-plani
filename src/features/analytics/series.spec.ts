import { describe, expect, it } from 'vitest'
import {
  expenseByType,
  incomeByType,
  monthlyCashflowSeries,
  monthsBetween,
  upcomingDebtSeries,
} from './series'
import type {
  Expense,
  ExpenseType,
  Income,
  IncomeType,
} from '@/core/types/entities'

const ISO = '2026-05-01T00:00:00.000Z'

function income(
  id: string,
  amount: number,
  plannedDate: string,
  actualDate?: string,
  incomeTypeId?: string,
): Income {
  return {
    id,
    incomeTypeId,
    accountId: 'acc1',
    currency: 'TRY',
    amount,
    plannedDate,
    ...(actualDate ? { actualDate } : {}),
    createdAt: ISO,
    updatedAt: ISO,
  } as Income
}

function expense(
  id: string,
  amount: number,
  plannedDate: string,
  actualDate?: string,
  expenseTypeId?: string,
): Expense {
  return {
    id,
    expenseTypeId,
    accountId: 'acc1',
    currency: 'TRY',
    amount,
    plannedDate,
    ...(actualDate ? { actualDate } : {}),
    createdAt: ISO,
    updatedAt: ISO,
  } as Expense
}

describe('monthsBetween', () => {
  it('aralık inclusive (2026-01 → 2026-03 = 3 ay)', () => {
    expect(monthsBetween('2026-01-01', '2026-03-15')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('aynı ay tek elemanlı liste', () => {
    expect(monthsBetween('2026-05-10', '2026-05-25')).toEqual(['2026-05'])
  })
})

describe('monthlyCashflowSeries', () => {
  it('effective basis (actual ?? planned) ile aylara böler', () => {
    const incomes = [
      income('i1', 1000, '2026-04-01', '2026-04-05'),
      income('i2', 500, '2026-05-10'),
    ]
    const expenses = [expense('e1', 300, '2026-04-15', '2026-04-15')]
    const result = monthlyCashflowSeries(incomes, expenses, {
      from: '2026-04-01',
      to: '2026-05-31',
    })
    expect(result.months).toEqual(['2026-04', '2026-05'])
    expect(result.income).toEqual([1000, 500])
    expect(result.expense).toEqual([300, 0])
    expect(result.net).toEqual([700, 500])
  })

  it("plan basis sadece plannedDate'i sayar", () => {
    const incomes = [
      income('i1', 1000, '2026-04-01', '2026-05-05'),
    ]
    const r = monthlyCashflowSeries(
      incomes,
      [],
      { from: '2026-04-01', to: '2026-05-31' },
      'plan',
    )
    expect(r.income).toEqual([1000, 0])
  })

  it("actual basis actualDate yoksa atlar", () => {
    const incomes = [income('i1', 1000, '2026-04-01')]
    const r = monthlyCashflowSeries(
      incomes,
      [],
      { from: '2026-04-01', to: '2026-04-30' },
      'actual',
    )
    expect(r.income).toEqual([0])
  })

  it('archived kayıtları atlar', () => {
    const arc = income('i1', 1000, '2026-04-01', '2026-04-01')
    arc.archived = true
    const r = monthlyCashflowSeries(
      [arc],
      [],
      { from: '2026-04-01', to: '2026-04-30' },
    )
    expect(r.income).toEqual([0])
  })
})

describe('incomeByType / expenseByType', () => {
  const types: IncomeType[] = [
    { id: 't-maas', name: 'Maaş', createdAt: ISO, updatedAt: ISO } as IncomeType,
    { id: 't-kira', name: 'Kira geliri', createdAt: ISO, updatedAt: ISO } as IncomeType,
  ]
  const expTypes: ExpenseType[] = [
    { id: 't-fatura', name: 'Faturalar', createdAt: ISO, updatedAt: ISO } as ExpenseType,
  ]

  it("typeId'ye göre toplar ve büyükten küçüğe sıralar", () => {
    const incomes = [
      income('i1', 5000, '2026-05-01', '2026-05-01', 't-maas'),
      income('i2', 1500, '2026-05-10', '2026-05-10', 't-kira'),
      income('i3', 1000, '2026-05-15', '2026-05-15', 't-kira'),
    ]
    const r = incomeByType(incomes, types)
    expect(r).toEqual([
      { name: 'Maaş', value: 5000 },
      { name: 'Kira geliri', value: 2500 },
    ])
  })

  it('typeId yoksa "Tanımsız" altında toplar', () => {
    const incomes = [
      income('i1', 100, '2026-05-01', '2026-05-01'),
      income('i2', 200, '2026-05-02', '2026-05-02'),
    ]
    const r = incomeByType(incomes, types)
    expect(r).toEqual([{ name: 'Tanımsız', value: 300 }])
  })

  it('tarih aralığı filtreler', () => {
    const expenses = [
      expense('e1', 300, '2026-04-15', '2026-04-15', 't-fatura'),
      expense('e2', 200, '2026-06-15', '2026-06-15', 't-fatura'),
    ]
    const r = expenseByType(expenses, expTypes, {
      from: '2026-05-01',
      to: '2026-05-31',
    })
    expect(r).toEqual([])
  })
})

describe('upcomingDebtSeries', () => {
  it('vadeleri aya göre toplar', () => {
    const r = upcomingDebtSeries(
      [
        { dueDate: '2026-06-05', amount: 1500 },
        { dueDate: '2026-06-20', amount: 500 },
        { dueDate: '2026-07-10', amount: 2000 },
      ],
      { from: '2026-06-01', to: '2026-07-31' },
    )
    expect(r.months).toEqual(['2026-06', '2026-07'])
    expect(r.scheduled).toEqual([2000, 2000])
  })

  it('aralık dışı vadeleri atar', () => {
    const r = upcomingDebtSeries(
      [
        { dueDate: '2026-05-15', amount: 1000 },
        { dueDate: '2026-06-15', amount: 2000 },
      ],
      { from: '2026-06-01', to: '2026-06-30' },
    )
    expect(r.scheduled).toEqual([2000])
  })
})
