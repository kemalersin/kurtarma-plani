<script setup lang="ts">
import type { Component } from 'vue'
import { Button, Popconfirm, Space } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'
import KpTooltip from '@/components/KpTooltip.vue'

withDefaults(
  defineProps<{
    showDelete?: boolean
    deleteTitle?: string
    editLabel?: string
    deleteLabel?: string
    extraLabel?: string
    extraIcon?: Component
  }>(),
  {
    showDelete: true,
    deleteTitle: 'Bu kayıt silinsin mi?',
    editLabel: 'Düzenle',
    deleteLabel: 'Sil',
  },
)

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'extra'): void
}>()
</script>

<template>
  <Space class="kp-table-row-actions" :size="4" @click.stop>
    <KpTooltip v-if="extraIcon && extraLabel" :title="extraLabel">
      <Button type="text" size="small" @click="emit('extra')">
        <template #icon>
          <component :is="extraIcon" />
        </template>
      </Button>
    </KpTooltip>
    <KpTooltip :title="editLabel">
      <Button type="text" size="small" @click="emit('edit')">
        <template #icon><EditOutlined /></template>
      </Button>
    </KpTooltip>
    <Popconfirm
      v-if="showDelete"
      placement="topRight"
      overlay-class-name="kp-popoverlay-edge"
      :title="deleteTitle"
      ok-text="Sil"
      cancel-text="Vazgeç"
      :ok-button-props="{ danger: true }"
      @confirm="emit('delete')"
    >
      <span @click.stop>
        <KpTooltip :title="deleteLabel">
          <Button type="text" size="small" danger>
            <template #icon><DeleteOutlined /></template>
          </Button>
        </KpTooltip>
      </span>
    </Popconfirm>
  </Space>
</template>
