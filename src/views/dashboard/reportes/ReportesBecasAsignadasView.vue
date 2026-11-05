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
import { Download, RefreshCw, Search } from 'lucide-vue-next'
import * as XLSX from 'xlsx'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  fetchKpiReporteBecasRematricula,
  listarReporteBecasRematricula,
} from '@/services/reportesBecasRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import {
  aplicaChipBecas,
  ETIQUETA_ART13,
  filasBecasACsv,
  filasBecasAMatriz,
  type FilaReporteBecasRematricula,
  type FiltroChipBecas,
  type KpiReporteBecasRematricula,
  type ResultadoArt13Reporte,
} from '@/utils/reporteBecasRematricula'

const periodoActivo = usePeriodoActivoStore()
const loading = ref(false)
const kpi = ref<KpiReporteBecasRematricula | null>(null)
const filas = ref<FilaReporteBecasRematricula[]>([])
const carrera = ref('')
const busqueda = ref('')
const chip = ref<FiltroChipBecas>('todos')
const actualizado = ref<Date | null>(null)
const carrerasDisponibles = ref<string[]>([])

const tienePeriodo = computed(() => periodoActivo.anio != null && periodoActivo.semestre != null)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n ?? 0))
const fmtFecha = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })
}
const fmtProm = (n: number | null) => (n == null ? '—' : n.toFixed(1))

