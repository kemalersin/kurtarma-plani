import type { EChartsOption } from 'echarts/types/dist/echarts'

export interface DonutSlice {
  name: string
  value: number
  color?: string
}

const DONUT_COLORS = ['#1677ff', '#fa8c16', '#722ed1', '#13c2c2', '#52c41a', '#eb2f96']

/**
 * Donut (pie) grafiği — halka, seri bounding box içinde **dikey ve yatay ortalı**.
 * Alt legend için alan ayrılır (`series.bottom`); halka kalan bölgenin tam ortasında kalır.
 */
export function buildDonutOption(
  slices: DonutSlice[],
  tooltipValue?: (value: number) => string,
): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      ...(tooltipValue
        ? { valueFormatter: (v: unknown) => tooltipValue(Number(v)) }
        : {}),
    },
    legend: {
      bottom: 4,
      left: 'center',
      type: 'scroll',
      itemGap: 10,
    },
    series: [
      {
        type: 'pie',
        top: '4%',
        bottom: '18%',
        left: 'center',
        radius: ['48%', '72%'],
        itemStyle: { borderRadius: 4, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        data: slices.map((slice, i) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: {
            color: slice.color ?? DONUT_COLORS[i % DONUT_COLORS.length],
          },
        })),
      },
    ],
  }
}
