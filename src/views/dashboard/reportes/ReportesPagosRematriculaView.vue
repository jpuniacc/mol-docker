<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import {
  FlexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/vue-table'
import { AlertTriangle, ArrowUpDown, Download, RefreshCw, Search } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import EChart from '@/components/reportes/pagos/EChart.vue'
import {
  fetchKpiReportePagosRematricula,
  listarReportePagosRematricula,
} from '@/services/reportesPagosRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import {
  aplicaChip,
  aplicaMedio,
  ETIQUETA_MEDIO,
  filasReportePagosACsv,
  filasReportePagosAMatriz,
  mensajeEmptyReportePagos,
  porCarrera,
  resumirConcepto,
  serieDiaria,
  type Concepto,
  type FiltroChip,
  type FiltroMedio,
  type FilaReportePagosRematricula,
  type KpiReportePagosRematricula,
  type MedioPago,
  type ResumenConcepto,
} from '@/utils/reportePagosRematricula'

const C_WEBPAY = '#059669'
const C_PAGARE = '#4D98C5'
const C_PEND = '#f59e0b'

const periodoActivo = usePeriodoActivoStore()
const loading = ref(false)
const kpi = ref<KpiReportePagosRematricula | null>(null)
const filas = ref<FilaReportePagosRematricula[]>([])
const carrera = ref('')
const medio = ref<FiltroMedio>('todos')
const busqueda = ref('')
const chip = ref<FiltroChip>('todos')
const conceptoCarrera = ref<Concepto>('matricula')
const rangoSerie = ref<'14' | 'todo'>('14')
const actualizado = ref<Date | null>(null)
const carrerasDisponibles = ref<string[]>([])

const tienePeriodo = computed(() => periodoActivo.anio != null && periodoActivo.semestre != null)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n ?? 0))
const fmtFecha = (iso: string | null, conHora = false) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return conHora
    ? d.toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })
}
const pct = (n: number, t: number) => (t > 0 ? Math.round((n * 100) / t) : 0)

async function cargar() {
  if (!tienePeriodo.value) return
  loading.value = true
  try {
    const anio = periodoActivo.anio!
    const sem = periodoActivo.semestre!
    const c = carrera.value || null
    const q = busqueda.value.trim() || null
    const [k, list] = await Promise.all([
      fetchKpiReportePagosRematricula(anio, sem, c),
      listarReportePagosRematricula(anio, sem, c, q),
    ])
    if (k.error) return mostrarErrorRematricula(`Error al cargar totales: ${k.error}`)
    if (list.error) return mostrarErrorRematricula(`Error al cargar listado: ${list.error}`)
    kpi.value = k.data
    filas.value = list.data
    if (!c && !q) {
      carrerasDisponibles.value = [...new Set(list.data.map((f) => f.nombre_carrera ?? '').filter(Boolean))].sort()
    }
    actualizado.value = new Date()
  } finally {
    loading.value = false
  }
}

/** Filas tras filtros locales (medio + chip). Gráficos usan filas con filtros de servidor. */
const filasFiltradas = computed(() =>
  filas.value.filter((f) => aplicaMedio(f, medio.value) && aplicaChip(f, chip.value)),
)

const resMat = computed<ResumenConcepto>(() => kpi.value?.matricula ?? resumirConcepto(filas.value, 'matricula'))
const resAra = computed<ResumenConcepto>(() => kpi.value?.arancel ?? resumirConcepto(filas.value, 'arancel'))
const total = computed(() => kpi.value?.matriculados_mol ?? filas.value.length)

const chips = computed(() => {
  const m = resumirConcepto(filas.value, 'matricula')
  const a = resumirConcepto(filas.value, 'arancel')
  return [
    { id: 'todos' as FiltroChip, label: 'Todos', n: filas.value.length },
    { id: 'matricula:webpay' as FiltroChip, label: 'Matrícula Webpay', n: m.webpay },
    { id: 'matricula:pagare' as FiltroChip, label: 'Matrícula pagaré', n: m.pagare },
    { id: 'matricula:pendiente' as FiltroChip, label: 'Matrícula sin definir', n: m.pendiente },
    { id: 'arancel:webpay' as FiltroChip, label: 'Arancel Webpay', n: a.webpay },
    { id: 'arancel:pagare' as FiltroChip, label: 'Arancel pagaré', n: a.pagare },
    { id: 'arancel:pendiente' as FiltroChip, label: 'Arancel sin definir', n: a.pendiente },
  ]
})

