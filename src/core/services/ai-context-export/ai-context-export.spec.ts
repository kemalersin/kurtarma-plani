import { describe, expect, it } from 'vitest'
import { AI_CONTEXT_FILE_TYPE } from '@/core/constants'
import { buildAiContextDocument } from '@/core/services/ai-context-export/build-document'
import { formatAiContextJson } from '@/core/services/ai-context-export/format-json'
import { prunePaidInstallments } from '@/core/services/ai-context-export/prune-structured'
import { formatAiContextMarkdown } from '@/core/services/ai-context-export/format-markdown'
import type { ProfileMeta } from '@/core/types/profile'

const profile: ProfileMeta = {
  id: 'p1',
  name: 'Test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  localeSettings: {
    locale: 'tr-TR',
    currency: 'TRY',
    timeZone: 'Europe/Istanbul',
    dateFormat: 'dd.MM.yyyy',
  },
  password: { enabled: false },
}

describe('buildAiContextDocument', () => {
  it('arşiv ve hassas kayıtları varsayılan hariç tutar', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: [
        {
          id: 'b1',
          type: 'bank',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { id: 'b1', name: 'Banka A', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        },
        {
          id: 'a1',
          type: 'account',
          updatedAt: '2026-01-01T00:00:00.000Z',
          sensitive: true,
          data: {
            id: 'a1',
            name: 'Gizli',
            bankId: 'b1',
            type: 'checking',
            currency: 'TRY',
            openingBalance: 0,
            openingDate: '2026-01-01',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
        {
          id: 'a2',
          type: 'account',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'a2',
            name: 'Açık',
            bankId: 'b1',
            type: 'checking',
            currency: 'TRY',
            openingBalance: 1000,
            openingDate: '2026-01-01',
            archived: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
        {
          id: 's1',
          type: 'aiSettings',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { apiKey: 'secret-key' },
        },
      ],
    })

    expect(doc.meta.type).toBe(AI_CONTEXT_FILE_TYPE)
    expect(doc.sections.accounts).toHaveLength(0)
    expect(doc.omitted.archivedRecordCount).toBe(1)
    expect(doc.omitted.sensitiveRecordCount).toBe(1)
    expect(formatAiContextJson(doc)).not.toContain('secret-key')
  })

  it('kredi için tam taksit tablosu üretir', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: [
        {
          id: 'b1',
          type: 'bank',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { id: 'b1', name: 'Banka', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        },
        {
          id: 'l1',
          type: 'loan',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'l1',
            name: 'Konut',
            bankId: 'b1',
            currency: 'TRY',
            principal: 100_000,
            termMonths: 3,
            interestRate: 0,
            interestPeriod: 'monthly',
            firstInstallmentDate: '2026-02-01T00:00:00.000Z',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
    })

    const sched = doc.schedules.loans[0]
    expect(sched?.installments).toHaveLength(3)
    expect(sched?.installments[0]?.index).toBe(1)
    expect(sched?.remainingDebtBreakdown.accruedLateFees).toBeDefined()
    expect(Number(sched?.remainingDebtBreakdown.accruedLateFees.value)).toBeGreaterThanOrEqual(0)
  })

  it('JSON çıktısında ödenmiş taksitler yok', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: [
        {
          id: 'l1',
          type: 'loan',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'l1',
            name: 'Kredi',
            currency: 'TRY',
            principal: 30_000,
            termMonths: 2,
            interestRate: 0,
            interestPeriod: 'monthly',
            firstInstallmentDate: '2026-06-01T00:00:00.000Z',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
        {
          id: 'p1',
          type: 'loanPayment',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'p1',
            loanId: 'l1',
            installmentIndex: 1,
            paidDate: '2026-06-05T00:00:00.000Z',
            paidAmount: 15_000,
            scheduledAmount: 15_000,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
    })
    const json = formatAiContextJson(doc)
    const parsed = JSON.parse(json) as {
      schedules: { loans: Array<{ installments: Array<{ status: string }> }> }
    }
    expect(parsed.schedules.loans[0]?.installments).toHaveLength(1)
    expect(parsed.schedules.loans[0]?.installments.every((r) => r.status !== 'paid')).toBe(true)
  })

  it('prunePaidInstallments ödenmiş satırları çıkarır', () => {
    const doc = buildAiContextDocument({ profile, includeSensitive: false, rows: [] })
    doc.schedules.loans = [
      {
        loanId: 'l',
        label: 'L',
        currency: 'TRY',
        paidThroughIndex: 1,
        remainingDebt: { value: '0', formatted: '0', currency: 'TRY' },
        remainingDebtBreakdown: {
          unpaidInstallments: { value: '0', formatted: '0', currency: 'TRY' },
          accruedLateFees: { value: '0', formatted: '0', currency: 'TRY' },
        },
        earlyPayoff: { value: '0', formatted: '0', currency: 'TRY' },
        overdueInstallmentCount: 0,
        historicalLatePaymentCount: 0,
        installments: [
          {
            index: 1,
            status: 'paid',
            dueDate: { iso: '2026-01-01', formatted: '01.01.2026' },
            installment: { value: '1', formatted: '1', currency: 'TRY' },
            principal: { value: '1', formatted: '1', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '1', formatted: '1', currency: 'TRY' },
            endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
          },
          {
            index: 2,
            status: 'overdue',
            dueDate: { iso: '2026-03-01', formatted: '01.03.2026' },
            installment: { value: '1', formatted: '1', currency: 'TRY' },
            principal: { value: '1', formatted: '1', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '1', formatted: '1', currency: 'TRY' },
            endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
          },
        ],
      },
    ]
    doc.schedules.installmentAdvances = []
    doc.schedules.creditCards = []
    doc.schedules.creditCardPeriods = []
    doc.schedules.cashAdvancePeriods = []
    doc.summary.asOf = '2026-03-15T00:00:00.000Z'
    const pruned = prunePaidInstallments(doc)
    expect(pruned.schedules.loans[0]?.installments).toHaveLength(1)
    expect(pruned.schedules.loans[0]?.installments[0]?.status).toBe('overdue')
  })

  it('prunePaidInstallments geçmiş ay kredi taksitlerini çıkarır', () => {
    const doc = buildAiContextDocument({ profile, includeSensitive: false, rows: [] })
    doc.summary.asOf = '2026-05-26T00:00:00.000Z'
    doc.schedules.loans = [
      {
        loanId: 'l',
        label: 'L',
        currency: 'TRY',
        paidThroughIndex: 0,
        remainingDebt: { value: '30000', formatted: '30.000', currency: 'TRY' },
        remainingDebtBreakdown: {
          unpaidInstallments: { value: '30000', formatted: '30.000', currency: 'TRY' },
          accruedLateFees: { value: '0', formatted: '0', currency: 'TRY' },
        },
        earlyPayoff: { value: '30000', formatted: '30.000', currency: 'TRY' },
        overdueInstallmentCount: 2,
        historicalLatePaymentCount: 0,
        installments: [
          {
            index: 1,
            status: 'overdue',
            dueDate: { iso: '2026-03-01T00:00:00.000Z', formatted: '01.03.2026' },
            installment: { value: '10000', formatted: '10.000', currency: 'TRY' },
            principal: { value: '10000', formatted: '10.000', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '30000', formatted: '30.000', currency: 'TRY' },
            endingBalance: { value: '20000', formatted: '20.000', currency: 'TRY' },
          },
          {
            index: 2,
            status: 'overdue',
            dueDate: { iso: '2026-04-01T00:00:00.000Z', formatted: '01.04.2026' },
            installment: { value: '10000', formatted: '10.000', currency: 'TRY' },
            principal: { value: '10000', formatted: '10.000', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '20000', formatted: '20.000', currency: 'TRY' },
            endingBalance: { value: '10000', formatted: '10.000', currency: 'TRY' },
          },
          {
            index: 3,
            status: 'overdue',
            dueDate: { iso: '2026-05-01T00:00:00.000Z', formatted: '01.05.2026' },
            installment: { value: '10000', formatted: '10.000', currency: 'TRY' },
            principal: { value: '10000', formatted: '10.000', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '10000', formatted: '10.000', currency: 'TRY' },
            endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
          },
          {
            index: 4,
            status: 'unpaid',
            dueDate: { iso: '2026-06-01T00:00:00.000Z', formatted: '01.06.2026' },
            installment: { value: '10000', formatted: '10.000', currency: 'TRY' },
            principal: { value: '10000', formatted: '10.000', currency: 'TRY' },
            interest: { value: '0', formatted: '0', currency: 'TRY' },
            beginningBalance: { value: '0', formatted: '0', currency: 'TRY' },
            endingBalance: { value: '0', formatted: '0', currency: 'TRY' },
          },
        ],
      },
    ]
    doc.schedules.installmentAdvances = []
    doc.schedules.creditCards = []
    doc.schedules.creditCardPeriods = []
    doc.schedules.cashAdvancePeriods = []
    const pruned = prunePaidInstallments(doc)
    expect(pruned.schedules.loans[0]?.installments.map((r) => r.index)).toEqual([3, 4])
  })

  it('taksitli kart için toplam yükümlülük ve taksit planı üretir', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: [
        {
          id: 'b1',
          type: 'bank',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { id: 'b1', name: 'Banka', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        },
        {
          id: 'c1',
          type: 'creditCard',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'c1',
            name: 'Bonus',
            bankId: 'b1',
            currency: 'TRY',
            limit: 50_000,
            openingBalance: 0,
            statementCutoffDay: 15,
            paymentDueDay: 25,
            purchaseAprMonthly: 0,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
        {
          id: 't1',
          type: 'creditCardTransaction',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 't1',
            cardId: 'c1',
            date: '2026-05-20T10:00:00.000Z',
            amount: 12_000,
            type: 'purchase',
            installmentCount: 12,
            repaymentTotal: 12_000,
            description: 'Telefon',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
    })

    const card = doc.sections.creditCards[0]!
    expect(Number((card.totalCommitted as { value: string }).value)).toBe(12_000)
    expect(Number((card.futureInstallments as { value: string }).value)).toBeGreaterThan(0)
    expect(doc.sections.creditCardTransactions).toHaveLength(0)
    expect(doc.schedules.creditCards).toHaveLength(0)
    expect(doc.schedules.creditCardPeriods.length).toBeGreaterThan(0)
    const periodRows = doc.schedules.creditCardPeriods[0]?.periods ?? []
    expect(periodRows.length).toBeGreaterThan(0)
    expect(
      periodRows.some((r) => Number((r.periodAccruals as { value: string }).value) > 0),
    ).toBe(true)
    expect(doc.meta.contextVersion).toBe(11)
    expect(doc.schedules.creditCardPeriods).toBeDefined()
  })

  it('revolving nakit avans için hesap özeti, hareketler ve ay sonu vadeleri üretir', () => {
    const doc = buildAiContextDocument({
      profile,
      includeSensitive: false,
      rows: [
        {
          id: 'b1',
          type: 'bank',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: { id: 'b1', name: 'Banka', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        },
        {
          id: 'ca1',
          type: 'cashAdvanceAccount',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'ca1',
            name: 'KMH',
            bankId: 'b1',
            currency: 'TRY',
            limit: 30_000,
            openingBalance: 0,
            openingDate: '2026-01-01T00:00:00.000Z',
            interestRate: 0,
            interestPeriod: 'monthly',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
        {
          id: 'cat1',
          type: 'cashAdvanceTransaction',
          updatedAt: '2026-01-01T00:00:00.000Z',
          data: {
            id: 'cat1',
            accountId: 'ca1',
            date: '2026-05-10T10:00:00.000Z',
            amount: 5000,
            type: 'draw',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
    })

    const acc = doc.sections.cashAdvanceAccounts[0]!
    expect(Number((acc.totalDebt as { value: string }).value)).toBe(5000)
    expect(doc.sections.cashAdvanceTransactions).toHaveLength(1)
    expect(doc.schedules.cashAdvancePeriods).toHaveLength(1)
    expect(doc.schedules.cashAdvancePeriods[0]?.periods).toHaveLength(1)
    expect(doc.meta.contextVersion).toBe(11)
  })
})

describe('formatters', () => {
  it('markdown profil adını içerir', () => {
    const doc = buildAiContextDocument({ profile, includeSensitive: false, rows: [] })
    expect(formatAiContextMarkdown(doc)).toContain('Test')
  })

  it('markdown model talimatları JSON yollarına değil belge bölümlerine referans verir', () => {
    const doc = buildAiContextDocument({ profile, includeSensitive: false, rows: [] })
    const md = formatAiContextMarkdown(doc)
    const instructions = md.split('## Özet')[0] ?? md
    expect(instructions).toContain('**Özet**')
    expect(instructions).toContain('**Kart dönem vadeleri**')
    expect(instructions).not.toContain('schedules.')
    expect(instructions).not.toContain('sections.')
    expect(instructions).not.toContain('formatted alan')
    expect(doc.meta.instructionsForModel).toContain('summary')
  })
})