async function cargar() {
  if (!tienePeriodo.value) return
  loading.value = true
  try {
    const anio = periodoActivo.anio!
    const sem = periodoActivo.semestre!
    const c = carrera.value || null
    const q = busqueda.value.trim() || null
    const [k, list] = await Promise.all([
      fetchKpiReporteBecasRematricula(anio, sem, c),
      listarReporteBecasRematricula(anio, sem, c, q),
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

const filasFiltradas = computed(() => filas.value.filter((f) => aplicaChipBecas(f, chip.value)))

const chips = computed(() => {
  const k = kpi.value
  const n = (c: FiltroChipBecas) => filas.value.filter((f) => aplicaChipBecas(f, c)).length
  return [
    { id: 'todos' as FiltroChipBecas, label: 'Todos', n: filas.value.length },
    { id: 'con_beca' as FiltroChipBecas, label: 'Con beca', n: k?.con_beca ?? n('con_beca') },
    { id: 'sin_beca' as FiltroChipBecas, label: 'Sin beca', n: k?.sin_beca ?? n('sin_beca') },
    { id: 'BAJA' as FiltroChipBecas, label: 'Baja %', n: k?.art13_baja ?? n('BAJA') },
    { id: 'MANTIENE' as FiltroChipBecas, label: 'Mantiene', n: k?.art13_mantiene ?? n('MANTIENE') },
    { id: 'PIERDE' as FiltroChipBecas, label: 'Pierde', n: k?.art13_pierde ?? n('PIERDE') },
  ]
})

const BADGE_ART13: Record<ResultadoArt13Reporte, string> = {
  MANTIENE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  BAJA: 'border-amber-300 bg-amber-50 text-amber-800',
  PIERDE: 'border-rose-200 bg-rose-50 text-rose-700',
  SIN_PROMEDIO: 'border-slate-200 bg-slate-50 text-slate-600',
  NO_APLICA: 'border-slate-100 bg-white text-slate-500',
}

const sortHeader = (label: string) =>
  ({ column }: { column: { toggleSorting: (d?: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' } }) =>
    h('button', { class: 'inline-flex items-center gap-1 hover:text-foreground', onClick: () => column.toggleSorting(column.getIsSorted() === 'asc') }, [
      label,
    ])

const columns: ColumnDef<FilaReporteBecasRematricula>[] = [
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
    cell: ({ row }) => h('div', { class: 'max-w-[220px] text-sm leading-snug' }, row.original.nombre_carrera ?? '—'),
  },
  {
    id: 'prom',
    accessorFn: (f) => f.prom_anio ?? -1,
    header: sortHeader('Promedio'),
    cell: ({ row }) => h('span', { class: 'tabular-nums text-sm' }, fmtProm(row.original.prom_anio)),
  },
  {
    id: 'becas',
    accessorFn: (f) => f.monto_becas,
    header: sortHeader('Becas grabadas'),
    cell: ({ row }) => {
      const f = row.original
      if (f.cantidad_becas === 0) return h('span', { class: 'text-xs text-muted-foreground' }, 'Sin beca grabada')
      return h(
        'div',
        { class: 'space-y-1' },
        f.becas.map((b) =>
          h('div', { class: 'text-xs leading-snug' }, [
            h('span', { class: 'font-medium' }, b.descripcion),
            h('span', { class: 'text-muted-foreground' }, ` · ${b.porc ?? '—'}% · ${fmtMoney(b.monto)}`),
            b.omite_tope_70
              ? h('span', { class: 'ml-1 rounded border border-uniacc-blue/30 bg-uniacc-blue/10 px-1 text-[10px] text-[#2b6f98]' }, 'sin tope 70%')
              : null,
          ]),
        ),
      )
    },
  },
  {
    id: 'art13',
    accessorFn: (f) => f.resultado_art13,
    header: sortHeader('Art. 13'),
    cell: ({ row }) => {
      const r = row.original.resultado_art13
      return h(
        'span',
        { class: `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_ART13[r]}` },
        ETIQUETA_ART13[r],
      )
    },
  },
  {
    id: 'fec',
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
watch([chip, filas], () => table.setPageIndex(0))

const rango = computed(() => {
  const { pageIndex, pageSize } = table.getState().pagination
  const n = filasFiltradas.value.length
  return n === 0 ? '0 de 0' : `${pageIndex * pageSize + 1}–${Math.min(n, (pageIndex + 1) * pageSize)} de ${n}`
})

function limpiar() {
  carrera.value = ''
  busqueda.value = ''
  chip.value = 'todos'
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
function exportarCsv() {
  descargar(new Blob(['\ufeff' + filasBecasACsv(filasFiltradas.value)], { type: 'text/csv;charset=utf-8' }), `reporte-becas-mol-${periodoActivo.anio}-${periodoActivo.semestre}.csv`)
}
function exportarExcel() {
  const ws = XLSX.utils.aoa_to_sheet(filasBecasAMatriz(filasFiltradas.value))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Becas MOL')
  XLSX.writeFile(wb, `reporte-becas-mol-${periodoActivo.anio}-${periodoActivo.semestre}.xlsx`)
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
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-4">
    <Card>
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Becas asignadas · Matriculados online (MOL)</CardTitle>
          <CardDescription class="mt-1">
            Periodo <b class="text-foreground">{{ periodoLabel }}</b> · Becas grabadas al matricular · Art. 13 por promedio anual
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
          <div class="relative min-w-[220px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input v-model="busqueda" class="pl-8" placeholder="Buscar por RUT o nombre…" />
          </div>
          <Button variant="outline" size="sm" @click="limpiar">Limpiar</Button>
        </template>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && kpi" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-uniacc-blue" />
        <p class="text-sm text-muted-foreground">Matriculados MOL</p>
        <p class="text-3xl font-bold tabular-nums">{{ kpi.matriculados_mol }}</p>
        <p class="mt-1 text-xs text-muted-foreground">{{ kpi.con_beca }} con beca · {{ kpi.sin_beca }} sin beca</p>
      </Card>
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-emerald-600" />
        <p class="text-sm text-muted-foreground">Monto becas grabadas</p>
        <p class="text-2xl font-bold tabular-nums text-emerald-700">{{ fmtMoney(kpi.monto_becas) }}</p>
      </Card>
      <Card class="relative overflow-hidden p-4 sm:col-span-2">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-amber-500" />
        <p class="text-sm font-semibold text-amber-900">Art. 13 (becas que miden promedio)</p>
        <div class="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div><span class="text-emerald-600">■</span> Mantiene <b class="tabular-nums">{{ kpi.art13_mantiene }}</b></div>
          <div><span class="text-amber-500">■</span> Baja % <b class="tabular-nums">{{ kpi.art13_baja }}</b></div>
          <div><span class="text-rose-600">■</span> Pierde <b class="tabular-nums">{{ kpi.art13_pierde }}</b></div>
        </div>
        <p class="mt-2 text-[11px] text-muted-foreground">Talento Presencial 100 % omite tope 70 %; el promedio sí aplica.</p>
      </Card>
    </div>

    <Card v-if="tienePeriodo">
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Detalle</CardTitle>
        <div class="flex flex-wrap gap-1.5 pt-2" role="group" aria-label="Filtrar becas">
          <button
            v-for="c in chips"
            :key="c.id"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-blue"
            :class="chip === c.id ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
            :aria-pressed="chip === c.id"
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
              <TableCell :colspan="columns.length" class="py-12 text-center text-muted-foreground">
                Sin resultados para el periodo y filtros actuales.
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
