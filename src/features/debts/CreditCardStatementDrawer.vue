<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Button,
  Space,
  Empty,
  message,
} from 'ant-design-vue'
import KpSelect from '@/components/KpSelect.vue'
import DismissibleDrawerAlert from '@/components/DismissibleDrawerAlert.vue'
import DrawerDataTable from '@/components/DrawerDataTable.vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import type { KpTableColumn } from '@/core/util/table-columns'
import FormDrawer from '@/components/FormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  CreditCard,
  CreditCardTransaction,
  CreditCardTxnType,
} from '@/core/types/entities'
import {
  buildCardPeriods,
  cardCommittedTotal,
  projectCardPeriodDebts,
  type CardPeriod,
  type PeriodTxn,
} from './cardHelpers'
import { useCreditCardRateContext } from '@/composables/useCreditCardRateContext'

interface Props {
  open: boolean
  card: CreditCard | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()
const { rateContext } = useCreditCardRateContext()

const transactions = entities.list<CreditCardTransaction>('creditCardTransaction')

onMounted(() => {
  if (!entities.loaded('creditCardTransaction').value) {
    void entities.load<CreditCardTransaction>('creditCardTransaction').catch(() => undefined)
  }
})

watch(
  () => props.open,
  (open) => {
    if (open && !entities.loaded('creditCardTransaction').value) {
      void entities.load<CreditCardTransaction>('creditCardTransaction').catch(() => undefined)
    }
  },
)

const periods = computed<CardPeriod[]>(() => {
  if (!props.card) return []
  return buildCardPeriods(props.card, transactions.value, { periods: 6 })
})

const periodProjections = computed(() => {
  if (!props.card || !periods.value.length) return []
  return projectCardPeriodDebts(props.card, transactions.value, {
    periods: periods.value,
    ...rateContext.value,
  })
})

const selectedCutoff = ref<string | undefined>(undefined)

watch(
  () => props.open,
  (open) => {
    if (!open) selectedCutoff.value = undefined
  },
)

/** Hareketler / dönemler geç yüklendiğinde de varsayılan dönem seçilsin. */
watch(
  () => [props.open, props.card?.id, periods.value] as const,
  ([open, , list]) => {
    if (!open || !list.length) return
    const valid = list.some((p) => p.cutoffDate === selectedCutoff.value)
    if (!valid) {
      selectedCutoff.value = list[list.length - 1]!.cutoffDate
    }
  },
  { immediate: true },
)

const activePeriod = computed<CardPeriod | null>(() => {
  if (!selectedCutoff.value) return null
  return periods.value.find((p) => p.cutoffDate === selectedCutoff.value) ?? null
})

const activeProjection = computed(() => {
  if (!selectedCutoff.value) return null
  return periodProjections.value.find((p) => p.cutoffDate === selectedCutoff.value) ?? null
})

const tableRows = computed<PeriodTxn[]>(
  () => activePeriod.value?.transactions ?? [],
)

const cardCommitted = computed(() => {
  if (!props.card) return null
  return cardCommittedTotal(props.card, transactions.value)
})

const periodOptions = computed(() =>
  periods.value.map((p) => ({ value: p.cutoffDate, label: p.label })),
)

const TYPE_LABELS: Record<CreditCardTxnType, string> = {
  purchase: 'Alışveriş',
  payment: 'Ödeme',
  cashAdvance: 'Nakit avans',
}
const TYPE_COLORS: Record<CreditCardTxnType, string> = {
  purchase: 'blue',
  payment: 'green',
  cashAdvance: 'orange',
}

function installmentLabel(row: PeriodTxn): string {
  if (!row.installmentCount) return ''
  return `${row.installmentIndex}/${row.installmentCount} taksit`
}

function descriptionWithInstallment(row: PeriodTxn): string {
  const inst = installmentLabel(row)
  if (!inst) return row.description ?? ''
  return row.description ? `${row.description} · ${inst}` : inst
}

const txnColumns = computed<KpTableColumn<PeriodTxn>[]>(() => [
  {
    key: 'date',
    title: 'Tarih',
    customRender: ({ record }) => formatDate((record as PeriodTxn).date),
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  {
    key: 'type',
    title: 'Tür',
    customRender: ({ record }) => TYPE_LABELS[(record as PeriodTxn).type],
    kpDisplay: (record) => TYPE_LABELS[record.type],
    kpTag: (record) => ({
      color: TYPE_COLORS[record.type],
      label: TYPE_LABELS[record.type],
    }),
  },
  {
    key: 'description',
    title: 'Açıklama',
    customRender: ({ record }) => descriptionWithInstallment(record as PeriodTxn),
    kpDisplay: (record) => descriptionWithInstallment(record),
    ellipsis: { showTitle: false },
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as PeriodTxn).amount, props.card?.currency),
  },
])

function customRowProps(row: PeriodTxn): Record<string, unknown> {
  return {
    onClick: () => openEditForRow(row),
    class: 'kp-txn-row-clickable',
  }
}

