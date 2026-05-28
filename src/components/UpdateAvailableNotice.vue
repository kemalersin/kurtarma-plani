<script setup lang="ts">
import { ref } from 'vue'
import { Button, message } from 'ant-design-vue'
import { CloudDownloadOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import KpNotice from '@/components/KpNotice.vue'
import { APP_VERSION } from '@/core/constants'
import { downloadAppReleaseIndex } from '@/core/util/download'
import { useUpdateStore } from '@/stores/update'
import { applyPwaUpdate, swNeedsRefresh } from '@/core/services/pwa'

const updateStore = useUpdateStore()
const downloading = ref(false)
const reloading = ref(false)

async function downloadRelease(): Promise<void> {
  const url = updateStore.releaseUrl
  if (!url || downloading.value) return

  downloading.value = true
  try {
    const result = await downloadAppReleaseIndex({
      url,
      version: updateStore.remoteVersion ?? 'latest',
    })
    if (result.status === 'downloaded') {
      message.success(`${result.fileName} indirildi.`)
      return
    }
    message.warning('Dosya indirilemedi. Bağlantı yeni sekmede açılıyor.')
  } finally {
    downloading.value = false
  }
}

async function reloadFromServiceWorker(): Promise<void> {
  if (reloading.value) return
  reloading.value = true
  try {
    await applyPwaUpdate()
  } finally {
    reloading.value = false
  }
}
</script>

<template>
  <div v-if="swNeedsRefresh" class="kp-update-notice-float">
    <KpNotice
      tone="info"
      title="Yeni sürüm hazır"
      detail="Uygulamanın yeni sürümü arka planda indirildi. Yenile düğmesine basarak hemen güncelleyebilirsiniz."
    >
      <template #action>
        <Button
          size="small"
          type="link"
          class="kp-update-notice__link"
          :loading="reloading"
          @click="reloadFromServiceWorker"
        >
          <template #icon><ReloadOutlined /></template>
          Yenile
        </Button>
      </template>
    </KpNotice>
  </div>
  <div v-else-if="updateStore.showNotice" class="kp-update-notice-float">
    <KpNotice
      tone="info"
      :title="`Yeni sürüm mevcut: v${updateStore.remoteVersion}`"
      :detail="`Kullandığınız sürüm v${APP_VERSION}. İndir ile güncel index.html dosyasını kaydedip mevcut kopyanızın üzerine yazabilirsiniz.`"
      closable
      @close="updateStore.dismissNotice()"
    >
      <template #action>
        <Button
          v-if="updateStore.releaseUrl"
          size="small"
          type="link"
          class="kp-update-notice__link"
          :loading="downloading"
          @click="downloadRelease"
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
