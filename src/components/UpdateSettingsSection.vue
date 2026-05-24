<script setup lang="ts">
import { onMounted } from 'vue'
import {
  Button,
  Descriptions,
  DescriptionsItem,
  Space,
  Switch,
  Typography,
  message,
} from 'ant-design-vue'
import { SyncOutlined } from '@ant-design/icons-vue'
import { useLocaleFormatters } from '@/composables/useLocaleFormatters'
import { APP_GITHUB_PAGES_RAW_INDEX_URL, APP_GITHUB_PAGES_TREE_URL, APP_VERSION } from '@/core/constants'
import { useUpdateStore } from '@/stores/update'

const updateStore = useUpdateStore()
const { formatDateLong } = useLocaleFormatters()

onMounted(async () => {
  if (!updateStore.loaded) await updateStore.load()
})

async function onEnabledChange(checked: boolean | string | number): Promise<void> {
  if (!updateStore.loaded) return
  const next = checked === true || checked === 'true' || checked === 1
  try {
    await updateStore.setEnabled(next)
    message.success(next ? 'Otomatik sürüm kontrolü açıldı.' : 'Otomatik sürüm kontrolü kapatıldı.')
    if (next && navigator.onLine) await updateStore.checkForUpdates()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Kaydedilemedi.')
  }
}

async function checkNow(): Promise<void> {
  const outcome = await updateStore.checkForUpdates({ force: true })
  if (outcome.status === 'error') {
    message.error(outcome.message)
    return
  }
  if (outcome.status === 'offline') {
    message.warning('Çevrimdışı; sürüm kontrolü yapılamadı.')
    return
  }
  if (outcome.status === 'update') {
    return
  }
  message.success('Uygulama güncel görünüyor.')
}
</script>

<template>
  <Space direction="vertical" :size="16" style="width: 100%">
    <Typography.Paragraph class="kp-text-muted">
      GitHub deposundaki package.json sürüm numarası ile karşılaştırılır. Otomatik indirme yapılmaz.
    </Typography.Paragraph>

    <div class="kp-update-enable">
      <Switch
        :checked="updateStore.loaded && updateStore.enabled"
        :disabled="!updateStore.loaded || updateStore.checking"
        @change="onEnabledChange"
      />
      <Typography.Text strong>Otomatik güncelleme kontrolü</Typography.Text>
    </div>

    <Descriptions :column="1" size="small" class="kp-update-meta">
      <DescriptionsItem label="Bu cihaz">v{{ APP_VERSION }}</DescriptionsItem>
      <DescriptionsItem label="Uzak sürüm">
        {{ updateStore.remoteVersion ? `v${updateStore.remoteVersion}` : '—' }}
      </DescriptionsItem>
      <DescriptionsItem label="Son kontrol">
        {{
          updateStore.config.lastCheckedAt
            ? formatDateLong(updateStore.config.lastCheckedAt)
            : 'Henüz yapılmadı'
        }}
      </DescriptionsItem>
      <DescriptionsItem label="Derleme">
        <a :href="APP_GITHUB_PAGES_TREE_URL" target="_blank" rel="noopener noreferrer">pages dalı</a>
        ·
        <a :href="APP_GITHUB_PAGES_RAW_INDEX_URL" target="_blank" rel="noopener noreferrer">index.html</a>
      </DescriptionsItem>
    </Descriptions>

    <Button :loading="updateStore.checking" @click="checkNow">
      <template #icon><SyncOutlined /></template>
      Şimdi kontrol et
    </Button>
  </Space>
</template>

<style scoped>
.kp-update-enable {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}

.kp-update-meta :deep(.ant-descriptions-item-label) {
  width: 120px;
}
</style>
