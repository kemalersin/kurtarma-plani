<script setup lang="ts">
/**
 * ECharts ortak sarıcı — **tree-shaken** core + ihtiyaç duyulan chart/komponent
 * kayıtları. Dashboard ve analiz sayfalarındaki tüm grafikler bu bileşenden
 * geçer; ek bir grafik tipi gerektiğinde alttaki `use([...])` çağrısına eklenir.
 *
 * - Responsive: `ResizeObserver` ile container boyut değişiminde `resize()`.
 * - Tema duyarlı: `data-theme="dark"` → `'dark'` ECharts teması; `useUiStore`
 *   reaktif olarak izlenir, tema değiştiğinde grafik dispose + yeniden init.
 * - Mobil viewport'ta tooltip default `axis` modunda; küçük ekranda fareüstü
 *   etkisi yerine dokunmalı (tap) ile tetiklenir (ECharts default davranış).
 * - Veri akışı: `option` prop'u her değiştiğinde `setOption(..., { notMerge: false })`
 *   ile diff yapılır; container ref dispose'unda chart instance temizlenir.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { use, init, dispose, type EChartsType } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'
import type { EChartsOption } from 'echarts/types/dist/echarts'
import { useUiStore } from '@/stores/ui'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
])

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
const container = ref<HTMLDivElement | null>(null)
let chart: EChartsType | null = null
let resizeObserver: ResizeObserver | null = null

const heightStyle = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
)

function initChart(): void {
  if (!container.value) return
  if (chart) {
    dispose(chart)
    chart = null
  }
  const theme = ui.isDark ? 'dark' : ''
  chart = init(container.value, theme, { renderer: 'canvas' })
  chart.setOption(props.option, { notMerge: true })
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      chart?.resize()
    })
    resizeObserver.observe(container.value)
  }
}

onMounted(() => {
  if (!props.isEmpty) initChart()
})

watch(
  () => props.option,
  (next) => {
    if (props.isEmpty) return
    if (!chart) initChart()
    else chart.setOption(next, { notMerge: false })
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
      initChart()
    }
  },
)

watch(
  () => ui.isDark,
  () => {
    if (!props.isEmpty) initChart()
  },
)

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
