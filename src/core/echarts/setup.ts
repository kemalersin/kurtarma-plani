import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
} from 'echarts/components'

let registered = false

/** Tree-shaken ECharts kayıtları — uygulama başında bir kez çalıştırılır. */
export function registerEcharts(): void {
  if (registered) return
  registered = true
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
}

registerEcharts()
