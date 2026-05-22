<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { FormItem, RadioGroup, Space, message } from 'ant-design-vue'
import SelectWithCreate from '@/components/SelectWithCreate.vue'
import AccountFormDrawer from '@/features/admin/AccountFormDrawer.vue'
import CashRegisterFormDrawer from '@/features/admin/CashRegisterFormDrawer.vue'
import { useEntitiesStore } from '@/stores/entities'
import { useProfileStore } from '@/stores/profile'
import type { Account, CashRegister } from '@/core/types/entities'

/**
 * Borç ödemesi / kart hareketi formlarında "Hangi hesaptan?" alanı.
 * `v-model:accountId` ve `v-model:cashRegisterId` ile iki ayrı update,
 * radio seçimine göre yalnız biri dolu olur.
 *
 * `kind` etiketleri özelleştirir:
 *   - `'source'`  → "Ödendiği hesap / kasa" (default)
 *   - `'target'`  → "Çekilen nakit hesabı / kasası"
 */
type Kind = 'source' | 'target'

interface Props {
  accountId?: string
  cashRegisterId?: string
  /** Etiket varyantı (yön) */
  kind?: Kind
  /** Form alanı zorunlu mu? (yalnız `*` gösterir) */
  required?: boolean
  /** Üst etiket. Boş → kind'a göre default. */
  label?: string
  /** Etiketin yanına bilgi metni (KpTooltip yerine basit hint). */
  hint?: string
}

const props = withDefaults(defineProps<Props>(), {
  accountId: undefined,
  cashRegisterId: undefined,
  kind: 'source',
  required: false,
  label: '',
  hint: '',
})

const emit = defineEmits<{
  (e: 'update:accountId', value: string | undefined): void
  (e: 'update:cashRegisterId', value: string | undefined): void
}>()

const entities = useEntitiesStore()
const profileStore = useProfileStore()
const accounts = entities.list<Account>('account')
const registers = entities.list<CashRegister>('cashRegister')

const sourcesLoading = computed(
  () => entities.loading('account').value || entities.loading('cashRegister').value,
)

async function ensureSourcesLoaded(): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (!entities.loaded('account').value) {
    tasks.push(entities.load<Account>('account').catch(() => undefined))
  }
  if (!entities.loaded('cashRegister').value) {
    tasks.push(entities.load<CashRegister>('cashRegister').catch(() => undefined))
  }
  if (tasks.length) await Promise.all(tasks)
}

onMounted(() => {
  void ensureSourcesLoaded()
})

watch(
  () => profileStore.activeProfileId,
  () => {
    void ensureSourcesLoaded()
  },
)

const profileCurrency = computed(
  () => profileStore.activeProfile?.localeSettings.currency ?? 'TRY',
)

function isCompatibleCurrency(currency: string): boolean {
  return currency === profileCurrency.value
}

/**
 * **Kural** (kurtarma-plani-core / cross-currency):
 * Borç ödemesi / nakit çekimi yalnız profil para birimindeki hesap-kasa ile yapılır.
 * Dövizli kayıtlar listede ve «Yeni kayıt» akışında sunulmaz.
 */
const compatibleAccounts = computed<Account[]>(() =>
  accounts.value.filter((a) => isCompatibleCurrency(a.currency) && !a.archived),
)

const compatibleRegisters = computed<CashRegister[]>(() =>
  registers.value.filter((r) => isCompatibleCurrency(r.currency) && !r.archived),
)

/** Dövizli mevcut seçim varsa temizle (eski kayıt / hatalı oluşturma). */
function clearIncompatibleSelection(): void {
  if (props.accountId) {
    const acc = accounts.value.find((a) => a.id === props.accountId)
    if (acc && !isCompatibleCurrency(acc.currency)) {
      emit('update:accountId', undefined)
    }
  }
  if (props.cashRegisterId) {
    const reg = registers.value.find((r) => r.id === props.cashRegisterId)
    if (reg && !isCompatibleCurrency(reg.currency)) {
      emit('update:cashRegisterId', undefined)
    }
  }
}

watch(
  () => [accounts.value.length, registers.value.length, props.accountId, props.cashRegisterId] as const,
  () => clearIncompatibleSelection(),
)

