<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Alert,
  Button,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
  message,
} from 'ant-design-vue'
import { LockOutlined, UnlockOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()
const profile = computed(() => profileStore.activeProfile)
const hasPassword = computed(() => !!profile.value?.password.enabled)

type Mode = 'set' | 'change' | 'clear'

const modalOpen = ref(false)
const mode = ref<Mode | null>(null)
const submitting = ref(false)

const form = reactive({
  current: '',
  next: '',
  confirm: '',
})

function resetForm(): void {
  form.current = ''
  form.next = ''
  form.confirm = ''
}

function open(next: Mode): void {
  resetForm()
  mode.value = next
  modalOpen.value = true
}

function close(): void {
  modalOpen.value = false
}

function afterClose(): void {
  mode.value = null
  resetForm()
}

const modalTitle = computed(() => {
  switch (mode.value) {
    case 'set':
      return 'Profile parola ekle'
    case 'change':
      return 'Parolayı değiştir'
    case 'clear':
      return 'Parolayı kaldır'
    default:
      return ''
  }
})

async function submit(): Promise<void> {
  submitting.value = true
  try {
    if (mode.value === 'set') {
      if (form.next.length < 6) {
        message.error('Parola en az 6 karakter olmalı.')
        return
      }
      if (form.next !== form.confirm) {
        message.error('Parolalar eşleşmiyor.')
        return
      }
      const res = await profileStore.setPassword(null, form.next)
      if (!res.ok) {
        message.error(res.error)
        return
      }
      message.success('Parola ayarlandı.')
      close()
      return
    }

    if (mode.value === 'change') {
      if (!form.current) {
        message.error('Mevcut parola gerekli.')
        return
      }
      if (form.next.length < 6) {
        message.error('Yeni parola en az 6 karakter olmalı.')
        return
      }
      if (form.next !== form.confirm) {
        message.error('Yeni parolalar eşleşmiyor.')
        return
      }
      const res = await profileStore.setPassword(form.current, form.next)
      if (!res.ok) {
        message.error(res.error)
        return
      }
      message.success('Parola değiştirildi.')
      close()
      return
    }

    if (mode.value === 'clear') {
      if (!form.current) {
        message.error('Mevcut parola gerekli.')
        return
      }
      const res = await profileStore.clearPassword(form.current)
      if (!res.ok) {
        message.error(res.error)
        return
      }
      message.success('Parola kaldırıldı.')
      close()
      return
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <Space align="center" style="width: 100%; justify-content: space-between">
      <div>
        <Typography.Text strong>Profil parolası</Typography.Text>
        <div style="margin-top: 4px">
          <Tag v-if="hasPassword" color="blue">
            <template #icon><LockOutlined /></template>
            Parolalı
          </Tag>
          <Tag v-else>
            <template #icon><UnlockOutlined /></template>
            Parolasız
          </Tag>
        </div>
      </div>

      <Space>
        <Button v-if="!hasPassword" type="primary" @click="open('set')">
          <template #icon><KeyOutlined /></template>
          Parola ekle
        </Button>
        <Button v-if="hasPassword" type="primary" @click="open('change')">
          <template #icon><KeyOutlined /></template>
          Parolayı değiştir
        </Button>
        <Popconfirm
          v-if="hasPassword"
          title="Parolayı kaldırmak istediğinize emin misiniz?"
          description="Profil verileriniz parolasız olarak saklanacak."
          ok-text="Devam"
          cancel-text="Vazgeç"
          @confirm="open('clear')"
        >
          <Button danger>Parolayı kaldır</Button>
        </Popconfirm>
      </Space>
    </Space>

    <Alert
      style="margin-top: 12px"
      type="info"
      show-icon
      message="Parola değiştirildiğinde veya kaldırıldığında, profil verileriniz yeni durumla yeniden şifrelenir."
      description="Parolayı kaybederseniz şifreli veriler geri kazanılamaz. Lütfen güvenli bir yerde saklayın."
    />

    <Modal
      :open="modalOpen"
      :title="modalTitle"
      :confirm-loading="submitting"
      :ok-text="mode === 'clear' ? 'Parolayı kaldır' : 'Kaydet'"
      cancel-text="Vazgeç"
      :ok-button-props="{ danger: mode === 'clear' }"
      :mask-closable="!submitting"
      @ok="submit"
      @cancel="close"
      @after-close="afterClose"
    >
      <Form layout="vertical" :colon="false" @submit.prevent="submit">
        <FormItem
          v-if="mode === 'change' || mode === 'clear'"
          label="Mevcut parola"
          required
        >
          <InputPassword v-model:value="form.current" autofocus />
        </FormItem>

        <template v-if="mode === 'set' || mode === 'change'">
          <FormItem label="Yeni parola" required>
            <InputPassword v-model:value="form.next" placeholder="En az 6 karakter" />
          </FormItem>
          <FormItem label="Yeni parola (tekrar)" required>
            <InputPassword v-model:value="form.confirm" />
          </FormItem>
        </template>

        <Alert
          v-if="mode === 'clear'"
          type="warning"
          show-icon
          message="Parolayı kaldırırsanız bu profilin verileri şifrelenmeden saklanır."
        />
      </Form>
    </Modal>
  </div>
</template>
