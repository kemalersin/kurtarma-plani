<script setup lang="ts">
import { computed, ref } from 'vue'
import { SwapOutlined } from '@ant-design/icons-vue'
import KpInfoHint from '@/components/KpInfoHint.vue'
import {
  KP_LG_UP_MQ,
  KP_LIST_MOBILE_MQ,
  useMatchMedia,
  useMobileViewport,
} from '@/composables/useMatchMedia'

/**
 * Tek satırda gösterilen istatistik/özet kartı.
 *
 * Drawer ve sayfaların üst kısmındaki «kalan anapara / erken kapama / toplam»
 * gibi tutarları tek tip, şık ve responsive göstermek için kullanılır.
 *
 * - Otomatik grid (`auto-fit, minmax(150px, 1fr)`) — masaüstünde tek satır,
 *   mobilde 2-3 sütuna düşer; ekstra responsive CSS gerekmez.
 * - `tone` ile vurgu (`primary` ana metrik, `danger` borç/gecikme vb.).
 * - Tutar font'u `tabular-nums` — basamaklar hizalanır.
 * - AntDV `--ant-color-*` token'larıyla; otomatik açık/koyu uyumlu.
 *
 * Para tutarı `formatCurrency` ile çağıran taraf hazırlar; bileşen yalnızca
 * sunumdan sorumludur.
 */

export type StatTone = 'default' | 'primary' | 'success' | 'danger' | 'warning'

export interface KpStat {
  /** Üstteki küçük etiket (örn. "Kalan anapara") */
  label: string
  /** Asıl gösterilen değer (önceden formatlanmış string ya da number) */
  value: string | number
  /** Değerin altında küçük yardımcı not (opsiyonel) */
  hint?: string
  /**
   * Dar ekranda (`≤640px`) hint yerine tek satır + dönüşüm düğmesi.
   * Masaüstünde yalnızca `hint` gösterilir.
   */
  mobileHintToggle?: { primary: string; secondary: string }
  /** Etiket yanında bilgi ikonu (KpInfoHint); hover veya tıklama ile açılır */
  labelTooltip?: string
  /** Renk vurgusu — default `default` */
  tone?: StatTone
  /** Mobilde (`≤640px`) kartı tüm satır genişliğine yayar. */
  mobileFullRow?: boolean
}

interface Props {
  items: KpStat[]
  /** Sabit sütun sayısı (örn. 2 → 2×2 kart ızgarası). Verilmezse auto-fit. */
  columns?: number
  /** Tek sütun minimum genişliği (px). Default 150. `columns` yokken kullanılır. */
  minColumnWidth?: number
  /**
   * Ant Design `lg` (992px) altında 2 sütun (2×2); `lg` ve üstünde tüm kartlar tek satır.
   * `columns` verilmişse yok sayılır.
   */
  twoByTwoUntilLg?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  minColumnWidth: 150,
})

const isMobileViewport = useMobileViewport()
const isListMobile = useMatchMedia(KP_LIST_MOBILE_MQ)
const isLgUp = useMatchMedia(KP_LG_UP_MQ)

/** `true` → secondary (gider vb.) gösteriliyor. */
const hintToggleShowingSecondary = ref<Record<string, boolean>>({})

function hintToggleKey(item: KpStat, idx: number): string {
  return `${item.label}:${idx}`
}

function showMobileHintToggle(item: KpStat): boolean {
  return isListMobile.value && item.mobileHintToggle != null
}

function hasHint(item: KpStat): boolean {
  return Boolean(item.hint) || item.mobileHintToggle != null
}

function displayHint(item: KpStat, idx: number): string {
  if (showMobileHintToggle(item)) {
    const alt = item.mobileHintToggle!
    return hintToggleShowingSecondary.value[hintToggleKey(item, idx)]
      ? alt.secondary
      : alt.primary
  }
  return item.hint ?? ''
}

function hintToggleAriaLabel(item: KpStat, idx: number): string {
  return hintToggleShowingSecondary.value[hintToggleKey(item, idx)]
    ? 'Geliri göster'
    : 'Gideri göster'
}

function toggleHint(item: KpStat, idx: number): void {
  const key = hintToggleKey(item, idx)
  hintToggleShowingSecondary.value = {
    ...hintToggleShowingSecondary.value,
    [key]: !hintToggleShowingSecondary.value[key],
  }
}

const gridStyle = computed(() => {
  if (props.twoByTwoUntilLg) {
    const count = Math.max(1, props.items.length)
    return {
      gridTemplateColumns: isLgUp.value
        ? `repeat(${count}, minmax(0, 1fr))`
        : 'repeat(2, minmax(0, 1fr))',
    }
  }
  if (props.columns != null && props.columns > 0) {
    return {
      gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))`,
    }
  }
  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(${props.minColumnWidth}px, 1fr))`,
  }
})
</script>

