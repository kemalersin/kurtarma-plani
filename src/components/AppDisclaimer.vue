<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Modal, Button } from 'ant-design-vue'
import KpNotice from '@/components/KpNotice.vue'

const STORAGE_KEY = 'kp.disclaimerAcknowledged.v1'
const BANNER_DISMISS_KEY = 'kp.disclaimerBannerDismissed.v1'

const dismissed = ref(false)
const bannerDismissed = ref(false)
const modalOpen = ref(false)

const props = withDefaults(
  defineProps<{
    showInline?: boolean
    closable?: boolean
  }>(),
  { showInline: true, closable: true },
)

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(STORAGE_KEY) === '1'
    bannerDismissed.value = localStorage.getItem(BANNER_DISMISS_KEY) === '1'
  } catch {
    dismissed.value = false
    bannerDismissed.value = false
  }
  if (!dismissed.value) modalOpen.value = true
})

function acknowledge(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    /* ignore */
  }
  dismissed.value = true
  modalOpen.value = false
}

function dismissBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
  bannerDismissed.value = true
}

function reopen(): void {
  modalOpen.value = true
}

defineExpose({ reopen })
</script>

<template>
  <KpNotice
    v-if="props.showInline && !bannerDismissed"
    tone="legal"
    title="Bu uygulama yalnızca bilgilendirme ve kişisel planlama amaçlıdır."
    detail="Bağlayıcı sonuç için bankanızın sözleşmesi ve resmi mevzuat geçerlidir."
    :closable="props.closable"
    @close="dismissBanner"
  >
    <template #action>
      <Button size="small" type="link" class="kp-notice-link" @click="reopen">
        Detay
      </Button>
    </template>
  </KpNotice>

  <Modal
    v-model:open="modalOpen"
    title="Yasal Uyarı"
    :closable="false"
    :mask-closable="false"
    @ok="acknowledge"
  >
    <template #footer>
      <Button type="primary" @click="acknowledge">Anladım, devam et</Button>
    </template>
    <p>
      <strong>Kurtarma Planı</strong> bir banka, finansal danışman veya yatırım kuruluşu değildir.
      Uygulamadaki hesaplamalar, analizler ve öneriler yalnızca
      <strong>bilgilendirme ve kişisel finansal planlama</strong> amaçlıdır.
    </p>
    <p>
      Bağlayıcı sonuçlar için bankanızın sözleşmesi, ekstresi, TCMB/BDDK tebliğleri ve yürürlükteki
      mevzuat esas alınmalıdır. Uygulamanın çıktıları sebebiyle oluşabilecek herhangi bir maddi veya
      manevi zarardan geliştiriciler sorumlu tutulamaz.
    </p>
    <p class="kp-text-muted" style="margin-bottom: 0">
      Bu mesajı yalnızca bir kez gösteriyoruz. Üst menüden tekrar açabilirsiniz.
    </p>
  </Modal>
</template>

<style scoped>
.kp-notice-link {
  padding-inline: 0;
  height: auto;
}
</style>
