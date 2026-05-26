<script setup lang="ts">
import { computed } from 'vue'
import { Form, FormItem } from 'ant-design-vue'
import KpSelect from '@/components/KpSelect.vue'
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_LOCALES,
  SUPPORTED_TIMEZONES,
} from '@/core/locale/defaults'
import type { LocaleSettings } from '@/core/types/profile'
import { defaultFilterSelectOption } from '@/core/util/select-options'

const props = defineProps<{ modelValue: LocaleSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: LocaleSettings] }>()

const value = computed({
  get: () => props.modelValue,
  set: (next: LocaleSettings) => emit('update:modelValue', next),
})

function patch<K extends keyof LocaleSettings>(key: K, next: LocaleSettings[K]): void {
  value.value = { ...value.value, [key]: next }
}

function updateLocale(v: unknown): void {
  patch('locale', String(v) as LocaleSettings['locale'])
}

function updateCurrency(v: unknown): void {
  patch('currency', String(v) as LocaleSettings['currency'])
}

function updateTimeZone(v: unknown): void {
  patch('timeZone', String(v) as LocaleSettings['timeZone'])
}

function updateDateFormat(v: unknown): void {
  patch('dateFormat', String(v))
}
</script>

<template>
  <Form layout="vertical" :colon="false">
    <FormItem label="Dil / bölge">
      <KpSelect
        :value="value.locale"
        show-search
        :filter-option="defaultFilterSelectOption"
        :options="SUPPORTED_LOCALES"
        @update:value="updateLocale"
      />
    </FormItem>

    <FormItem label="Para birimi">
      <KpSelect :value="value.currency" :options="SUPPORTED_CURRENCIES" @update:value="updateCurrency" />
    </FormItem>

    <FormItem label="Saat dilimi">
      <KpSelect
        :value="value.timeZone"
        show-search
        :filter-option="defaultFilterSelectOption"
        :options="SUPPORTED_TIMEZONES"
        @update:value="updateTimeZone"
      />
    </FormItem>

    <FormItem label="Tarih formatı">
      <KpSelect
        :value="value.dateFormat"
        :options="SUPPORTED_DATE_FORMATS"
        @update:value="updateDateFormat"
      />
    </FormItem>
  </Form>
</template>
