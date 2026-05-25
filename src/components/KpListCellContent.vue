<script lang="ts">
import { defineComponent, type VNode } from 'vue'

/** `customRender` VNode çıktısını tablo hücresinde göstermek için. */
export const KpListCellVnodeHost = defineComponent({
  name: 'KpListCellVnodeHost',
  props: {
    node: { type: Object, required: true },
  },
  render() {
    return this.node as VNode
  },
})
</script>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue'
import type { TableColumnType } from 'ant-design-vue'
import { resolveListCellContent } from '@/core/util/list-cell'

const props = defineProps<{
  column: TableColumnType<T>
  record: T
  index?: number
}>()

const content = computed(() =>
  resolveListCellContent(props.column, props.record, props.index ?? 0),
)
</script>

<template>
  <template v-if="content.kind === 'text'">{{ content.text }}</template>
  <KpListCellVnodeHost v-else-if="content.kind === 'vnode'" :node="content.vnode" />
</template>
