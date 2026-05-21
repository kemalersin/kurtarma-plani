<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Alert, Modal, Button } from 'ant-design-vue'

const STORAGE_KEY = 'kp.disclaimerAcknowledged.v1'

const dismissed = ref(false)
const modalOpen = ref(false)

const props = withDefaults(
  defineProps<{
    showInline?: boolean
  }>(),
  { showInline: true },
)

onMounted(() => {
  try {
    dismissed.value = localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    dismissed.value = false
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

function reopen(): void {
  modalOpen.value = true
}

defineExpose({ reopen })
</script>

<template>
  <Alert
    v-if="props.showInline"
    type="warning"
    show-icon
    banner
    message="Bu uygulama yalnızca bilgilendirme ve kişisel planlama amaçlıdır. Bağlayıcı sonuç için bankanızın sözleşmesi ve resmi mevzuat geçerlidir."
  >
    <template #action>
      <Button size="small" type="link" @click="reopen">Detay</Button>
    </template>
  </Alert>

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
