import type {
  AiContextDocument,
  InstallmentAdvanceScheduleExport,
  LoanScheduleExport,
  MoneyField,
} from '@/core/services/ai-context-export/types'

function mdMoney(m: MoneyField | undefined): string {
  return m?.formatted ?? '—'
}

function scheduleTable(
  title: string,
  sched: LoanScheduleExport | InstallmentAdvanceScheduleExport,
): string {
  const pending = sched.installments.filter((row) => row.status !== 'paid')
  const lines: string[] = [
    `### ${title}`,
    '',
    `- Kalan borç: ${mdMoney(sched.remainingDebt)} (taksitler: ${mdMoney(sched.remainingDebtBreakdown.unpaidInstallments)} + gecikme faizi: ${mdMoney(sched.remainingDebtBreakdown.accruedLateFees)})`,
    `- Erken kapama (bugün): ${mdMoney(sched.earlyPayoff)}`,
    `- Ödenen taksit sayısı (ardışık): ${sched.paidThroughIndex}`,
    `- Vadesi geçmiş ödenmemiş taksit: ${sched.overdueInstallmentCount}`,
    `- Geç ödenmiş taksit (tarihsel): ${sched.historicalLatePaymentCount}`,
    '',
    '| # | Vade | Taksit | Anapara | Faiz | Durum | Ödeme tarihi |',
    '|---:|---|---:|---:|---:|---|---|',
  ]
  for (const row of pending) {
    lines.push(
      `| ${row.index} | ${row.dueDate.formatted} | ${row.installment.formatted} | ${row.principal.formatted} | ${row.interest.formatted} | ${row.status} | ${row.paidDate?.formatted ?? '—'} |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}

export function formatAiContextMarkdown(doc: AiContextDocument): string {
  const { meta, summary, sections, schedules, omitted, references } = doc
  const lines: string[] = [
    '# Kurtarma Planı — Finans Bağlamı',
    '',
    `> **Profil:** ${meta.profileName} · **Para birimi:** ${meta.locale.currency} · **Oluşturulma:** ${summary.asOfFormatted}`,
    `> ${meta.disclaimer}`,
    '',
    '## Model talimatları',
    '',
    meta.instructionsForModel,
    '',
    '## Özet',
    '',
    '| Metrik | Değer |',
    '|---|---|',
    `| Net varlık | ${summary.netWorth.formatted} |`,
    `| Toplam varlık | ${summary.totalAssets.formatted} |`,
    `| Toplam borç | ${summary.totalDebts.formatted} |`,
    `| Krediler | ${summary.debtByType.loans.formatted} |`,
    `| Kredi kartları | ${summary.debtByType.creditCards.formatted} |`,
    `| Nakit avans | ${summary.debtByType.cashAdvances.formatted} |`,
    `| Taksitli avans | ${summary.debtByType.installmentAdvances.formatted} |`,
    '',
    '**Taksit gecikmesi:**',
    `- Vadesi geçmiş ödenmemiş taksit (toplam): ${summary.delinquency.totalOverdueInstallments}`,
    `- Geç ödenmiş taksit (tarihsel): ${summary.delinquency.totalHistoricalLatePayments}`,
    '',
    '**Nakit akışı dikkat:**',
    `- Gecikmiş gelir: ${summary.cashflowAttention.overdueIncomes}`,
    `- Yaklaşan gelir (7 gün): ${summary.cashflowAttention.dueIncomes}`,
    `- Gecikmiş gider: ${summary.cashflowAttention.overdueExpenses}`,
    `- Yaklaşan gider (7 gün): ${summary.cashflowAttention.dueExpenses}`,
    '',
    '## Hariç tutulanlar',
    '',
    `- Arşivlenmiş kayıt: ${omitted.archivedRecordCount}`,
    `- Hassas kayıt (bu dışa aktarımda): ${omitted.sensitiveRecordCount}`,
    `- ${omitted.note}`,
    '',
    '## Referanslar',
    '',
    `**Bankalar:** ${references.banks.map((b) => b.name).join(', ') || '—'}`,
    '',
  ]

  if (sections.accounts.length) {
    lines.push('## Hesaplar', '', '| Hesap | Tür | Bakiye |', '|---|---|---:|')
    for (const a of sections.accounts) {
      const bal = (a.balance as MoneyField | undefined)?.formatted ?? '—'
      lines.push(`| ${a.label} | ${a.typeLabel} | ${bal} |`)
    }
    lines.push('')
  }

  if (sections.cashRegisters.length) {
    lines.push('## Kasalar', '', '| Kasa | Bakiye |', '|---|---:|')
    for (const r of sections.cashRegisters) {
      const bal = (r.balance as MoneyField | undefined)?.formatted ?? '—'
      lines.push(`| ${r.name} | ${bal} |`)
    }
    lines.push('')
  }

  if (sections.loans.length) {
    lines.push('## Krediler', '', '| Kredi | Kalan | Erken kapama |', '|---|---:|---:|')
    for (const l of sections.loans) {
      lines.push(
        `| ${l.label} | ${mdMoney(l.remainingDebt as MoneyField)} | ${mdMoney(l.earlyPayoff as MoneyField)} |`,
      )
    }
    lines.push('')
  }

  for (const sched of schedules.loans) {
    lines.push(scheduleTable(`Kredi taksit planı: ${sched.label}`, sched))
  }

  if (sections.creditCards.length) {
    lines.push('## Kredi kartları', '', '| Kart | Borç | Asgari | Limit |', '|---|---:|---:|---:|')
    for (const c of sections.creditCards) {
      lines.push(
        `| ${c.label} | ${mdMoney(c.balance as MoneyField)} | ${mdMoney(c.minPayment as MoneyField)} | ${mdMoney(c.limit as MoneyField)} |`,
      )
    }
    lines.push('')
  }

  if (sections.installmentAdvances.length) {
    lines.push(
      '## Taksitli nakit avans',
      '',
      '| Avans | Kalan | Erken kapama |',
      '|---|---:|---:|',
    )
    for (const a of sections.installmentAdvances) {
      lines.push(
        `| ${a.label} | ${mdMoney(a.remainingDebt as MoneyField)} | ${mdMoney(a.earlyPayoff as MoneyField)} |`,
      )
    }
    lines.push('')
  }

  for (const sched of schedules.installmentAdvances) {
    lines.push(scheduleTable(`Taksitli avans planı: ${sched.label}`, sched))
  }

  if (sections.incomes.length) {
    lines.push('## Gelirler', '', '| Açıklama | Hedef | Tutar | Plan | Durum |', '|---|---|---:|---|---|')
    for (const i of sections.incomes) {
      lines.push(
        `| ${i.description ?? '—'} | ${i.target} | ${mdMoney(i.amount as MoneyField)} | ${(i.plannedDate as { formatted: string })?.formatted ?? '—'} | ${i.statusLabel} |`,
      )
    }
    lines.push('')
  }

  if (sections.expenses.length) {
    lines.push('## Giderler', '', '| Açıklama | Kaynak | Tutar | Plan | Durum |', '|---|---|---:|---|---|')
    for (const e of sections.expenses) {
      lines.push(
        `| ${e.description ?? '—'} | ${e.source} | ${mdMoney(e.amount as MoneyField)} | ${(e.plannedDate as { formatted: string })?.formatted ?? '—'} | ${e.statusLabel} |`,
      )
    }
    lines.push('')
  }

  if (sections.transfers.length) {
    lines.push('## Transferler', '', '| Kaynak | Hedef | Tutar | Tarih |', '|---|---|---:|---|')
    for (const t of sections.transfers) {
      lines.push(
        `| ${t.from} | ${t.to} | ${mdMoney(t.amount as MoneyField)} | ${(t.date as { formatted: string })?.formatted ?? '—'} |`,
      )
    }
    lines.push('')
  }

  lines.push(
    '## Sözlük (kısaltmalar)',
    '',
    ...Object.entries(doc.glossary).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '---',
    '',
    `*${meta.purpose}*`,
  )

  return lines.join('\n')
}
