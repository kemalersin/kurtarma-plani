<script setup lang="ts">
/**
 * ECharts ortak sarıcı — **tree-shaken** core + ihtiyaç duyulan chart/komponent
 * kayıtları. Dashboard ve analiz sayfalarındaki tüm grafikler bu bileşenden
 * geçer; ek bir grafik tipi gerektiğinde `src/core/echarts/setup.ts` kayıtlarına eklenir.
 *
 * - Responsive: `ResizeObserver` ile container boyut değişiminde `resize()`.
 * - Tema duyarlı: `data-theme="dark"` → `'dark'` ECharts teması; `useUiStore`
 *   reaktif olarak izlenir, tema değiştiğinde grafik dispose + yeniden init.
 * - Mobil viewport'ta ECharts tooltip'leri açık kalır (`confine`, `click` tetikleme);
 *   KpTooltip / AntDV kuralları grafiklere uygulanmaz.
 * - Veri akışı: `option` prop'u her değiştiğinde `setOption(..., { notMerge: false })`
 *   ile diff yapılır; container ref dispose'unda chart instance temizlenir.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, dispose, type EChartsType } from 'echarts/core'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import { registerEcharts } from '@/core/echarts/setup'
import { useUiStore } from '@/stores/ui'
import { useMobileViewport } from '@/composables/useMatchMedia'

registerEcharts()

const props = withDefaults(
  defineProps<{
    option: EChartsOption
    /** Container yüksekliği (px veya CSS) — varsayılan 320. */
    height?: string | number
    /** Boş veri mesajı. Verilmezse "Veri yok." */
    emptyMessage?: string
    /** option boş kabul edilirse `<EmptyState>` göster. */
    isEmpty?: boolean
  }>(),
  {
    height: 320,
    emptyMessage: 'Bu aralık için gösterilecek veri yok.',
    isEmpty: false,
  },
)

const ui = useUiStore()
const isMobileViewport = useMobileViewport()
const container = ref<HTMLDivElement | null>(null)
let chart: EChartsType | null = null
let resizeObserver: ResizeObserver | null = null

const heightStyle = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)

function chartOption(option: EChartsOption): EChartsOption {
  if (!isMobileViewport.value) return option
  const tip = option.tooltip
  if (tip == null) return option
  const mobileDefaults = {
    confine: true,
    triggerOn: 'mousemove|click',
  }
  if (Array.isArray(tip)) {
    return {
      ...option,
      tooltip: tip.map((t) => ({ ...mobileDefaults, ...t })),
    }
  }
  return { ...option, tooltip: { ...mobileDefaults, ...tip } }
}

function initChart(): void {
  if (!container.value || props.isEmpty) return
  registerEcharts()
  if (chart) {
    dispose(chart)
    chart = null
  }
  const theme = ui.isDark ? 'dark' : ''
  chart = init(container.value, theme, { renderer: 'canvas' })
  chart.setOption(chartOption(props.option), { notMerge: true })
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(container.value)
  }
}

async function ensureChart(): Promise<void> {
  if (props.isEmpty) return
  if (!chart) {
    await nextTick()
    initChart()
  }
}

onMounted(() => {
  void ensureChart()
})

watch(
  () => props.option,
  (next) => {
    if (props.isEmpty) return
    if (!chart) {
      void ensureChart()
      return
    }
    chart.setOption(chartOption(next), { notMerge: false })
  },
  { deep: true },
)

watch(
  () => props.isEmpty,
  (empty) => {
    if (empty && chart) {
      dispose(chart)
      chart = null
    } else if (!empty) {
      void ensureChart()
    }
  },
)

watch(
  () => ui.isDark,
  () => {
    if (!props.isEmpty) initChart()
  },
)

watch(isMobileViewport, () => {
  if (props.isEmpty) return
  if (chart) {
    chart.setOption(chartOption(props.option), { notMerge: false })
  } else {
    void ensureChart()
  }
})

onBeforeUnmount(() => {
  if (chart) {
    dispose(chart)
    chart = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <div class="kp-chart" :style="{ height: heightStyle }">
    <div v-if="isEmpty" class="kp-chart__empty">{{ emptyMessage }}</div>
    <div v-else ref="container" class="kp-chart__canvas" />
  </div>
</template>

<style scoped>
.kp-chart {
  position: relative;
  width: 100%;
  min-width: 0;
}

.kp-chart__canvas {
  width: 100%;
  height: 100%;
}

.kp-chart__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  font-size: 13px;
  text-align: center;
  padding: 16px;
}
</style>
