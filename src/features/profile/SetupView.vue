<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Card,
  Form,
  FormItem,
  Input,
  InputPassword,
  Button,
  Switch,
  Alert,
  Typography,
  message,
} from 'ant-design-vue'
import { useProfileStore } from '@/stores/profile'
import { DEFAULT_LOCALE_SETTINGS } from '@/core/locale/defaults'
import type { LocaleSettings } from '@/core/types/profile'
import LocaleSettingsForm from '@/components/LocaleSettingsForm.vue'
import AppDisclaimer from '@/components/AppDisclaimer.vue'
import { APP_NAME } from '@/core/constants'

const profileStore = useProfileStore()
const router = useRouter()
const submitting = ref(false)

const form = reactive<{
  name: string
  usePassword: boolean
  password: string
  passwordConfirm: string
  locale: LocaleSettings
}>({
  name: 'Varsayılan',
  usePassword: false,
  password: '',
  passwordConfirm: '',
  locale: { ...DEFAULT_LOCALE_SETTINGS },
})

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    message.error('Profil adı boş olamaz.')
    return
  }
  if (form.usePassword) {
    if (form.password.length < 6) {
      message.error('Parola en az 6 karakter olmalıdır.')
      return
    }
    if (form.password !== form.passwordConfirm) {
      message.error('Parolalar eşleşmiyor.')
      return
    }
  }

  submitting.value = true
  try {
    const profile = await profileStore.createProfile({
      name: form.name,
      localeSettings: form.locale,
      password: form.usePassword ? form.password : undefined,
    })
    const ok = await profileStore.selectProfile(profile.id, form.usePassword ? form.password : undefined)
    if (ok) {
      message.success(`Profil oluşturuldu: ${profile.name}`)
      await router.push({ name: 'home' })
    } else {
      message.error('Profil oluşturuldu fakat açılamadı.')
    }
  } catch (error) {
    console.error(error)
    message.error('Profil oluşturulamadı.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="kp-center-page">
    <Card class="kp-card" :title="`${APP_NAME} · Kurulum`">
      <Typography.Paragraph class="kp-text-muted">
        İlk profilinizi oluşturarak başlayalım. Bölgesel ayarları ve isteğe bağlı parolayı
        belirleyebilirsiniz. Verileriniz yalnızca bu cihazda, tarayıcınızın IndexedDB
        veritabanında saklanır.
      </Typography.Paragraph>

      <AppDisclaimer :show-inline="true" />

      <Form layout="vertical" :colon="false" style="margin-top: 16px" @submit.prevent="submit">
        <FormItem label="Profil adı" required>
          <Input v-model:value="form.name" placeholder="Örn. Kişisel, Aile, İşletme…" />
        </FormItem>

        <Typography.Title :level="5" style="margin-top: 8px">Bölgesel ayarlar</Typography.Title>
        <LocaleSettingsForm v-model="form.locale" />

        <Typography.Title :level="5" style="margin-top: 8px">Güvenlik</Typography.Title>
        <FormItem>
          <Switch v-model:checked="form.usePassword" /> &nbsp;
          <span class="kp-text-muted">Bu profil için parola ayarla (isteğe bağlı)</span>
        </FormItem>

        <template v-if="form.usePassword">
          <FormItem label="Parola" required>
            <InputPassword v-model:value="form.password" placeholder="En az 6 karakter" />
          </FormItem>
          <FormItem label="Parola (tekrar)" required>
            <InputPassword v-model:value="form.passwordConfirm" />
          </FormItem>
          <Alert
            type="info"
            show-icon
            message="Parolayı kaybederseniz veriler çözülemez."
            description="Parolayı güvenli bir yerde saklayın. Uygulama parolayı sunucuya göndermez ve geri kazanamaz."
          />
        </template>

        <FormItem style="margin-top: 16px">
          <Button type="primary" html-type="submit" :loading="submitting" block>
            Profili oluştur ve aç
          </Button>
        </FormItem>
      </Form>
    </Card>
  </div>
</template>
