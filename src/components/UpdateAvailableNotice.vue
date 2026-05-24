<script setup lang="ts">
import { Button } from 'ant-design-vue'
import { CloudDownloadOutlined } from '@ant-design/icons-vue'
import KpNotice from '@/components/KpNotice.vue'
import { APP_VERSION } from '@/core/constants'
import { useUpdateStore } from '@/stores/update'

const updateStore = useUpdateStore()
</script>

<template>
  <div v-if="updateStore.showNotice" class="kp-update-notice-float">
    <KpNotice
      tone="info"
      :title="`Yeni sürüm mevcut: v${updateStore.remoteVersion}`"
      :detail="`Kullandığınız sürüm v${APP_VERSION}. pages dalındaki index.html dosyasını indirip mevcut kopyanızın üzerine yazabilirsiniz.`"
      closable
      @close="updateStore.dismissNotice()"
    >
      <template #action>
        <Button
          v-if="updateStore.releaseUrl"
          size="small"
          type="link"
          class="kp-update-notice__link"
          :href="updateStore.releaseUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <template #icon><CloudDownloadOutlined /></template>
          İndir
        </Button>
      </template>
    </KpNotice>
  </div>
</template>

<style scoped>
.kp-update-notice-float {
  position: fixed;
  top: 16px;
  left: 50%;
  z-index: 1100;
  width: min(calc(100% - 32px), var(--kp-page-max-width, 800px));
  transform: translateX(-50%);
  pointer-events: none;
}

.kp-update-notice-float :deep(.kp-notice) {
  pointer-events: auto;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

[data-theme='dark'] .kp-update-notice-float :deep(.kp-notice) {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}

.kp-update-notice__link {
  padding-inline: 0;
  height: auto;
}
</style>
