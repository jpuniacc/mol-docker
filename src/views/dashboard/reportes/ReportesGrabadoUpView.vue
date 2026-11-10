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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  detalleReporteGrabadoUp,
  listarReporteGrabadoUp,
} from '@/services/reportesGrabadoUpApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import {
  aplicaChipGrabadoUp,
  ETIQUETA_SEMAFORO,
  filasGrabadoUpACsv,
  filasGrabadoUpAMatriz,
  type DetalleGrabadoUp,
  type FilaGrabadoUp,
  type FiltroChipGrabadoUp,
  type ResumenGrabadoUp,
  type SemaforoGrabadoUp,
} from '@/utils/reporteGrabadoUp'

const periodoActivo = usePeriodoActivoStore()
const loading = ref(false)
const loadingDetalle = ref(false)
const resumen = ref<ResumenGrabadoUp | null>(null)
const filas = ref<FilaGrabadoUp[]>([])
const ambienteErp = ref<'prod' | 'test' | null>(null)
const ambienteErpLabel = ref<string | null>(null)
const carrera = ref('')
const busqueda = ref('')
const chip = ref<FiltroChipGrabadoUp>('todos')
const actualizado = ref<Date | null>(null)
const carrerasDisponibles = ref<string[]>([])
const sheetOpen = ref(false)
const detalle = ref<DetalleGrabadoUp | null>(null)
const filaSeleccionada = ref<FilaGrabadoUp | null>(null)

const tienePeriodo = computed(() => periodoActivo.anio != null && periodoActivo.semestre != null)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

const BADGE: Record<SemaforoGrabadoUp, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  incompleto: 'border-amber-300 bg-amber-50 text-amber-800',
  sin_op: 'border-rose-200 bg-rose-50 text-rose-700',
}

const fmtFecha = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' })
}

async function cargar() {
  if (!tienePeriodo.value) return
  loading.value = true
  try {
    const list = await listarReporteGrabadoUp(
      periodoActivo.anio!,
      periodoActivo.semestre!,
      carrera.value || null,
      busqueda.value.trim() || null,
    )
    if (list.error) return mostrarErrorRematricula(`Error al cargar grabado U+: ${list.error}`)
    filas.value = list.data
    resumen.value = list.resumen
    ambienteErp.value = list.ambiente
    ambienteErpLabel.value = list.ambienteLabel
    if (!carrera.value && !busqueda.value.trim()) {
      carrerasDisponibles.value = [
        ...new Set(list.data.map((f) => f.nombreCarrera ?? '').filter(Boolean)),
      ].sort()
    }
    actualizado.value = new Date()
  } finally {
    loading.value = false
  }
}

const filasFiltradas = computed(() => filas.value.filter((f) => aplicaChipGrabadoUp(f, chip.value)))

const chips = computed(() => {
  const r = resumen.value
  return [
    { id: 'todos' as FiltroChipGrabadoUp, label: 'Todos', n: filas.value.length },
    { id: 'ok' as FiltroChipGrabadoUp, label: 'OK', n: r?.ok ?? 0 },
    { id: 'incompleto' as FiltroChipGrabadoUp, label: 'Incompleto', n: r?.incompleto ?? 0 },
    { id: 'sin_op' as FiltroChipGrabadoUp, label: 'Sin op', n: r?.sin_op ?? 0 },
  ]
})

