<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { UnorderedListOutlined } from '@ant-design/icons-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import LoanFormDrawer from '@/features/debts/LoanFormDrawer.vue'
import LoanScheduleDrawer from '@/features/debts/LoanScheduleDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type { Bank, Loan, LoanPayment } from '@/core/types/entities'
import { adminPrimaryNameColumn } from '@/features/admin/admin-list-columns'
import { buildScheduleForLoan, paidThroughIndex, remainingDebtForLoan } from './loanHelpers'

const entities = useEntitiesStore()
const { formatCurrency } = useLocaleFormatters()

const loans = entities.list<Loan>('loan')
const payments = entities.list<LoanPayment>('loanPayment')
const banks = entities.list<Bank>('bank')
const loading = entities.loading('loan')

const formOpen = ref(false)
const scheduleOpen = ref(false)
const editing = ref<Loan | null>(null)
const inspecting = ref<Loan | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('loan').value) {
    tasks.push(entities.load<Loan>('loan').catch(() => undefined))
  }
  if (!entities.loaded('loanPayment').value) {
    tasks.push(entities.load<LoanPayment>('loanPayment').catch(() => undefined))
  }
  if (!entities.loaded('bank').value) {
    tasks.push(entities.load<Bank>('bank').catch(() => undefined))
  }
  if (tasks.length) await Promise.all(tasks)
})

function openCreate(): void {
  editing.value = null
  formOpen.value = true
}

function openEdit(loan: Loan): void {
  editing.value = loan
  formOpen.value = true
}

function openSchedule(loan: Loan): void {
  inspecting.value = loan
  scheduleOpen.value = true
}

async function remove(loan: Loan): Promise<void> {
  try {
    await entities.remove('loan', loan.id)
    // İlgili taksit ödemeleri de temizlenir
    const own = payments.value.filter((p) => p.loanId === loan.id)
    for (const p of own) {
      await entities.remove('loanPayment', p.id)
    }
    message.success('Kredi silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

function bankName(id: string): string {
  return banks.value.find((b) => b.id === id)?.name ?? '—'
}

interface LoanSummary {
  installment: string
  remaining: string
  paidCount: number
  totalCount: number
  overdue: number
}

/**
 * Render başına yeniden hesaplanmasın diye basit memoization.
 * Loan + ilişkili ödemelerin değişim imzasını (id + updatedAt) cache anahtarı yapar.
 */
const summaryCache = computed<Map<string, LoanSummary>>(() => {
  const map = new Map<string, LoanSummary>()
  for (const loan of loans.value) {
    const schedule = buildScheduleForLoan(loan)
    const own = payments.value.filter((p) => p.loanId === loan.id)
    const idx = paidThroughIndex(own)
    const remaining = remainingDebtForLoan(loan, schedule, idx, undefined, own)

    const today = new Date()
    const overdue = schedule.rows.filter((r) => {
      if (r.index <= idx) return false
      return differenceInCalendarDays(today, parseISO(r.dueDate)) > 0
    }).length

    map.set(loan.id, {
      installment: schedule.installment,
      remaining,
      paidCount: idx,
      totalCount: schedule.rows.length,
      overdue,
    })
  }
  return map
})

function summary(loan: Loan): LoanSummary {
  return (
    summaryCache.value.get(loan.id) ?? {
      installment: '0',
      remaining: '0',
      paidCount: 0,
      totalCount: 0,
      overdue: 0,
    }
  )
}

function statusLabel(loan: Loan): string {
  const s = summary(loan)
  if (s.overdue > 0) return `${s.overdue} gecikmiş`
  if (s.totalCount > 0 && s.paidCount >= s.totalCount) return 'Kapandı'
  return 'Devam ediyor'
}

function statusKey(loan: Loan): 'overdue' | 'closed' | 'active' {
  const s = summary(loan)
  if (s.overdue > 0) return 'overdue'
  if (s.totalCount > 0 && s.paidCount >= s.totalCount) return 'closed'
  return 'active'
}

const filters = computed<ListFilter<Loan>[]>(() => [
  {
    kind: 'select',
    key: 'status',
    label: 'Durum',
    placeholder: 'Tüm durumlar',
    options: [
      { value: 'active', label: 'Devam ediyor' },
      { value: 'overdue', label: 'Gecikmiş' },
      { value: 'closed', label: 'Kapandı' },
    ],
    getValue: (loan) => statusKey(loan),
  },
  {
    kind: 'numberRange',
    key: 'principal',
    label: 'Anapara',
    numberKind: 'currency',
    getValue: (loan) => loan.principal,
  },
  {
    kind: 'numberRange',
    key: 'installment',
    label: 'Aylık taksit',
    numberKind: 'currency',
    getValue: (loan) => Number(summary(loan).installment),
  },
  {
    kind: 'numberRange',
    key: 'remaining',
    label: 'Kalan borç',
    numberKind: 'currency',
    getValue: (loan) => Number(summary(loan).remaining),
  },
  {
    kind: 'numberRange',
    key: 'term',
    label: 'Vade (ay)',
    numberKind: 'integer',
    getValue: (loan) => loan.termMonths,
  },
  {
    kind: 'dateRange',
    key: 'start',
    label: 'Başlangıç tarihi',
    getValue: (loan) => loan.startDate,
  },
])

const columns = computed<TableColumnType<Loan>[]>(() => [
  adminPrimaryNameColumn<Loan>('Kredi'),
  {
    key: 'bank',
    title: 'Banka',
    customRender: ({ record }) => bankName((record as Loan).bankId),
    sorter: (a, b) => bankName(a.bankId).localeCompare(bankName(b.bankId), 'tr'),
  },
  {
    key: 'principal',
    title: 'Anapara',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as Loan).principal, (record as Loan).currency),
    sorter: (a, b) => a.principal - b.principal,
  },
  {
    key: 'term',
    title: 'Vade',
    align: 'right',
    customRender: ({ record }) => `${(record as Loan).termMonths} ay`,
    sorter: (a, b) => a.termMonths - b.termMonths,
  },
  {
    key: 'installment',
    title: 'Aylık taksit',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(summary(record as Loan).installment, (record as Loan).currency),
  },
  {
    key: 'remaining',
    title: 'Kalan borç',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency(summary(record as Loan).remaining, (record as Loan).currency),
    sorter: (a, b) => Number(summary(a).remaining) - Number(summary(b).remaining),
  },
  {
    key: 'progress',
    title: 'İlerleme',
    customRender: ({ record }) => {
      const s = summary(record as Loan)
      return `${s.paidCount} / ${s.totalCount}`
    },
  },
  {
    key: 'status',
    title: 'Durum',
    customRender: ({ record }) => statusLabel(record as Loan),
    sorter: (a, b) => statusLabel(a).localeCompare(statusLabel(b), 'tr'),
  },
  {
    key: 'archived',
    title: '',
  },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="loans"
      :loading="loading"
      :columns="columns"
      state-key="loans"
      bank-filter
      :banks="banks"
      :filters="filters"
      :search-keys="['name']"
      search-placeholder="Kredi ara…"
      create-label="Yeni kredi"
      empty-text="Henüz kredi eklenmedi."
      row-action-label="Taksit planı"
      :row-action-icon="UnorderedListOutlined"
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
      @row-click="openSchedule"
    />

    <LoanFormDrawer v-model:open="formOpen" :loan="editing" />
    <LoanScheduleDrawer v-model:open="scheduleOpen" :loan="inspecting" />
  </div>
</template>