function irAPendientes() {
  chip.value = resMat.value.pendiente > 0 ? 'matricula:pendiente' : 'arancel:pendiente'
  document.getElementById('detalle-pagos')?.scrollIntoView({ behavior: 'smooth' })
}

function limpiar() {
  carrera.value = ''
  medio.value = 'todos'
  busqueda.value = ''
  chip.value = 'todos'
}

// ---------- Gráficos ----------
const serie = computed(() => {
  const s = serieDiaria(filas.value)
  return rangoSerie.value === '14' ? s.slice(-14) : s
})
const optSerie = computed(() => ({
  grid: { left: 36, right: 12, top: 28, bottom: 28 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, left: 0, itemWidth: 14, textStyle: { fontSize: 11, color: '#475569' } },
  xAxis: {
    type: 'category',
    data: serie.value.map((p) => p.fecha.slice(8, 10) + '-' + p.fecha.slice(5, 7)),
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
  series: [
    { name: 'Matriculados', type: 'line', smooth: true, data: serie.value.map((p) => p.acumulado), color: C_PAGARE, areaStyle: { opacity: 0.15 }, symbolSize: 5 },
    { name: 'Matrícula con pago', type: 'line', smooth: true, data: serie.value.map((p) => p.acumuladoConMedio), color: C_WEBPAY, lineStyle: { type: 'dashed' }, symbolSize: 4 },
  ],
}))

const donut = (r: ResumenConcepto) => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  series: [
    {
      type: 'pie',
      radius: ['58%', '80%'],
      label: { show: true, position: 'center', formatter: () => String(r.webpay + r.pagare + r.pendiente), fontSize: 20, fontWeight: 700, color: '#0f172a' },
      emphasis: { label: { show: true } },
      data: [
        { name: ETIQUETA_MEDIO.webpay, value: r.webpay, itemStyle: { color: C_WEBPAY } },
        { name: ETIQUETA_MEDIO.pagare, value: r.pagare, itemStyle: { color: C_PAGARE } },
        { name: ETIQUETA_MEDIO.pendiente, value: r.pendiente, itemStyle: { color: C_PEND } },
      ],
    },
  ],
})
const optDonaMat = computed(() => donut(resumirConcepto(filas.value, 'matricula')))
const optDonaAra = computed(() => donut(resumirConcepto(filas.value, 'arancel')))