<template>
  <div class="kp-stat-row" :style="gridStyle">
    <div
      v-for="(item, idx) in items"
      :key="item.label + idx"
      class="kp-stat"
      :class="{
        'kp-stat--mobile-full-row': item.mobileFullRow,
        'kp-stat--hint-toggle': showMobileHintToggle(item),
      }"
      :data-tone="item.tone ?? 'default'"
    >
      <button
        v-if="showMobileHintToggle(item)"
        type="button"
        class="kp-stat__hint-toggle"
        :aria-label="hintToggleAriaLabel(item, idx)"
        @click="toggleHint(item, idx)"
      >
        <SwapOutlined aria-hidden="true" />
      </button>
      <span class="kp-stat__label-row">
        <span
          class="kp-stat__label"
          :title="!isMobileViewport && !item.labelTooltip ? item.label : undefined"
          >{{ item.label }}</span
        >
        <KpInfoHint v-if="item.labelTooltip" :title="item.labelTooltip" />
      </span>
      <span
        class="kp-stat__value"
        :title="!isMobileViewport ? String(item.value) : undefined"
        >{{ item.value }}</span
      >
      <span v-if="hasHint(item)" class="kp-stat__hint">{{ displayHint(item, idx) }}</span>
    </div>
  </div>
</template>

<style scoped>
.kp-stat-row {
  display: grid;
  gap: 8px;
  width: 100%;
}

.kp-stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--kp-radius, 8px);
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  transition: background-color 0.15s ease, border-color 0.15s ease;
  min-width: 0;
}

.kp-stat--hint-toggle {
  padding-right: 38px;
}

.kp-stat:hover {
  background: var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04));
}

.kp-stat__label-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}

.kp-stat__label {
  font-size: 12px;
  line-height: 1.2;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.kp-stat__value {
  font-size: 20px;
  line-height: 1.25;
  font-weight: 600;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.kp-stat__hint {
  font-size: 12px;
  line-height: 1.3;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.kp-stat__hint-toggle {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--kp-radius, 6px);
  background: transparent;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.kp-stat__hint-toggle:hover {
  background: var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04));
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
}

.kp-stat__hint-toggle:focus-visible {
  outline: 2px solid var(--ant-color-primary, #1677ff);
  outline-offset: 1px;
}

/* tone — sadece value rengini değiştir; arka plan nötr kalır ki dağılmasın */
.kp-stat[data-tone='primary'] .kp-stat__value {
  color: var(--ant-color-primary, #1677ff);
}

.kp-stat[data-tone='success'] .kp-stat__value {
  color: var(--ant-color-success, #52c41a);
}

.kp-stat[data-tone='danger'] .kp-stat__value {
  color: var(--ant-color-error, #ff4d4f);
}

.kp-stat[data-tone='warning'] .kp-stat__value {
  color: var(--ant-color-warning, #faad14);
}

/* Dar viewport (mobil): biraz daha kompakt */
@media (max-width: 640px) {
  .kp-stat {
    padding: 10px 12px;
  }
  .kp-stat--hint-toggle {
    padding-right: 36px;
  }
  .kp-stat__hint-toggle {
    top: 4px;
    right: 4px;
  }
  .kp-stat__value {
    font-size: 17px;
  }
  .kp-stat--mobile-full-row {
    grid-column: 1 / -1;
  }
}

/* Çok dar (form drawer'ları): tutar daha da kompakt — sığması esas */
@media (max-width: 460px) {
  .kp-stat {
    padding: 8px 10px;
    gap: 2px;
  }
  .kp-stat--hint-toggle {
    padding-right: 34px;
  }
  .kp-stat__hint-toggle {
    top: 2px;
    right: 2px;
  }
  .kp-stat__label {
    font-size: 11px;
  }
  .kp-stat__value {
    font-size: 15px;
    letter-spacing: -0.015em;
  }
}

[data-theme='dark'] .kp-stat {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme='dark'] .kp-stat:hover {
  background: rgba(255, 255, 255, 0.06);
}

[data-theme='dark'] .kp-stat__label {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-stat__value {
  color: rgba(255, 255, 255, 0.88);
}

[data-theme='dark'] .kp-stat__hint {
  color: rgba(255, 255, 255, 0.55);
}

[data-theme='dark'] .kp-stat__hint-toggle {
  color: rgba(255, 255, 255, 0.45);
}

[data-theme='dark'] .kp-stat__hint-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.65);
}

[data-theme='dark'] .kp-stat[data-tone='primary'] .kp-stat__value {
  color: #4096ff;
}

[data-theme='dark'] .kp-stat[data-tone='success'] .kp-stat__value {
  color: #73d13d;
}

[data-theme='dark'] .kp-stat[data-tone='danger'] .kp-stat__value {
  color: #ff7875;
}

[data-theme='dark'] .kp-stat[data-tone='warning'] .kp-stat__value {
  color: #ffc53d;
}
</style>
