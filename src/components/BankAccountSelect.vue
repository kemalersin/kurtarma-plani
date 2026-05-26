<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { Button } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import KpSelect from '@/components/KpSelect.vue'
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

const kpSelectRef = useTemplateRef<InstanceType<typeof KpSelect>>('kpSelectRef')
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

function onCreate(): void {
  kpSelectRef.value?.closeSheet()
  emit('create')
}
</script>

<template>
  <KpSelect
    ref="kpSelectRef"
    :value="value"
    :placeholder="placeholder"
    :disabled="disabled"
    show-search
    allow-clear
    :filter-option="filterBankGroupedAccountOption"
    :options="groupedOptions"
    @update:value="update"
  >
    <template v-if="allowCreate" #footer>
      <div class="kp-select-create">
        <Button type="link" block @click="onCreate">
          <template #icon><PlusOutlined /></template>
          {{ createLabel }}
        </Button>
      </div>
    </template>
  </KpSelect>
</template>

<style scoped>
.kp-select-create {
  padding: 0;
}
</style>