const datosCarrera = computed(() => porCarrera(filas.value, conceptoCarrera.value, 8).reverse())
const optCarrera = computed(() => ({
  grid: { left: 150, right: 16, top: 24, bottom: 8, containLabel: false },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 0, left: 0, itemWidth: 12, textStyle: { fontSize: 11, color: '#475569' } },
  xAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
  yAxis: {
    type: 'category',
    data: datosCarrera.value.map((d) => d.carrera),
    axisLabel: { fontSize: 10, color: '#334155', width: 140, overflow: 'truncate' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  series: (['webpay', 'pagare', 'pendiente'] as MedioPago[]).map((m) => ({
    name: ETIQUETA_MEDIO[m],
    type: 'bar',
    stack: 'x',
    barMaxWidth: 14,
    color: m === 'webpay' ? C_WEBPAY : m === 'pagare' ? C_PAGARE : C_PEND,
    data: datosCarrera.value.map((d) => d[m]),
  })),
}))
function clickCarrera(p: { name?: string }) {
  if (p.name && !p.name.startsWith('Otras') && carrerasDisponibles.value.includes(p.name)) carrera.value = p.name
}

// ---------- Tabla ----------
const BADGE: Record<MedioPago, string> = {
  webpay: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pagare: 'border-uniacc-blue/30 bg-uniacc-blue/10 text-[#2b6f98]',
  pendiente: 'border-amber-300 bg-amber-50 text-amber-700',
}
function celdaMedio(f: FilaReportePagosRematricula, c: Concepto) {
  const m = c === 'matricula' ? f.medio_matricula : f.medio_arancel
  const monto = c === 'matricula' ? f.monto_matricula : f.monto_arancel
  const fecha = c === 'matricula' ? f.fecha_pago_matricula : f.fecha_pago_arancel
  const cuotas = c === 'matricula' ? f.cuotas_matricula : f.cuotas_arancel
  const badge = h('span', { class: `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE[m]}` }, ETIQUETA_MEDIO[m])
  if (m === 'pendiente') return h('div', [badge])
  const sub =
    m === 'webpay'
      ? fmtFecha(fecha, true)
      : `${cuotas ?? '—'} cuotas${f.fecha_inicio_pagare ? ' · desde ' + fmtFecha(f.fecha_inicio_pagare + 'T12:00:00') : ''}`
  return h('div', [
    h('div', { class: 'flex items-center gap-2' }, [badge, h('span', { class: 'text-xs font-semibold tabular-nums' }, fmtMoney(monto))]),
    h('div', { class: 'mt-0.5 text-[11px] text-muted-foreground' }, sub),
  ])
}
const ordenMedio: Record<MedioPago, number> = { pendiente: 0, pagare: 1, webpay: 2 }
const sortHeader = (label: string) =>
  ({ column }: { column: { toggleSorting: (d?: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' } }) =>
    h('button', { class: 'inline-flex items-center gap-1 hover:text-foreground', onClick: () => column.toggleSorting(column.getIsSorted() === 'asc') }, [
      label,
      h(ArrowUpDown, { class: 'h-3 w-3 opacity-60' }),
    ])

const columns: ColumnDef<FilaReportePagosRematricula>[] = [
  {
    id: 'alumno',
    accessorFn: (f) => f.nombre_alumno ?? '',
    header: sortHeader('Alumno'),
    cell: ({ row }) =>
      h('div', [
        h('div', { class: 'font-medium' }, row.original.nombre_alumno ?? row.original.codcli),
        h('div', { class: 'font-mono text-[11px] text-muted-foreground' }, row.original.rut ?? row.original.rut_norm ?? ''),
      ]),
  },
  {
    id: 'carrera',
    accessorFn: (f) => f.nombre_carrera ?? '',
    header: sortHeader('Carrera'),
    cell: ({ row }) => h('div', { class: 'max-w-[260px] text-sm leading-snug', title: row.original.nombre_carrera ?? '' }, row.original.nombre_carrera ?? '—'),
  },
  {
    id: 'matricula',
    accessorFn: (f) => ordenMedio[f.medio_matricula] * 1e12 + (f.monto_matricula ?? 0),
    header: sortHeader('Pago matrícula'),
    cell: ({ row }) => celdaMedio(row.original, 'matricula'),
  },
  {
    id: 'arancel',
    accessorFn: (f) => ordenMedio[f.medio_arancel] * 1e12 + (f.monto_arancel ?? 0),
    header: sortHeader('Pago arancel'),
    cell: ({ row }) => celdaMedio(row.original, 'arancel'),
  },
  {
    id: 'fec_mat',
    accessorFn: (f) => f.fec_mat ?? '',
    header: sortHeader('Fecha matrícula'),
    cell: ({ row }) => h('span', { class: 'text-xs text-muted-foreground tabular-nums' }, fmtFecha(row.original.fec_mat)),
  },
]

const sorting = ref<SortingState>([{ id: 'alumno', desc: false }])
const table = useVueTable({
  get data() {
    return filasFiltradas.value
  },
  columns,
  state: {
    get sorting() {
      return sorting.value
    },
  },
  onSortingChange: (u) => {
    sorting.value = typeof u === 'function' ? u(sorting.value) : u
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  initialState: { pagination: { pageSize: 20 } },
})
watch([chip, medio, filas], () => table.setPageIndex(0))
const rango = computed(() => {
  const { pageIndex, pageSize } = table.getState().pagination
  const n = filasFiltradas.value.length
  return n === 0 ? '0 de 0' : `${pageIndex * pageSize + 1}–${Math.min(n, (pageIndex + 1) * pageSize)} de ${n}`
})

// ---------- Export ----------
const nombreArchivo = () => `reporte-pagos-mol-${periodoActivo.anio}-${periodoActivo.semestre}`
function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
function exportarCsv() {
  descargar(new Blob(['\ufeff' + filasReportePagosACsv(filasFiltradas.value)], { type: 'text/csv;charset=utf-8' }), `${nombreArchivo()}.csv`)
}
function exportarExcel() {
  const ws = XLSX.utils.aoa_to_sheet(filasReportePagosAMatriz(filasFiltradas.value))
  ws['!cols'] = [10, 14, 32, 34, 22, 10, 12, 22, 8, 18, 10, 12, 22, 8, 18, 12].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos MOL')
  XLSX.writeFile(wb, `${nombreArchivo()}.xlsx`)
}

let timer: ReturnType<typeof setTimeout> | null = null
watch(busqueda, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void cargar(), 300)
})
watch(carrera, () => void cargar())

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) await cargar()
})

const conceptos = computed(() => [
  { key: 'matricula', titulo: 'Matrícula', r: resMat.value, barra: 'bg-emerald-600' },
  { key: 'arancel', titulo: 'Arancel', r: resAra.value, barra: 'bg-uniacc-blue' },
])
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-4">
    <Card>
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Pagos · Matriculados online (MOL)</CardTitle>
          <CardDescription class="mt-1">
            Periodo <b class="text-foreground">{{ periodoLabel }}</b> · Medio de pago por concepto (Webpay / Pagaré)
            <template v-if="actualizado"> · Actualizado {{ actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }}</template>
            <button type="button" class="ml-1 inline-flex align-middle text-uniacc-orange" :disabled="loading" title="Actualizar" @click="cargar">
              <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'motion-safe:animate-spin' : ''" />
            </button>
          </CardDescription>
        </div>
        <div v-if="tienePeriodo" class="flex gap-2">
          <Button variant="outline" size="sm" :disabled="filasFiltradas.length === 0" @click="exportarCsv">
            <Download class="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" :disabled="filasFiltradas.length === 0" @click="exportarExcel">
            <Download class="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-3">
        <div v-if="!tienePeriodo" class="text-sm text-muted-foreground">No hay periodo activo configurado.</div>
        <template v-else>
          <select v-model="carrera" class="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm" aria-label="Carrera">
            <option value="">Carrera: Todas</option>
            <option v-for="c in carrerasDisponibles" :key="c" :value="c">{{ c }}</option>
          </select>
          <select v-model="medio" class="h-9 rounded-md border border-input bg-background px-3 text-sm" aria-label="Medio de pago">
            <option value="todos">Medio: Todos</option>
            <option value="webpay">Webpay</option>
            <option value="pagare">Pagaré</option>
            <option value="pendiente">Sin definir</option>
          </select>
          <div class="relative min-w-[220px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input v-model="busqueda" class="pl-8" placeholder="Buscar por RUT o nombre…" />
          </div>
          <Button variant="outline" size="sm" @click="limpiar">Limpiar</Button>
        </template>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && kpi" class="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.8fr_1.4fr_1.4fr_0.9fr]">
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-uniacc-blue" />
        <p class="text-sm text-muted-foreground">Matriculados MOL</p>
        <p class="text-3xl font-bold tabular-nums">{{ total }}</p>
        <p class="mt-1 text-xs text-muted-foreground">+{{ kpi.matriculados_hoy }} hoy · +{{ kpi.matriculados_7d }} últimos 7 días</p>
      </Card>
      <Card v-for="c in conceptos" :key="c.key" class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5" :class="c.barra" />
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">{{ c.titulo }}</span>
          <b class="tabular-nums">{{ c.r.webpay + c.r.pagare }} de {{ total }} con pago definido ({{ pct(c.r.webpay + c.r.pagare, total) }}%)</b>
        </div>
        <div class="my-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="bg-emerald-600" :style="{ width: pct(c.r.webpay, total) + '%' }" />
          <div class="bg-uniacc-blue" :style="{ width: pct(c.r.pagare, total) + '%' }" />
          <div class="bg-amber-500" :style="{ width: pct(c.r.pendiente, total) + '%' }" />
        </div>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div><span class="text-emerald-600">■</span> Webpay <b>{{ c.r.webpay }}</b><div class="font-semibold tabular-nums text-emerald-700">{{ fmtMoney(c.r.webpay_monto) }}</div></div>
          <div><span class="text-uniacc-blue">■</span> Pagaré <b>{{ c.r.pagare }}</b><div class="font-semibold tabular-nums text-[#2b6f98]">{{ fmtMoney(c.r.pagare_monto) }}</div></div>
          <div><span class="text-amber-500">■</span> Sin definir <b>{{ c.r.pendiente }}</b></div>
        </div>
      </Card>
      <button
        type="button"
        class="relative overflow-hidden rounded-xl border border-orange-300 bg-orange-50 p-4 text-left shadow-sm transition hover:bg-orange-100"
        @click="irAPendientes"
      >
        <div class="absolute inset-x-0 top-0 h-1.5 bg-uniacc-magenta" />
        <p class="flex items-center gap-1 text-sm font-semibold text-orange-800"><AlertTriangle class="h-4 w-4" /> Sin pago definido</p>
        <p class="text-orange-900"><span class="text-3xl font-bold tabular-nums text-orange-700">{{ resMat.pendiente }}</span> sin pago de matrícula definido</p>
        <p class="text-sm text-orange-900">{{ resAra.pendiente }} sin pago de arancel definido</p>
        <p class="mt-1 text-xs font-semibold text-orange-800 underline">Ver listado →</p>
      </button>
    </div>

    <div v-if="tienePeriodo && filas.length" class="grid gap-4 lg:grid-cols-[1.3fr_1fr_1.3fr]">
      <Card class="p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Matriculados MOL acumulados por día</h3>
          <div class="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
            <button
              v-for="r in (['14', 'todo'] as const)"
              :key="r"
              type="button"
              class="rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-blue"
              :class="rangoSerie === r ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'"
              :aria-pressed="rangoSerie === r"
              @click="rangoSerie = r"
            >
              {{ r === '14' ? '14 días' : 'Todo' }}
            </button>
          </div>
        </div>
        <EChart :option="optSerie" />
      </Card>
      <Card class="p-4">
        <h3 class="text-sm font-semibold">Medio de pago por concepto</h3>
        <div class="grid grid-cols-2">
          <div><p class="text-center text-xs font-semibold">Matrícula</p><EChart :option="optDonaMat" height="150px" /></div>
          <div><p class="text-center text-xs font-semibold">Arancel</p><EChart :option="optDonaAra" height="150px" /></div>
        </div>
        <div class="mt-1 flex justify-center gap-4 text-xs">
          <span><span class="text-emerald-600">■</span> Webpay</span><span><span class="text-uniacc-blue">■</span> Pagaré</span><span><span class="text-amber-500">■</span> Sin definir</span>
        </div>
      </Card>
      <Card class="p-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Por carrera <span class="font-normal text-muted-foreground">(clic = filtrar)</span></h3>
          <div class="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
            <button
              v-for="c in (['matricula', 'arancel'] as const)"
              :key="c"
              type="button"
              class="rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-blue"
              :class="conceptoCarrera === c ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'"
              :aria-pressed="conceptoCarrera === c"
              @click="conceptoCarrera = c"
            >
              {{ c === 'matricula' ? 'Matrícula' : 'Arancel' }}
            </button>
          </div>
        </div>
        <EChart :option="optCarrera" height="240px" @click="clickCarrera" />
      </Card>
    </div>

    <Card v-if="tienePeriodo" id="detalle-pagos">
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Detalle de alumnos MOL</CardTitle>
        <div class="flex flex-wrap gap-1.5 pt-2" role="group" aria-label="Filtrar por medio">
          <button
            v-for="c in chips"
            :key="c.id"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-blue"
            :class="chip === c.id ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
            :aria-pressed="chip === c.id"
            :aria-label="`${c.label}, ${c.n}`"
            @click="chip = c.id"
          >
            {{ c.label }} <span class="opacity-60">{{ c.n }}</span>
          </button>
        </div>
      </CardHeader>
      <CardContent class="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow v-for="hg in table.getHeaderGroups()" :key="hg.id">
              <TableHead v-for="hd in hg.headers" :key="hd.id" class="whitespace-nowrap px-4">
                <FlexRender :render="hd.column.columnDef.header" :props="hd.getContext()" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading && filas.length === 0">
              <TableCell :colspan="columns.length" class="px-4 text-muted-foreground">Cargando…</TableCell>
            </TableRow>
            <TableRow v-else-if="filasFiltradas.length === 0">
              <TableCell :colspan="columns.length" class="py-12 text-center">
                <Search class="mx-auto mb-2 h-7 w-7 text-muted-foreground" aria-hidden="true" />
                <p class="font-semibold">Sin resultados{{ busqueda.trim() ? ` para «${busqueda.trim()}»` : '' }}</p>
                <p class="mb-3 mx-auto max-w-lg text-sm text-muted-foreground">
                  {{
                    mensajeEmptyReportePagos({
                      q: busqueda,
                      carrera,
                      medio,
                      periodoLabel,
                    })
                  }}
                </p>
                <Button variant="outline" size="sm" @click="limpiar">Limpiar filtros</Button>
              </TableCell>
            </TableRow>
            <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-4 py-2.5 align-middle">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div v-if="filasFiltradas.length" class="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
          <span>Mostrando {{ rango }}</span>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">‹</Button>
            <span class="tabular-nums">Página {{ table.getState().pagination.pageIndex + 1 }} de {{ table.getPageCount() }}</span>
            <Button variant="outline" size="sm" :disabled="!table.getCanNextPage()" @click="table.nextPage()">›</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
