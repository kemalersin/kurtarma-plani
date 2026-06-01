<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Alert,
  Form,
  FormItem,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from 'ant-design-vue'
import { useSyncStore } from '@/stores/sync'

const syncStore = useSyncStore()

const unlockCode = ref('')
const submitting = ref(false)

const open = computed({
  get: () => syncStore.relayUnlockModalOpen,
  set: (value: boolean) => {
    syncStore.relayUnlockModalOpen = value
    if (!value) {
      unlockCode.value = ''
    }
  },
})

const limitContext = computed(() => syncStore.relayDeviceLimitContext)
const slotPackages = computed(() => limitContext.value?.slotPackages ?? [])
const limits = computed(() => limitContext.value?.limits)

watch(open, (visible) => {
  if (visible) {
    unlockCode.value = ''
  }
})

async function onSubmit(): Promise<void> {
  submitting.value = true
  try {
    await syncStore.redeemRelayUnlockCode(unlockCode.value)
    message.success('Unlock kodu uygulandı; cihaz limiti güncellendi.')
    open.value = false
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Unlock kodu uygulanamadı.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Modal
    v-model:open="open"
    title="Cihaz slotu — unlock kodu"
    :confirm-loading="submitting"
    ok-text="Uygula"
    cancel-text="Vazgeç"
    :ok-button-props="{ disabled: !unlockCode.trim() }"
    @ok="onSubmit"
  >
    <Space direction="vertical" :size="16" style="width: 100%">
      <Alert
        type="warning"
        show-icon
        message="Cihaz limiti doldu"
        description="Operatörünüzden aldığınız unlock kodunu girerek ek cihaz slotu açabilirsiniz. Ödeme ve paket satın alma bu sürümde yalnızca unlock kodu ile desteklenir."
      />

      <Typography.Text v-if="limits" type="secondary">
        Mevcut: {{ limits.activeDevices }} / {{ limits.maxDevices }} cihaz
        · ücretsiz kotası {{ limits.freeDeviceLimit }}
        <template v-if="limits.purchasedSlots > 0"> · satın alınan +{{ limits.purchasedSlots }}</template>
      </Typography.Text>

      <Typography.Text v-if="slotPackages.length" type="secondary">
        Önerilen paketler (slot): {{ slotPackages.join(', ') }}
      </Typography.Text>

      <Form layout="vertical" :colon="false" @submit.prevent="onSubmit">
        <FormItem label="Unlock kodu" required>
          <Input
            v-model:value="unlockCode"
            placeholder="UNLOCK-XXXX-XXXX"
            :disabled="submitting"
            @press-enter="onSubmit"
          />
        </FormItem>
      </Form>
    </Space>
  </Modal>
</template>
