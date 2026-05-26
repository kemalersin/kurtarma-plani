<script setup lang="ts">
import { computed } from 'vue'
import { FormItem, Space, Switch, Typography } from 'ant-design-vue'
import KpSelect from '@/components/KpSelect.vue'
import {
  RECURRENCE_LABELS,
  RecurrenceIntervals,
  type RecurrenceInterval,
} from '@/core/types/recurrence'

const recurring = defineModel<boolean>('recurring', { default: false })
const interval = defineModel<RecurrenceInterval | undefined>('interval')
const realized = defineModel<boolean>('realized', { default: false })

const intervalOptions = computed(() =>
  RecurrenceIntervals.map((value) => ({
    value,
    label: RECURRENCE_LABELS[value],
  })),
)
</script>

<template>
  <FormItem class="kp-recurrence-row">
    <Space :size="24" wrap align="center">
      <Space :size="8" align="center">
        <Typography.Text>Yinelenen</Typography.Text>
        <Switch v-model:checked="recurring" />
      </Space>
      <Space v-if="!recurring" :size="8" align="center">
        <Typography.Text>Gerçekleşti</Typography.Text>
        <Switch v-model:checked="realized" />
      </Space>
    </Space>
  </FormItem>

  <FormItem v-if="recurring" label="Yinelenme aralığı" required>
    <KpSelect
      v-model:value="interval"
      :options="intervalOptions"
      placeholder="Aralık seçin"
    />
  </FormItem>

  <Typography.Paragraph v-if="recurring" type="secondary" class="kp-recurrence-hint">
    Yinelenen kayıtlar otomatik gerçekleşmiş sayılır; plan tarihi ilk yinelenmedir.
  </Typography.Paragraph>
</template>

<style scoped>
.kp-recurrence-row :deep(.ant-form-item-control-input) {
  min-height: auto;
}

.kp-recurrence-hint {
  margin: -4px 0 8px;
  font-size: 12px;
}
</style>
