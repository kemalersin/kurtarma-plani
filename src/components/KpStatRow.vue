<script setup lang="ts">
import { computed } from 'vue'
import KpInfoHint from '@/components/KpInfoHint.vue'
import { useMobileViewport } from '@/composables/useMatchMedia'

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
}

const props = withDefaults(defineProps<Props>(), {
  minColumnWidth: 150,
})

const isMobileViewport = useMobileViewport()

const gridStyle = computed(() => ({
  gridTemplateColumns:
    props.columns != null && props.columns > 0
      ? `repeat(${props.columns}, minmax(0, 1fr))`
      : `repeat(auto-fit, minmax(${props.minColumnWidth}px, 1fr))`,
}))
</script>

<template>
  <div class="kp-stat-row" :style="gridStyle">
    <div
      v-for="(item, idx) in items"
      :key="item.label + idx"
      class="kp-stat"
      :class="{ 'kp-stat--mobile-full-row': item.mobileFullRow }"
      :data-tone="item.tone ?? 'default'"
    >
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
      <span v-if="item.hint" class="kp-stat__hint">{{ item.hint }}</span>
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
