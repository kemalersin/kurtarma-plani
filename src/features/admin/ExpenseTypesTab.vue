<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { TableColumnType } from 'ant-design-vue'
import EntityListPage, { type ListFilter } from '@/components/EntityListPage.vue'
import TypeFormDrawer from '@/features/admin/TypeFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import type { Expense, ExpenseType } from '@/core/types/entities'
import { parametricTypeNameColumn } from '@/features/admin/admin-list-columns'

const entities = useEntitiesStore()
const items = entities.list<ExpenseType>('expenseType')
const expenses = entities.list<Expense>('expense')
const loading = entities.loading('expenseType')

const drawerOpen = ref(false)
const editing = ref<ExpenseType | null>(null)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('expenseType').value)
    tasks.push(entities.load<ExpenseType>('expenseType').catch(() => undefined))
  if (!entities.loaded('expense').value)
    tasks.push(entities.load<Expense>('expense').catch(() => undefined))
  if (tasks.length) await Promise.all(tasks)
})

const usedTypeIds = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const e of expenses.value) if (e.expenseTypeId) set.add(e.expenseTypeId)
  return set
})

const filters = computed<ListFilter<ExpenseType>[]>(() => [
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

function openEdit(item: ExpenseType): void {
  editing.value = item
  drawerOpen.value = true
}

async function remove(item: ExpenseType): Promise<void> {
  try {
    await entities.remove('expenseType', item.id)
    message.success('Gider türü silindi.')
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Silinemedi.')
  }
}

const columns = computed<TableColumnType<ExpenseType>[]>(() => [
  parametricTypeNameColumn<ExpenseType>(),
  {
    key: 'color',
    title: 'Renk',
    align: 'center',
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
      state-key="expense"
      search-placeholder="Gider türü ara…"
      :loading="loading"
      :columns="columns"
      :filters="filters"
      :search-keys="['name']"
      create-label="Yeni tür"
      empty-text="Henüz gider türü eklenmedi."
      @create="openCreate"
      @edit="openEdit"
      @delete="remove"
    />

    <TypeFormDrawer
      v-model:open="drawerOpen"
      entity-type="expenseType"
      title="Gider türü"
      :item="editing"
    />
  </div>
</template>
