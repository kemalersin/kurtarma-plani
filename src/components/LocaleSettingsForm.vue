<script setup lang="ts">
import { computed } from 'vue'
import { Form, FormItem, Select, SelectOption } from 'ant-design-vue'
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_DATE_FORMATS,
  SUPPORTED_LOCALES,
  SUPPORTED_TIMEZONES,
} from '@/core/locale/defaults'
import type { LocaleSettings } from '@/core/types/profile'

const props = defineProps<{ modelValue: LocaleSettings }>()
const emit = defineEmits<{ 'update:modelValue': [value: LocaleSettings] }>()

const value = computed({
  get: () => props.modelValue,
  set: (next: LocaleSettings) => emit('update:modelValue', next),
})

function patch<K extends keyof LocaleSettings>(key: K, next: LocaleSettings[K]): void {
  value.value = { ...value.value, [key]: next }
}

function filterOption(input: string, option: unknown): boolean {
  const opt = option as { children?: unknown }
  const text = String(opt.children ?? '').toLowerCase()
  return text.includes(input.toLowerCase())
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
      <Select
        :value="value.locale"
        show-search
        :filter-option="filterOption"
        @update:value="updateLocale"
      >
        <SelectOption v-for="opt in SUPPORTED_LOCALES" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectOption>
      </Select>
    </FormItem>

    <FormItem label="Para birimi">
      <Select :value="value.currency" @update:value="updateCurrency">
        <SelectOption v-for="opt in SUPPORTED_CURRENCIES" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectOption>
      </Select>
    </FormItem>

    <FormItem label="Saat dilimi">
      <Select
        :value="value.timeZone"
        show-search
        :filter-option="filterOption"
        @update:value="updateTimeZone"
      >
        <SelectOption v-for="opt in SUPPORTED_TIMEZONES" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectOption>
      </Select>
    </FormItem>

    <FormItem label="Tarih formatı">
      <Select :value="value.dateFormat" @update:value="updateDateFormat">
        <SelectOption v-for="opt in SUPPORTED_DATE_FORMATS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectOption>
      </Select>
    </FormItem>
  </Form>
</template>