const txnOpen = ref(false)
const editing = ref<CreditCardTransaction | null>(null)

function openCreate(): void {
  editing.value = null
  txnOpen.value = true
}

function findOriginal(originalId: string): CreditCardTransaction | null {
  return transactions.value.find((t) => t.id === originalId) ?? null
}

function openEditForRow(row: PeriodTxn): void {
  const original = findOriginal(row.originalTxnId)
  if (!original) {
    message.error('İlgili kart kaydı bulunamadı.')
    return
  }
  editing.value = original
  txnOpen.value = true
}

async function onDeleteRow(row: PeriodTxn): Promise<void> {
  const original = findOriginal(row.originalTxnId)
  if (!original) {
    message.error('Kayıt bulunamadı.')
    return
  }
  try {
    await entities.remove('creditCardTransaction', original.id)
    if (original.installmentCount && original.installmentCount > 1) {
      message.success(
        `Taksitli işlem silindi (${original.installmentCount} taksit dönemden kaldırıldı).`,
      )
    } else {
      message.success('Hareket silindi.')
    }
  } catch {
    message.error('Silinemedi.')
  }
}

const periodStats = computed<KpStat[]>(() => {
  const proj = activeProjection.value
  const p = activePeriod.value
  if (!proj || !p || !props.card) return []
  const ccy = props.card.currency
  const stats: KpStat[] = [
    {
      label: 'Açılış bakiyesi',
      value: formatCurrency(proj.carriedIn, ccy),
      labelTooltip:
        proj.carriedIn > 0
          ? 'Önceki dönemden taşınan ödenmemiş bakiye (gecikme faizi hariç).'
          : undefined,
    },
  ]
  if (proj.lateInterest > 0) {
    stats.push({
      label: 'Gecikme faizi',
      value: formatCurrency(proj.lateInterest, ccy),
      tone: 'danger',
      labelTooltip: 'Asgari altı ödemede ödenmeyen asgari kısma uygulanan gecikme faizi.',
    })
  }
  const akdiTotal = proj.purchaseInterest + proj.cashAdvanceInterest
  if (akdiTotal > 0) {
    stats.push({
      label: 'Akdi faiz',
      value: formatCurrency(akdiTotal, ccy),
      tone: 'warning',
      labelTooltip:
        'Asgari ödendikten sonra kalan bakiyeye (alışveriş ve nakit avans ayrı oranlarla) uygulanan faiz.',
    })
  }
  stats.push(
    {
      label: 'Dönem sonu',
      value: formatCurrency(proj.endingBalance, ccy),
      tone: 'primary',
      labelTooltip: 'Taşınan borç, gecikme faizi, bu dönem tahakkukları ve ödemeler sonrası bakiye.',
    },
    {
      label: 'Asgari ödeme',
      value: formatCurrency(proj.minPayment, ccy),
      tone: 'warning',
    },
    {
      label: 'Son ödeme tarihi',
      value: formatDate(p.dueDate),
    },
  )
  if (cardCommitted.value && Number(cardCommitted.value.future) > 0) {
    stats.push({
      label: 'Toplam yükümlülük',
      value: formatCurrency(cardCommitted.value.committed, ccy),
      tone: 'danger',
    })
  }
  return stats
})
</script>

<template>
  <FormDrawer
    stack-id="credit-card-statement"
    :open="open"
    :title="card ? `${card.name} — hesap özeti` : 'Hesap özeti'"
    width="min(960px, 100vw)"
    :auto-focus-first="false"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="!card">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <DismissibleDrawerAlert
        hint-key="credit-card-statement.info"
        message="Dönem özeti"
        description="Bir dönem, kart hesap kesim tarihinden bir sonrakine kadar olan harcama ve ödemeleri kapsar. Vade sonrası asgari ödendiyse kalan bakiyeye akdi faiz; asgari altı ödemede ödenmeyen asgari kısma gecikme faizi yansır. Kademeli modda oranlar dönem borcuna göre belirlenir. Asgari oran: limit 25.000 TL altı %20, üstü %40."
      />

      <Space :size="12" wrap>
        <KpSelect
          v-model:value="selectedCutoff"
          style="min-width: 220px"
          placeholder="Dönem seçin"
          :options="periodOptions"
        />
        <Button type="primary" @click="openCreate">Yeni hareket</Button>
      </Space>

      <KpStatRow v-if="activePeriod" :items="periodStats" />

      <DrawerDataTable
        table-class="kp-card-txn-table"
        :data-source="tableRows"
        :columns="txnColumns"
        :row-key="(r: PeriodTxn) => r.key"
        :custom-row="customRowProps"
        empty-text="Bu dönemde hareket yok."
        row-actions
        @edit="openEditForRow"
        @delete="onDeleteRow"
      />
    </div>
  </FormDrawer>

  <CreditCardTxnDrawer
    v-model:open="txnOpen"
    :card="card"
    :txn="editing"
  />
</template>
