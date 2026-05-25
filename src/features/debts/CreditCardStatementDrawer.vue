<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Button,
  Space,
  Empty,
  Select,
  SelectOption,
  message,
} from 'ant-design-vue'
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
import { buildCardPeriods, type CardPeriod } from './cardHelpers'
import CreditCardTxnDrawer from './CreditCardTxnDrawer.vue'

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

const tableRows = computed<CreditCardTransaction[]>(
  () => activePeriod.value?.transactions ?? [],
)

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

const txnColumns = computed<KpTableColumn<CreditCardTransaction>[]>(() => [
  {
    key: 'date',
    title: 'Tarih',
    customRender: ({ record }) => formatDate((record as CreditCardTransaction).date),
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  {
    key: 'type',
    title: 'Tür',
    customRender: ({ record }) => TYPE_LABELS[(record as CreditCardTransaction).type],
    kpDisplay: (record) => TYPE_LABELS[record.type],
    kpTag: (record) => ({
      color: TYPE_COLORS[record.type],
      label: TYPE_LABELS[record.type],
    }),
  },
  {
    key: 'description',
    title: 'Açıklama',
    dataIndex: 'description',
    ellipsis: { showTitle: false },
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    customRender: ({ record }) =>
      formatCurrency((record as CreditCardTransaction).amount, props.card?.currency),
  },
])

function rowClass(row: CreditCardTransaction): string {
  return `kp-txn-row kp-txn-row--${row.type}`
}

function customRowProps(row: CreditCardTransaction): Record<string, unknown> {
  return {
    onClick: () => openEdit(row),
    class: 'kp-txn-row-clickable',
  }
}
void rowClass

const txnOpen = ref(false)
const editing = ref<CreditCardTransaction | null>(null)

function openCreate(): void {
  editing.value = null
  txnOpen.value = true
}
function openEdit(t: CreditCardTransaction): void {
  editing.value = t
  txnOpen.value = true
}

async function onDeleteTxn(t: CreditCardTransaction): Promise<void> {
  try {
    await entities.remove('creditCardTransaction', t.id)
    message.success('Hareket silindi.')
  } catch {
    message.error('Silinemedi.')
  }
}

const periodStats = computed<KpStat[]>(() => {
  if (!activePeriod.value || !props.card) return []
  const ccy = props.card.currency
  const p = activePeriod.value
  return [
    {
      label: 'Açılış bakiyesi',
      value: formatCurrency(p.openingBalance, ccy),
    },
    {
      label: 'Dönem sonu',
      value: formatCurrency(p.statement.endingBalance, ccy),
      tone: 'primary',
    },
    {
      label: 'Asgari ödeme',
      value: formatCurrency(p.statement.minPayment, ccy),
      tone: 'warning',
    },
    {
      label: 'Son ödeme tarihi',
      value: formatDate(p.dueDate),
    },
  ]
})
</script>

<template>
  <FormDrawer
    stack-id="credit-card-statement"
    :open="open"
    :title="card ? `${card.name} — hesap özeti` : 'Hesap özeti'"
    width="min(960px, 100vw)"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="!card">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <DismissibleDrawerAlert
        hint-key="credit-card-statement.info"
        message="Dönem özeti"
        description="Bir dönem, kart hesap kesim tarihinden bir sonrakine kadar olan harcama ve ödemeleri kapsar. Asgari ödeme; limit 25.000 TL altıysa %20, üstündeyse %40."
      />

      <Space :size="12" wrap>
        <Select
          v-model:value="selectedCutoff"
          style="min-width: 220px"
          placeholder="Dönem seçin"
        >
          <SelectOption v-for="opt in periodOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectOption>
        </Select>
        <Button type="primary" @click="openCreate">Yeni hareket</Button>
      </Space>

      <KpStatRow v-if="activePeriod" :items="periodStats" />

      <DrawerDataTable
        table-class="kp-card-txn-table"
        :data-source="tableRows"
        :columns="txnColumns"
        :row-key="(r: CreditCardTransaction) => r.id"
        :custom-row="customRowProps"
        empty-text="Bu dönemde hareket yok."
        row-actions
        @edit="openEdit"
        @delete="onDeleteTxn"
      />
    </div>
  </FormDrawer>

  <CreditCardTxnDrawer
    v-model:open="txnOpen"
    :card="card"
    :txn="editing"
  />
</template>