const sortHeader = (label: string) =>
  ({ column }: { column: { toggleSorting: (d?: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' } }) =>
    h(
      'button',
      {
        class: 'inline-flex items-center gap-1 hover:text-foreground',
        onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
      },
      [label],
    )

async function abrirDetalle(fila: FilaGrabadoUp) {
  if (!tienePeriodo.value) return
  filaSeleccionada.value = fila
  sheetOpen.value = true
  detalle.value = null
  loadingDetalle.value = true
  try {
    const r = await detalleReporteGrabadoUp({
      anio: periodoActivo.anio!,
      semestre: periodoActivo.semestre!,
      numOperacion: fila.numOperacion,
      rutCodcli: fila.numOperacion ? null : fila.rutCodcli,
    })
    if (r.error) {
      mostrarErrorRematricula(`Error al leer detalle U+: ${r.error}`)
      return
    }
    detalle.value = r.data
  } finally {
    loadingDetalle.value = false
  }
}

const columns: ColumnDef<FilaGrabadoUp>[] = [
  {
    id: 'alumno',
    accessorFn: (f) => f.nombreAlumno ?? '',
    header: sortHeader('Alumno'),
    cell: ({ row }) =>
      h('div', [
        h('div', { class: 'font-medium' }, row.original.nombreAlumno ?? row.original.codcli),
        h(
          'div',
          { class: 'font-mono text-[11px] text-muted-foreground' },
          row.original.rut ?? row.original.rutNorm ?? '',
        ),
      ]),
  },
  {
    id: 'carrera',
    accessorFn: (f) => f.nombreCarrera ?? '',
    header: sortHeader('Carrera'),
    cell: ({ row }) =>
      h('div', { class: 'max-w-[220px] text-sm leading-snug' }, row.original.nombreCarrera ?? '—'),
  },
  {
    id: 'op',
    accessorFn: (f) => f.numOperacion ?? '',
    header: sortHeader('Op. cuenta'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'font-mono text-xs tabular-nums' },
        row.original.numOperacion ?? '—',
      ),
  },
  {
    id: 'control',
    accessorFn: (f) => f.controlEstado ?? '',
    header: sortHeader('Control'),
    cell: ({ row }) => {
      const e = row.original.controlEstado
      if (!e) return h('span', { class: 'text-xs text-muted-foreground' }, '—')
      return h(
        'span',
        {
          class: `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            row.original.controlOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-300 bg-amber-50 text-amber-800'
          }`,
        },
        e,
      )
    },
  },
  {
    id: 'semaforo',
    accessorFn: (f) => f.semaforo,
    header: sortHeader('Semáforo'),
    cell: ({ row }) => {
      const s = row.original.semaforo
      return h(
        'span',
        { class: `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE[s]}` },
        ETIQUETA_SEMAFORO[s],
      )
    },
  },
  {
    id: 'fec',
    accessorFn: (f) => f.fecMat ?? '',
    header: sortHeader('Fecha matrícula'),
    cell: ({ row }) =>
      h('span', { class: 'text-xs text-muted-foreground tabular-nums' }, fmtFecha(row.original.fecMat)),
  },
  {
    id: 'accion',
    header: '',
    cell: ({ row }) =>
      h(
        'button',
        {
          type: 'button',
          class: 'text-xs font-medium text-uniacc-blue hover:underline',
          onClick: () => void abrirDetalle(row.original),
        },
        'Ver U+',
      ),
  },
]

const sorting = ref<SortingState>([{ id: 'fec', desc: true }])
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
  return n === 0
    ? '0 de 0'
    : `${pageIndex * pageSize + 1}–${Math.min(n, (pageIndex + 1) * pageSize)} de ${n}`
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
  descargar(
    new Blob(['\ufeff' + filasGrabadoUpACsv(filasFiltradas.value)], { type: 'text/csv;charset=utf-8' }),
    `grabado-up-${periodoActivo.anio}-${periodoActivo.semestre}.csv`,
  )
}
function exportarExcel() {
  const ws = XLSX.utils.aoa_to_sheet(filasGrabadoUpAMatriz(filasFiltradas.value))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Grabado U+')
  XLSX.writeFile(wb, `grabado-up-${periodoActivo.anio}-${periodoActivo.semestre}.xlsx`)
}

function celdasTabla(rows: Record<string, unknown>[]): { keys: string[]; rows: Record<string, unknown>[] } {
  if (rows.length === 0) return { keys: [], rows: [] }
  const keys = Object.keys(rows[0]!)
  return { keys, rows }
}

const bloquesDetalle = computed(() => {
  const d = detalle.value
  if (!d) return []
  return [
    { id: 'alumno', titulo: 'MT_ALUMNO (matrícula)', rows: d.alumno },
    { id: 'control', titulo: 'MT_CONTROL_MATRICULA', rows: d.control },
    { id: 'ctapag', titulo: 'MT_CTAPAG', rows: d.ctapag },
    { id: 'ctadep', titulo: 'MT_CTADEP', rows: d.ctadep },
    { id: 'ctadoc', titulo: 'MT_CTADOC', rows: d.ctadoc },
    { id: 'docitem', titulo: 'MT_DOCITEM', rows: d.docitem },
    { id: 'posben', titulo: 'MT_POSBEN', rows: d.posben },
  ].map((b) => ({ ...b, ...celdasTabla(b.rows) }))
})

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
          <CardTitle>Grabado U+ · Matriculados online (MOL)</CardTitle>
          <CardDescription class="mt-1">
            Periodo <b class="text-foreground">{{ periodoLabel }}</b>
            · U+
            <b class="text-foreground">{{ ambienteErpLabel ?? (ambienteErp === 'test' ? 'Test' : ambienteErp === 'prod' ? 'Producción' : '—') }}</b>
            · Lectura en vivo de control y cuentas
            <template v-if="actualizado">
              · Actualizado
              {{ actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) }}
            </template>
            <button
              type="button"
              class="ml-1 inline-flex align-middle text-uniacc-orange"
              :disabled="loading"
              title="Actualizar"
              @click="cargar"
            >
              <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'motion-safe:animate-spin' : ''" />
            </button>
          </CardDescription>
          <p class="mt-2 text-[11px] text-muted-foreground">
            Op. cuenta U+; puede diferir de la operación TuFirma.
          </p>
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
          <select
            v-model="carrera"
            class="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Carrera"
          >
            <option value="">Carrera: Todas</option>
            <option v-for="c in carrerasDisponibles" :key="c" :value="c">{{ c }}</option>
          </select>
          <div class="relative min-w-[220px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input v-model="busqueda" class="pl-8" placeholder="Buscar por RUT, nombre u op…" />
          </div>
          <Button variant="outline" size="sm" @click="limpiar">Limpiar</Button>
        </template>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && resumen" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-uniacc-blue" />
        <p class="text-sm text-muted-foreground">Matriculados MOL</p>
        <p class="text-3xl font-bold tabular-nums">{{ resumen.total }}</p>
      </Card>
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-emerald-600" />
        <p class="text-sm text-muted-foreground">OK en U+</p>
        <p class="text-3xl font-bold tabular-nums text-emerald-700">{{ resumen.ok }}</p>
      </Card>
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-amber-500" />
        <p class="text-sm text-muted-foreground">Incompleto</p>
        <p class="text-3xl font-bold tabular-nums text-amber-700">{{ resumen.incompleto }}</p>
      </Card>
      <Card class="relative overflow-hidden p-4">
        <div class="absolute inset-x-0 top-0 h-1.5 bg-rose-500" />
        <p class="text-sm text-muted-foreground">Sin op</p>
        <p class="text-3xl font-bold tabular-nums text-rose-700">{{ resumen.sin_op }}</p>
      </Card>
    </div>

    <Card v-if="tienePeriodo">
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Detalle</CardTitle>
        <div class="flex flex-wrap gap-1.5 pt-2" role="group" aria-label="Filtrar semáforo">
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
        <div
          v-if="filasFiltradas.length"
          class="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground"
        >
          <span>Mostrando {{ rango }}</span>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">‹</Button>
            <span class="tabular-nums">Página {{ table.getState().pagination.pageIndex + 1 }} de {{ table.getPageCount() }}</span>
            <Button variant="outline" size="sm" :disabled="!table.getCanNextPage()" @click="table.nextPage()">›</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Sheet v-model:open="sheetOpen">
      <SheetContent side="right" class="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            Detalle U+
            <span v-if="detalle?.numOperacion || filaSeleccionada?.numOperacion" class="font-mono text-base">
              · {{ detalle?.numOperacion ?? filaSeleccionada?.numOperacion }}
            </span>
          </SheetTitle>
          <SheetDescription>
            {{ filaSeleccionada?.nombreAlumno ?? '—' }}
            · {{ filaSeleccionada?.rut ?? filaSeleccionada?.rutNorm ?? '—' }}
            <span v-if="detalle" class="ml-2">
              <span
                class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                :class="BADGE[detalle.semaforo]"
              >{{ ETIQUETA_SEMAFORO[detalle.semaforo] }}</span>
            </span>
          </SheetDescription>
          <p class="text-[11px] text-muted-foreground">
            Op. cuenta U+; puede diferir de la operación TuFirma.
          </p>
        </SheetHeader>

        <div v-if="loadingDetalle" class="mt-6 text-sm text-muted-foreground">Cargando tablas U+…</div>
        <div v-else class="mt-4 space-y-4">
          <section v-for="b in bloquesDetalle" :key="b.id" class="rounded-md border">
            <header class="flex items-center justify-between border-b bg-slate-50 px-3 py-2">
              <h3 class="text-sm font-semibold">{{ b.titulo }}</h3>
              <span class="text-xs text-muted-foreground tabular-nums">{{ b.rows.length }} fila(s)</span>
            </header>
            <div v-if="b.rows.length === 0" class="px-3 py-4 text-xs text-muted-foreground">Sin filas</div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-[11px]">
                <thead>
                  <tr class="border-b bg-white">
                    <th v-for="k in b.keys" :key="k" class="whitespace-nowrap px-2 py-1.5 font-medium text-muted-foreground">
                      {{ k }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in b.rows" :key="i" class="border-b last:border-0">
                    <td v-for="k in b.keys" :key="k" class="whitespace-nowrap px-2 py-1.5 font-mono tabular-nums">
                      {{ row[k] == null ? '—' : String(row[k]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
