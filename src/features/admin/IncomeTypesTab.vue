<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import TypeFormDrawer from '@/features/admin/TypeFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import type { Income, IncomeType } from '@/core/types/entities'
import { parametricTypeNameColumn } from '@/features/admin/admin-list-columns'
import { compareOptionalString } from '@/features/admin/adminListSorters'

const entities = useEntitiesStore()
const items = entities.list<IncomeType>('incomeType')
const incomes = entities.list<Income>('income')
const loading = computed(
  () =>
    entities.loading('incomeType').value || entities.loading('income').value,
)

const drawerOpen = ref(false)
const editing = ref<IncomeType | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('incomeType').value)
    tasks.push(entities.load<IncomeType>('incomeType').catch(() => undefined))
  if (!entities.loaded('income').value)
    tasks.push(entities.load<Income>('income').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

const usedTypeIds = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const i of incomes.value) if (i.incomeTypeId) set.add(i.incomeTypeId)
  return set
})

const filters = computed<ListFilter<IncomeType>[]>(() => [
  {
    kind: 'select',
    key: 'usage',
    label: 'Durum',
    placeholder: 'Tüm türler',
    options: [
      { value: 'used', label: 'Kullanımda' },
      { value: 'unused', label: 'Kullanılmıyor' },
    ],
    getValue: (type) => (usedTypeIds.value.has(type.id) ? 'used' : 'unused'),
  },
])

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openEdit(item: IncomeType): void {
  editing.value = item
  drawerOpen.value = true
}

async function remove(item: IncomeType): Promise<void> {
  try {
    await entities.remove('incomeType', item.id)
    message.success('Gelir türü silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

const columns = computed<TableColumnType<IncomeType>[]>(() => [
  parametricTypeNameColumn<IncomeType>(),
  {
    key: 'color',
    title: 'Renk',
    align: 'center',
    sorter: (a, b) => compareOptionalString(a.color, b.color),
  },
  {
    key: 'archived',
    title: 'Durum',
  },
])
</script>

<template>
  <div class="kp-list-tab-pane">
    <EntityListPage
      :items="items"
      state-key="income"
      search-placeholder="Gelir türü ara…"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['name']"
      create-label="Yeni tür"
      empty-text="Henüz gelir türü eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <TypeFormDrawer
      v-model:open="drawerOpen"
      entity-type="incomeType"
      title="Gelir türü"
      :item="editing"
    />
  </div>
</template>
