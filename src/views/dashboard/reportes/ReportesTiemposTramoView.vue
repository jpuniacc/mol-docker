<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import EChart from '@/components/reportes/pagos/EChart.vue'
import { fetchKpiReporteTiemposTramo } from '@/services/reportesTiemposTramoApi'
import { supabase } from '@/services/supabaseClient'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import {
  cuelloBotella,
  ETIQUETA_TRAMO,
  fmtHoras,
  type FilaTiempoTramo,
} from '@/utils/reporteTiemposTramo'

const C_MEDIA = '#4D98C5'
const C_MEDIANA = '#E8621A'

const periodoActivo = usePeriodoActivoStore()
const loading = ref(false)
const filas = ref<FilaTiempoTramo[]>([])
const carrera = ref('')
const actualizado = ref<Date | null>(null)
const carrerasDisponibles = ref<string[]>([])

const tienePeriodo = computed(() => periodoActivo.anio != null && periodoActivo.semestre != null)
const periodoLabel = computed(() => periodoActivo.label ?? '—')
const cuello = computed(() => cuelloBotella(filas.value))

async function cargarCarreras() {
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (anio == null || sem == null) return
  const { data } = await supabase
    .from('mnp_progreso_rematricula')
    .select('nombre_carrera')
    .eq('anio_periodo', anio)
    .eq('semestre_periodo', sem)
    .eq('etapa_actual', 'matriculado')
  const set = new Set<string>()
  for (const r of data ?? []) {
    const n = (r as { nombre_carrera?: string | null }).nombre_carrera?.trim()
    if (n) set.add(n)
  }
  carrerasDisponibles.value = [...set].sort()
}

async function cargar() {
  if (!tienePeriodo.value) return
  loading.value = true
  try {
    const res = await fetchKpiReporteTiemposTramo(
      periodoActivo.anio!,
      periodoActivo.semestre!,
      carrera.value || null,
    )
    if (res.error) return mostrarErrorRematricula(`Error al cargar tiempos: ${res.error}`)
    filas.value = res.data
    actualizado.value = new Date()
  } finally {
    loading.value = false
  }
}

const optBarras = computed(() => ({
  grid: { left: 160, right: 24, top: 36, bottom: 28 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
      if (!Array.isArray(params) || !params.length) return ''
      const name = params[0]?.name ?? ''
      const lines = params.map((p) => `${p.seriesName}: ${fmtHoras(Number(p.value))}`)
      return `${name}<br/>${lines.join('<br/>')}`
    },
  },
  legend: { top: 0, left: 0, textStyle: { fontSize: 11, color: '#475569' } },
  xAxis: {
    type: 'value',
    name: 'horas',
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
  yAxis: {
    type: 'category',
    data: filas.value.map((f) => ETIQUETA_TRAMO[f.tramo]),
    axisLabel: { fontSize: 11, color: '#334155', width: 150, overflow: 'truncate' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  series: [
    {
      name: 'Media',
      type: 'bar',
      barMaxWidth: 14,
      data: filas.value.map((f) => f.media_horas ?? 0),
      itemStyle: { color: C_MEDIA },
    },
    {
      name: 'Mediana',
      type: 'bar',
      barMaxWidth: 14,
      data: filas.value.map((f) => f.mediana_horas ?? 0),
      itemStyle: { color: C_MEDIANA },
    },
  ],
}))

watch(carrera, () => void cargar())

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) {
    await cargarCarreras()
    await cargar()
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1100px] space-y-4">
    <Card>
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Tiempos por tramo · Matriculados online (MOL)</CardTitle>
          <CardDescription class="mt-1">
            Periodo <b class="text-foreground">{{ periodoLabel }}</b> · Media y mediana entre hitos del embudo
            <template v-if="actualizado"> · Actualizado {{ actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }}</template>
            <button type="button" class="ml-1 inline-flex align-middle text-uniacc-orange" :disabled="loading" title="Actualizar" @click="cargar">
              <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'motion-safe:animate-spin' : ''" />
            </button>
          </CardDescription>
        </div>
        <select
          v-if="tienePeriodo"
          v-model="carrera"
          class="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Carrera"
        >
          <option value="">Carrera: Todas</option>
          <option v-for="c in carrerasDisponibles" :key="c" :value="c">{{ c }}</option>
        </select>
      </CardHeader>
    </Card>

    <div v-if="!tienePeriodo" class="text-sm text-muted-foreground">No hay periodo activo configurado.</div>

    <template v-else>
      <Card v-if="cuello" class="border-orange-200 bg-orange-50 p-4">
        <p class="text-sm font-semibold text-orange-900">Cuello de botella</p>
        <p class="mt-1 text-lg font-bold text-orange-950">
          {{ ETIQUETA_TRAMO[cuello.tramo] }}
          <span class="ml-2 text-base font-semibold text-orange-800">mediana {{ fmtHoras(cuello.mediana_horas) }}</span>
        </p>
        <p class="mt-1 text-xs text-orange-800/80">
          n = {{ cuello.n }} · media {{ fmtHoras(cuello.media_horas) }}. Compara con los otros tramos para ver dónde se acumula la espera.
        </p>
      </Card>

      <div class="grid gap-4 lg:grid-cols-2">
        <Card class="p-4">
          <h3 class="mb-2 text-sm font-semibold">Media vs mediana (horas)</h3>
          <EChart v-if="filas.length" :option="optBarras" height="280px" />
          <p v-else-if="loading" class="text-sm text-muted-foreground">Cargando…</p>
          <p v-else class="text-sm text-muted-foreground">Sin datos de tramos.</p>
        </Card>
        <Card class="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="px-4">Tramo</TableHead>
                <TableHead class="px-4 text-right">n</TableHead>
                <TableHead class="px-4 text-right">Media</TableHead>
                <TableHead class="px-4 text-right">Mediana</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="f in filas"
                :key="f.tramo"
                :class="cuello?.tramo === f.tramo ? 'bg-orange-50' : ''"
              >
                <TableCell class="px-4 text-sm font-medium">{{ ETIQUETA_TRAMO[f.tramo] }}</TableCell>
                <TableCell class="px-4 text-right tabular-nums text-sm">{{ f.n }}</TableCell>
                <TableCell class="px-4 text-right tabular-nums text-sm">{{ fmtHoras(f.media_horas) }}</TableCell>
                <TableCell class="px-4 text-right tabular-nums text-sm font-semibold">{{ fmtHoras(f.mediana_horas) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p class="border-t px-4 py-3 text-[11px] text-muted-foreground">
            Hitos desde logs MOL (TyC, OTP/apoderado, forma de pago, firma, matrícula). Si falta un extremo, el alumno no entra al n de ese tramo.
          </p>
        </Card>
      </div>
      <div class="flex justify-end">
        <Button variant="outline" size="sm" :disabled="loading" @click="cargar">Actualizar</Button>
      </div>
    </template>
  </div>
</template>
