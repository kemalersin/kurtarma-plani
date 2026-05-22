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
  Checkbox,
  Alert,
  Typography,
  message,
} from 'ant-design-vue'
import { ExperimentOutlined } from '@ant-design/icons-vue'
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
  withSampleData: boolean
  locale: LocaleSettings
}>({
  name: 'Varsayılan',
  usePassword: false,
  password: '',
  passwordConfirm: '',
  withSampleData: false,
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
      if (form.withSampleData) {
        const count = await profileStore.seedActiveProfileSampleData()
        message.success(`Profil oluşturuldu: ${profile.name} (${count} örnek kayıt)`)
      } else {
        message.success(`Profil oluşturuldu: ${profile.name}`)
      }
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

        <label
          class="kp-setup-sample"
          :class="{ 'kp-setup-sample--active': form.withSampleData }"
        >
          <Checkbox v-model:checked="form.withSampleData" class="kp-setup-sample__check" />
          <span class="kp-setup-sample__body">
            <span class="kp-setup-sample__title">
              <ExperimentOutlined class="kp-setup-sample__icon" aria-hidden="true" />
              Örnek verilerle doldur
            </span>
            <span class="kp-setup-sample__desc">
              Bankalar, hesaplar, kredi, kredi kartı, nakit avans ve gelir/gider kayıtları
              eklenir — uygulamayı hızlıca keşfetmek için ideal.
            </span>
          </span>
        </label>

        <Typography.Title :level="5" style="margin-top: 16px">Bölgesel ayarlar</Typography.Title>
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

<style scoped>
.kp-setup-sample {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 4px 0 20px;
  padding: 14px 16px;
  border: 2px solid rgba(22, 119, 255, 0.28);
  border-radius: var(--kp-radius, 8px);
  background: rgba(22, 119, 255, 0.06);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.kp-setup-sample:hover {
  border-color: rgba(22, 119, 255, 0.45);
  background: rgba(22, 119, 255, 0.1);
}

.kp-setup-sample--active {
  border-color: #1677ff;
  background: rgba(22, 119, 255, 0.14);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
}

.kp-setup-sample__check {
  flex-shrink: 0;
  margin-top: 2px;
}

.kp-setup-sample__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.kp-setup-sample__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.88);
}

.kp-setup-sample__icon {
  font-size: 18px;
  color: #1677ff;
}

.kp-setup-sample__desc {
  font-size: 13px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.55);
}

[data-theme='dark'] .kp-setup-sample {
  border-color: rgba(64, 150, 255, 0.35);
  background: rgba(22, 119, 255, 0.12);
}

[data-theme='dark'] .kp-setup-sample:hover {
  border-color: rgba(64, 150, 255, 0.55);
  background: rgba(22, 119, 255, 0.18);
}

[data-theme='dark'] .kp-setup-sample--active {
  border-color: #4096ff;
  background: rgba(22, 119, 255, 0.22);
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.18);
}

[data-theme='dark'] .kp-setup-sample__title {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-setup-sample__icon {
  color: #4096ff;
}

[data-theme='dark'] .kp-setup-sample__desc {
  color: rgba(255, 255, 255, 0.55);
}
</style>