type Endpoint = 'account' | 'cashRegister'

const endpointOptions: { value: Endpoint; label: string }[] = [
  { value: 'account', label: 'Banka hesabı' },
  { value: 'cashRegister', label: 'Kasa' },
]

const endpoint = ref<Endpoint>(props.cashRegisterId ? 'cashRegister' : 'account')

watch(
  () => [props.accountId, props.cashRegisterId] as const,
  ([a, c]) => {
    if (a) endpoint.value = 'account'
    else if (c) endpoint.value = 'cashRegister'
  },
)

function setAccount(value: string | undefined): void {
  if (value) {
    const acc = accounts.value.find((a) => a.id === value)
    if (acc && !isCompatibleCurrency(acc.currency)) {
      message.warning(
        `Borç ödemesi için yalnız ${profileCurrency.value} hesap seçilebilir.`,
      )
      return
    }
  }
  emit('update:accountId', value)
  if (value) emit('update:cashRegisterId', undefined)
}

function setRegister(value: string | undefined): void {
  if (value) {
    const reg = registers.value.find((r) => r.id === value)
    if (reg && !isCompatibleCurrency(reg.currency)) {
      message.warning(
        `Borç ödemesi için yalnız ${profileCurrency.value} kasa seçilebilir.`,
      )
      return
    }
  }
  emit('update:cashRegisterId', value)
  if (value) emit('update:accountId', undefined)
}

function onEndpointChange(next: Endpoint): void {
  endpoint.value = next
  if (next === 'account') emit('update:cashRegisterId', undefined)
  else emit('update:accountId', undefined)
}

const accountDrawerOpen = ref(false)
const registerDrawerOpen = ref(false)

function onAccountSaved(a: Account): void {
  if (!isCompatibleCurrency(a.currency)) {
    message.warning(
      `Borç ödemesi için yalnız ${profileCurrency.value} hesap kullanılabilir.`,
    )
    return
  }
  setAccount(a.id)
}

function onRegisterSaved(r: CashRegister): void {
  if (!isCompatibleCurrency(r.currency)) {
    message.warning(
      `Borç ödemesi için yalnız ${profileCurrency.value} kasa kullanılabilir.`,
    )
    return
  }
  setRegister(r.id)
}

const defaultLabel = computed(() =>
  props.kind === 'target' ? 'Yatırılacak hesap / kasa' : 'Ödendiği hesap / kasa',
)
const labelText = computed(() => props.label || defaultLabel.value)

const currencyHint = computed(
  () =>
    `Yalnız profil para biriminde (${profileCurrency.value}) tanımlı hesap ve kasalar listelenir. Dövizli hesap/kasalar borç ödemesi için kullanılamaz.`,
)
const combinedHint = computed(() =>
  props.hint ? `${props.hint} ${currencyHint.value}` : currencyHint.value,
)
</script>

<template>
  <FormItem :label="labelText" :required="required" :extra="combinedHint">
    <Space direction="vertical" :size="8" style="width: 100%">
      <RadioGroup
        :value="endpoint"
        :options="endpointOptions"
        @update:value="(v) => onEndpointChange(v as Endpoint)"
      />
      <SelectWithCreate
        v-if="endpoint === 'account'"
        :value="accountId"
        :options="compatibleAccounts"
        :placeholder="sourcesLoading ? 'Hesaplar yükleniyor…' : 'Hesap seçin'"
        :disabled="sourcesLoading"
        create-label="Yeni hesap"
        @update:value="setAccount"
        @create="accountDrawerOpen = true"
      />
      <SelectWithCreate
        v-else
        :value="cashRegisterId"
        :options="compatibleRegisters"
        :placeholder="sourcesLoading ? 'Kasalar yükleniyor…' : 'Kasa seçin'"
        :disabled="sourcesLoading"
        create-label="Yeni kasa"
        @update:value="setRegister"
        @create="registerDrawerOpen = true"
      />
    </Space>
  </FormItem>

  <AccountFormDrawer
    v-model:open="accountDrawerOpen"
    lock-currency
    @saved="onAccountSaved"
  />
  <CashRegisterFormDrawer
    v-model:open="registerDrawerOpen"
    lock-currency
    @saved="onRegisterSaved"
  />
</template>
