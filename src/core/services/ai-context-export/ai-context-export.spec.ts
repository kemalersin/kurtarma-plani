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
            firstInstallmentDate: '2025-01-01T00:00:00.000Z',
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
            paidDate: '2025-01-05T00:00:00.000Z',
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
            dueDate: { iso: '2026-02-01', formatted: '01.02.2026' },
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
    const pruned = prunePaidInstallments(doc)
    expect(pruned.schedules.loans[0]?.installments).toHaveLength(1)
    expect(pruned.schedules.loans[0]?.installments[0]?.status).toBe('overdue')
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
    expect(doc.sections.creditCardTransactions).toHaveLength(1)
    expect(doc.schedules.creditCards).toHaveLength(1)
    expect(doc.schedules.creditCards[0]?.installmentCount).toBe(12)
    expect(doc.schedules.creditCardPeriods.length).toBeGreaterThan(0)
    expect(doc.schedules.creditCardPeriods[0]?.periods.length).toBeGreaterThan(0)
    expect(doc.meta.contextVersion).toBe(3)
    expect(doc.schedules.creditCardPeriods).toBeDefined()

    const json = formatAiContextJson(doc)
    const parsed = JSON.parse(json) as {
      schedules: {
        creditCards: Array<{ installments: Array<{ status: string }> }>
      }
    }
    expect(
      parsed.schedules.creditCards[0]?.installments.every((r) => r.status === 'future'),
    ).toBe(true)
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
