import { describe, expect, it } from 'vitest'
import { computeCostUsd, formatCostUsd } from '@/features/ai/cost'
import type { CatalogModel } from '@/core/types/ai-catalog'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import {
  buildAiFinanceSnapshot,
  buildSystemPrompt,
  buildSnapshotContextContent,
  computeSnapshotFingerprint,
  filterRowsForAiSnapshot,
  isHiddenAiContextMessage,
  stripSecretFields,
} from '@/features/ai/snapshot'

const sampleModel: CatalogModel = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  cost: { input: 0.15, output: 0.6, cache_read: 0.075 },
}

describe('computeCostUsd', () => {
  it('1M input token maliyetini hesaplar', () => {
    expect(computeCostUsd(sampleModel, { inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.15)
  })

  it('cache read token inputtan düşülür', () => {
    const cost = computeCostUsd(sampleModel, {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 500_000,
    })
    expect(cost).toBeCloseTo(0.1125, 4)
  })

  it('model yoksa 0', () => {
    expect(computeCostUsd(undefined, { inputTokens: 1000, outputTokens: 1000 })).toBe(0)
  })
})

describe('formatCostUsd', () => {
  it('küçük tutarları gösterir', () => {
    expect(formatCostUsd(0.0042)).toBe('$0.0042')
  })
})

describe('ai snapshot filter', () => {
  it('hassas ve AI entity tiplerini çıkarır', () => {
    const rows = [
      {
        id: '1',
        type: 'bank' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { name: 'Banka A' },
      },
      {
        id: '2',
        type: 'account' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { iban: 'TR...' },
        sensitive: true,
      },
      {
        id: '3',
        type: 'aiSettings' as const,
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { apiKey: 'secret' },
      },
    ]
    const filtered = filterRowsForAiSnapshot(rows)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.type).toBe('bank')
  })

  it('gizli alanları temizler', () => {
    const cleaned = stripSecretFields({ name: 'x', apiKey: 'k', nested: { token: 't', ok: 1 } })
    expect(cleaned).toEqual({ name: 'x', nested: { ok: 1 } })
  })

  it('şifreli payload (iv/ct) ham hali snapshota girmez', () => {
    const filtered = filterRowsForAiSnapshot([
      {
        id: '1',
        type: 'income',
        updatedAt: '2026-01-01T00:00:00.000Z',
        data: { name: 'Maaş', amount: 50000 },
      },
    ])
    expect(filtered[0]?.data).toEqual({ name: 'Maaş', amount: 50000 })
    expect(JSON.stringify(filtered)).not.toContain('"iv"')
  })

  it('buildAiFinanceSnapshot localeSettings ile türetilmiş kart dönemlerini ekler', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      [
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
            amount: 2000,
            type: 'purchase',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
      DEFAULT_LOCALE_SETTINGS,
    )
    expect(snap.derived?.contextVersion).toBe(11)
    expect(snap.derived?.creditCardPeriods).toHaveLength(1)
    expect(snap.derived?.creditCardPeriods[0]?.periods.length).toBeGreaterThan(0)
    expect(snap.derived?.cashAdvancePeriods).toEqual([])
    expect(snap.entities.some((e) => e.type === 'creditCardTransaction')).toBe(false)
    expect(buildSnapshotContextContent(snap, 'initial')).toContain('creditCardPeriods')
    expect(buildSnapshotContextContent(snap, 'initial')).toContain('cashAdvancePeriods')
    expect(buildSnapshotContextContent(snap, 'initial')).not.toContain('creditCardInstallments')
  })

  it('buildAiFinanceSnapshot profil meta taşır', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      [],
    )
    expect(snap.profile.currency).toBe('TRY')
    expect(snap.entities).toEqual([])
  })

  it('buildSystemPrompt kullanıcı eklentisini sona ekler', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      [],
    )
    const prompt = buildSystemPrompt(snap, '  Madde madde yanıtla.  ')
    expect(prompt).toContain('Kullanıcı talimatları')
    expect(prompt).toContain('Madde madde yanıtla.')
    expect(prompt.endsWith('Madde madde yanıtla.')).toBe(true)
  })

  it('buildSystemPrompt boş eklenti eklenmez', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      [],
    )
    expect(buildSystemPrompt(snap, '   ')).toBe(buildSystemPrompt(snap))
  })

  it('computeSnapshotFingerprint veri değişince farklı olur', () => {
    const base = {
      id: '1',
      type: 'bank' as const,
      updatedAt: '2026-01-01T00:00:00.000Z',
      data: { name: 'A' },
    }
    expect(computeSnapshotFingerprint([base])).not.toBe(
      computeSnapshotFingerprint([{ ...base, updatedAt: '2026-01-02T00:00:00.000Z' }]),
    )
  })

  it('bağlam mesajları UI listesinden gizlenir', () => {
    const snap = buildAiFinanceSnapshot(
      { name: 'Test', currency: 'TRY', locale: 'tr-TR', timeZone: 'Europe/Istanbul' },
      [],
    )
    expect(isHiddenAiContextMessage(buildSnapshotContextContent(snap, 'initial'))).toBe(true)
    expect(isHiddenAiContextMessage('Merhaba')).toBe(false)
  })
})
