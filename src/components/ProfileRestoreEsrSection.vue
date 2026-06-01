<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  Space,
  Switch,
  Typography,
  message,
} from 'ant-design-vue'
import { CloudSyncOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { useSyncStore } from '@/stores/sync'
import { useProfileStore } from '@/stores/profile'
import { appIdFromEnv, relayUrlFromEnv } from '@/core/types/sync'
import { relayErrorMessageFromUnknown } from '@/core/services/sync/relay-errors'
import { parseEsrPairingInput } from '@/core/services/sync/relay-pairing'

const emit = defineEmits<{
  joined: [profileId: string]
}>()

const syncStore = useSyncStore()
const profileStore = useProfileStore()
const busy = ref(false)

const form = reactive({
  relayUrl: relayUrlFromEnv() ?? '',
  appId: appIdFromEnv() ?? '',
  pairingInput: '',
  namespaceId: '',
  profilePassword: '',
  encryptFile: false,
  useProfilePassword: true,
  syncPassword: '',
})

const parsedPairing = computed(() =>
  parseEsrPairingInput(form.pairingInput, form.namespaceId.trim() || undefined),
)

const needsNamespaceId = computed(
  () => !parsedPairing.value.ok && parsedPairing.value.reason === 'needs-namespace',
)

const profileHasPassword = computed(() => {
  if (!parsedPairing.value.ok) return false
  const id = parsedPairing.value.namespaceId
  return Boolean(profileStore.profiles.find((p) => p.id === id)?.password?.enabled)
})

const useProfilePasswordApplicable = computed(
  () => profileHasPassword.value && form.encryptFile,
)

const useProfilePasswordChecked = computed({
  get: () => useProfilePasswordApplicable.value && form.useProfilePassword,
  set: (checked: boolean) => {
    form.useProfilePassword = checked
  },
})

const syncPasswordLabel = computed(() =>
  useProfilePasswordChecked.value ? 'Profil parolası' : 'Senkron parolası',
)

const canSubmit = computed(
  () =>
    parsedPairing.value.ok &&
    form.relayUrl.trim().length > 0 &&
    form.appId.trim().length > 0 &&
    !busy.value,
)

function validateSetupPassword(): string | null {
  if (!form.encryptFile) return null
  if (useProfilePasswordChecked.value) {
    return form.profilePassword.trim() ? null : 'Profil parolası gerekli.'
  }
  return form.syncPassword.trim().length >= 6
    ? null
    : 'Senkron parolası en az 6 karakter olmalı.'
}

async function onJoin(): Promise<void> {
  if (busy.value) return
  if (!parsedPairing.value.ok) {
    message.warning(parsedPairing.value.message)
    return
  }
  const pwdErr = validateSetupPassword()
  if (pwdErr) {
    message.warning(pwdErr)
    return
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    message.error('Senkronla için çevrimiçi bağlantı gerekli.')
    return
  }

  busy.value = true
  try {
    if (!syncStore.loaded) await syncStore.load()
    const profileId = await syncStore.configureAndJoinRelayFromSetup({
      pairingInput: form.pairingInput,
      namespaceId: form.namespaceId.trim() || undefined,
      profilePassword: form.profilePassword.trim() || undefined,
      relayUrl: form.relayUrl,
      appId: form.appId.trim(),
      encryptFile: form.encryptFile,
      useProfilePassword: useProfilePasswordChecked.value,
      syncPassword: useProfilePasswordChecked.value
        ? undefined
        : form.syncPassword.trim() || undefined,
    })
    emit('joined', profileId)
  } catch (error) {
    message.error(relayErrorMessageFromUnknown(error))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Space direction="vertical" :size="12" style="width: 100%">
    <Alert type="info" show-icon message="İkinci cihaz — host kodu ile kurulum">
      <template #description>
        Host cihazda Ayarlar → Veri → «Cihaz ekle» ile kod veya QR bağlantısı alın. Bu cihazda
        profil otomatik oluşturulur ve veriler
        <a href="https://senkron.la" target="_blank" rel="noopener noreferrer">Senkron.la</a>
        üzerinden çekilir; ayrıca yedek dosyası içe aktarmanız gerekmez.
      </template>
    </Alert>

    <Form layout="vertical" :colon="false" @submit.prevent="onJoin">
      <FormItem label="Eşleştirme kodu veya QR bağlantısı" required>
        <Input
          v-model:value="form.pairingInput"
          placeholder="847291 veya esr://pair/v1/… yapıştırın"
          :disabled="busy"
        />
      </FormItem>

      <FormItem
        v-if="needsNamespaceId"
        label="Profil kimliği (host cihazdan)"
        required
        extra="Host’ta «QR payload kopyala» veya Ayarlar’daki profil kimliği (UUID)."
      >
        <Input
          v-model:value="form.namespaceId"
          placeholder="11111111-1111-4111-8111-111111111111"
          :disabled="busy"
        />
      </FormItem>

      <FormItem label="Relay sunucu adresi" required>
        <Input
          v-model:value="form.relayUrl"
          placeholder="https://sync.example.com/v1"
          :disabled="busy"
        />
      </FormItem>

      <FormItem label="Uygulama kimliği" required>
        <Input
          v-model:value="form.appId"
          placeholder="esr_app_kurtarma_plani"
          :disabled="busy"
        />
        <Typography.Text type="secondary" class="kp-restore-esr-hint">
          App registry açık relay sunucularında zorunludur; host ile aynı değeri kullanın.
        </Typography.Text>
      </FormItem>

      <FormItem>
        <Switch v-model:checked="form.encryptFile" :disabled="busy" />
        &nbsp;
        <span class="kp-text-muted">Senkron verisi parolayla şifreli (host ile aynı ayar)</span>
      </FormItem>

      <FormItem
        v-if="profileHasPassword"
        label="Profil parolası"
        :required="profileHasPassword"
      >
        <InputPassword
          v-model:value="form.profilePassword"
          autocomplete="current-password"
          :disabled="busy"
        />
      </FormItem>

      <template v-if="form.encryptFile">
        <FormItem v-if="useProfilePasswordApplicable">
          <Switch v-model:checked="useProfilePasswordChecked" :disabled="busy" />
          &nbsp;
          <span class="kp-text-muted">Profil parolasını senkron şifrelemesinde kullan</span>
        </FormItem>

        <FormItem
          v-if="!useProfilePasswordChecked"
          :label="syncPasswordLabel"
          required
        >
          <InputPassword
            v-model:value="form.syncPassword"
            autocomplete="new-password"
            placeholder="Host ile aynı senkron parolası"
            :disabled="busy"
          />
        </FormItem>
      </template>

      <Button
        type="primary"
        html-type="submit"
        block
        :loading="busy"
        :disabled="!canSubmit"
      >
        <template #icon><LinkOutlined /></template>
        Senkronla'ya ekle ve veriyi çek
      </Button>
    </Form>

    <Typography.Paragraph class="kp-text-muted kp-restore-esr-foot">
      <CloudSyncOutlined aria-hidden="true" />
      Bağlantı sonrası profil ve kayıtlar relay'den içe aktarılır; çakışma olursa seçim penceresi açılır.
    </Typography.Paragraph>
  </Space>
</template>

<style scoped>
.kp-restore-esr-foot {
  margin-bottom: 0;
  font-size: 13px;
}

.kp-restore-esr-hint {
  display: block;
  margin-top: 4px;
  font-size: 13px;
}

.kp-text-muted {
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-text-muted {
  color: rgba(255, 255, 255, 0.55);
}
</style>
