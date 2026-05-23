<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Select, Button, Divider } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useEntitiesStore } from '@/stores/entities'
import type { Account, Bank } from '@/core/types/entities'
import {
  buildBankGroupedAccountOptions,
  filterBankGroupedAccountOption,
} from '@/features/admin/accountSelectOptions'

interface Props {
  value?: string
  accounts: Account[]
  placeholder?: string
  allowCreate?: boolean
  createLabel?: string
  disabled?: boolean
  showArchived?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Hesap seçin',
  allowCreate: true,
  createLabel: 'Yeni hesap',
  disabled: false,
  showArchived: false,
})

const emit = defineEmits<{
  (e: 'update:value', value: string | undefined): void
  (e: 'create'): void
}>()

const entities = useEntitiesStore()
const banks = entities.list<Bank>('bank')

onMounted(() => {
  if (!entities.loaded('bank').value) {
    void entities.load<Bank>('bank').catch(() => undefined)
  }
})

const groupedOptions = computed(() =>
  buildBankGroupedAccountOptions(props.accounts, banks.value, props.showArchived),
)

function update(value: unknown): void {
  emit('update:value', value == null ? undefined : String(value))
}
</script>

<template>
  <Select
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    show-search
    :filter-option="filterBankGroupedAccountOption"
    :options="groupedOptions"
    allow-clear
    @update:value="update"
  >
    <template v-if="allowCreate" #dropdownRender="{ menuNode }">
      <component :is="menuNode" />
      <Divider style="margin: 4px 0" />
      <div class="kp-select-create" @mousedown.prevent>
        <Button type="link" block @click="emit('create')">
          <template #icon><PlusOutlined /></template>
          {{ createLabel }}
        </Button>
      </div>
    </template>
  </Select>
</template>

<style scoped>
.kp-select-create {
  padding: 4px 8px;
}
</style>
