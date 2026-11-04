<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent])

defineProps<{ option: Record<string, unknown>; height?: string }>()
type ClickParams = { name?: string; seriesName?: string }
const emit = defineEmits<{ click: [params: ClickParams] }>()
function onClick(p: ClickParams) {
  emit("click", p)
}
</script>

<template>
  <VChart
    :option="option"
    autoresize
    :style="{ height: height ?? '220px', width: '100%' }"
    @click="onClick"
  />
</template>
