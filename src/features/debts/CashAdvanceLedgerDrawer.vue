<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Tag,
  Button,
  Space,
  Alert,
  Empty,
  message,
} from 'ant-design-vue'
import DrawerDataTable from '@/components/DrawerDataTable.vue'
import KpStatRow, { type KpStat } from '@/components/KpStatRow.vue'
import type { TableColumnType } from 'ant-design-vue'
import FormDrawer from '@/components/FormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import type {
  CashAdvanceAccount,
  CashAdvanceTransaction,
  CashAdvanceTxnType,
} from '@/core/types/entities'
import { cashAdvanceState } from './cashAdvanceHelpers'
import CashAdvanceTxnDrawer from './CashAdvanceTxnDrawer.vue'

interface Props {
  open: boolean
  account: CashAdvanceAccount | null
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const entities = useEntitiesStore()
const { formatCurrency, formatDate } = useLocaleFormatters()

const txns = entities.list<CashAdvanceTransaction>('cashAdvanceTransaction')

const own = computed<CashAdvanceTransaction[]>(() => {
  if (!props.account) return []
  return txns.value
    .filter((t) => t.accountId === props.account!.id)
    .sort((a, b) => b.date.localeCompare(a.date))
})

const state = computed(() => {
  if (!props.account) return null
  return cashAdvanceState(props.account, txns.value)
})

const TYPE_LABELS: Record<CashAdvanceTxnType, string> = {
  draw: 'Kullanım',
  payment: 'Ödeme',
}
const TYPE_COLORS: Record<CashAdvanceTxnType, string> = {
  draw: 'orange',
  payment: 'green',
}

const txnOpen = ref(false)
const editing = ref<CashAdvanceTransaction | null>(null)

function openCreate(): void {
  editing.value = null
  txnOpen.value = true
}
function openEdit(t: CashAdvanceTransaction): void {
  editing.value = t
  txnOpen.value = true
}

async function onDeleteTxn(t: CashAdvanceTransaction): Promise<void> {
  try {
    await entities.remove('cashAdvanceTransaction', t.id)
    message.success('Hareket silindi.')
  } catch {
    message.error('Silinemedi.')
  }
}

const columns = computed<TableColumnType<CashAdvanceTransaction>[]>(() => [
  {
    key: 'date',
    title: 'Tarih',
    minWidth: 112,
    customRender: ({ record }) => formatDate((record as CashAdvanceTransaction).date),
    sorter: (a, b) => a.date.localeCompare(b.date),
    defaultSortOrder: 'descend',
  },
  {
    key: 'type',
    title: 'Tür',
    width: 110,
    customRender: ({ record }) => TYPE_LABELS[(record as CashAdvanceTransaction).type],
  },
  {
    key: 'description',
    title: 'Açıklama',
    dataIndex: 'description',
    minWidth: 160,
    ellipsis: { showTitle: false },
  },
  {
    key: 'amount',
    title: 'Tutar',
    align: 'right',
    minWidth: 120,
    customRender: ({ record }) =>
      formatCurrency((record as CashAdvanceTransaction).amount, props.account?.currency),
  },
])

function customRowProps(row: CashAdvanceTransaction): Record<string, unknown> {
  return {
    onClick: () => openEdit(row),
    class: 'kp-txn-row-clickable',
  }
}

const stats = computed<KpStat[]>(() => {
  if (!props.account) return []
  const ccy = props.account.currency
  const s = state.value
  return [
    {
      label: 'Kalan anapara',
      value: formatCurrency(s?.principal ?? 0, ccy),
      tone: 'primary',
    },
    {
      label: 'İşleyen faiz',
      value: formatCurrency(s?.accruedInterest ?? 0, ccy),
      tone: 'warning',
    },
    {
      label: 'Toplam borç',
      value: formatCurrency(s?.total ?? 0, ccy),
      tone: 'danger',
    },
    {
      label: 'Kullanılabilir',
      value: formatCurrency(props.account.limit - Number(s?.principal ?? 0), ccy),
      tone: 'success',
    },
  ]
})
</script>

<template>
  <FormDrawer
    stack-id="cash-advance-ledger"
    :open="open"
    :title="account ? `${account.name} — hareketler` : 'Nakit avans hareketleri'"
    width="min(880px, 100vw)"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="!account">
      <Empty />
    </div>
    <div v-else class="kp-drawer-table-page">
      <Alert
        type="info"
        show-icon
        message="Revolving hesap"
        description="Kalan anapara üzerinden günlük basit faiz işler. Ödeme önce tahakkuk eden faizi, sonra anaparayı kapatır."
      />

      <KpStatRow :items="stats" />

      <Space :size="8">
        <Button type="primary" @click="openCreate">Yeni hareket</Button>
      </Space>

      <DrawerDataTable
        table-class="kp-ca-txn-table"
        :data-source="own"
        :columns="columns"
        :row-key="(r: CashAdvanceTransaction) => r.id"
        :custom-row="customRowProps"
        :pagination="{ pageSize: 20 }"
        row-actions
        @edit="openEdit"
        @delete="onDeleteTxn"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <Tag :color="TYPE_COLORS[(record as CashAdvanceTransaction).type]">
              {{ TYPE_LABELS[(record as CashAdvanceTransaction).type] }}
            </Tag>
          </template>
        </template>
      </DrawerDataTable>
    </div>
  </FormDrawer>

  <CashAdvanceTxnDrawer
    v-model:open="txnOpen"
    :account="account"
    :txn="editing"
  />
</template>
