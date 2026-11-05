<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Link2,
  RefreshCw,
  Search,
  X,
} from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { toast } from 'vue-sonner'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import EChart from '@/components/reportes/pagos/EChart.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  downloadContratoFirmaPdf,
  getContratoFirmaEstado,
  getEnlaceFirmaFirmante,
  listContratoFirmas,
  type ContratoFirmaListRow,
} from '@/services/contratoFirmaApi'
import {
  aplicaFiltrosFirma,
  etiquetaHoras,
  etiquetaMedioFirma,
  etiquetaRolCorto,
  filasGestionFirmasACsv,
  filasGestionFirmasAMatriz,
  firmantesPendientes,
  horasDesdeGenerado,
  resumirGestionFirmas,
  serieDiariaFirmas,
  type FiltroAntiguedadFirma,
  type FiltroEstadoFirma,
  type FiltroMedioFirma,
} from '@/utils/gestionFirmas'

const PAGE_SIZE = 25
const C_ENV = '#1e3a5f'
const C_OK = '#10b981'
const C_PEND = '#f59e0b'
const C_48 = '#ec4899'

const rows = ref<ContratoFirmaListRow[]>([])
const loading = ref(false)
const filtroEstado = ref<FiltroEstadoFirma>('todos')
const busqueda = ref('')
const carrera = ref('')
const medio = ref<FiltroMedioFirma>('todos')
const antiguedad = ref<FiltroAntiguedadFirma>('todas')
const rangoSerie = ref<14 | 30>(14)
const actualizado = ref<Date | null>(null)

const dialogOpen = ref(false)
const seleccionado = ref<ContratoFirmaListRow | null>(null)
const pdfUrl = ref<string | null>(null)
const pdfLoading = ref(false)
const pdfError = ref<string | null>(null)
const enlaceLoading = ref(false)
const pdfFetchGeneration = ref(0)
let pdfAbortController: AbortController | null = null

const ahoraRef = computed(() => actualizado.value ?? new Date())

const conteoTabs = computed(() => {
  const all = rows.value
  return {
    todos: all.length,
    pendiente: all.filter((r) => !r.ready).length,
    firmado: all.filter((r) => r.ready).length,
  }
})

const carrerasDisponibles = computed(() =>
  [...new Set(rows.value.map((r) => r.carrera).filter((c): c is string => !!c?.trim()))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  ),
)

const filasBase = computed(() =>
  rows.value.filter((row) =>
    aplicaFiltrosFirma(row, {
      estado: 'todos',
      busqueda: busqueda.value,
      carrera: carrera.value,
      medio: medio.value,
      antiguedad: 'todas',
      ahora: ahoraRef.value,
    }),
  ),
)

const resumen = computed(() => resumirGestionFirmas(filasBase.value, ahoraRef.value))

const filasVisibles = computed(() =>
  rows.value.filter((row) =>
    aplicaFiltrosFirma(row, {
      estado: filtroEstado.value,
      busqueda: busqueda.value,
      carrera: carrera.value,
      medio: medio.value,
      antiguedad: antiguedad.value,
      ahora: ahoraRef.value,
    }),
  ),
)

const {
  page,
  totalPages,
  pageItems: filasPagina,
  rangoDesde,
  rangoHasta,
  resetPage,
  irAPaginaAnterior,
  irAPaginaSiguiente,
} = useTablaPaginada(filasVisibles, PAGE_SIZE)

watch([filtroEstado, busqueda, carrera, medio, antiguedad], resetPage)

const pct = (n: number, t: number) => (t > 0 ? Math.round((n * 100) / t) : 0)

type CardKpi = {
  id: string
  titulo: string
  valor: string
  n: number
  pct: number
  sub: string
  barra: string
  onClick: () => void
  activo: boolean
}

const cards = computed<CardKpi[]>(() => {
  const r = resumen.value
  const t = r.enviados || 1
  return [
    {
      id: 'enviados',
      titulo: 'Enviados',
      valor: String(r.enviados),
      n: r.enviados,
      pct: 100,
      sub: 'Contratos en TuFirma',
      barra: 'bg-slate-800',
      activo: filtroEstado.value === 'todos' && antiguedad.value === 'todas',
      onClick: () => {
        filtroEstado.value = 'todos'
        antiguedad.value = 'todas'
      },
    },
    {
      id: 'firmados',
      titulo: 'Firmados',
      valor: String(r.firmados),
      n: r.firmados,
      pct: pct(r.firmados, t),
      sub: 'ready / estampado',
      barra: 'bg-emerald-500',
      activo: filtroEstado.value === 'firmado',
      onClick: () => {
        filtroEstado.value = 'firmado'
        antiguedad.value = 'todas'
      },
    },
    {
      id: 'pendientes',
      titulo: 'Pendientes',
      valor: String(r.pendientes),
      n: r.pendientes,
      pct: pct(r.pendientes, t),
      sub: 'Esperando firma',
      barra: 'bg-amber-500',
      activo: filtroEstado.value === 'pendiente' && antiguedad.value === 'todas',
      onClick: () => {
        filtroEstado.value = 'pendiente'
        antiguedad.value = 'todas'
      },
    },
    {
      id: '48h',
      titulo: '+48 h pendientes',
      valor: String(r.pendientes48h),
      n: r.pendientes48h,
      pct: pct(r.pendientes48h, t),
      sub: '⚠ Prioridad contacto',
      barra: 'bg-pink-500',
      activo: antiguedad.value === '48h',
      onClick: () => {
        filtroEstado.value = 'pendiente'
        antiguedad.value = antiguedad.value === '48h' ? 'todas' : '48h'
      },
    },
    {
      id: 'falta',
      titulo: 'Falta alumno / sost.',
      valor: `${r.faltaAlumno} / ${r.faltaSostenedor}`,
      n: r.faltaAlumno + r.faltaSostenedor,
      pct: pct(r.faltaAlumno + r.faltaSostenedor, Math.max(r.pendientes, 1) * 2),
      sub: 'Firmantes pendientes',
      barra: 'bg-sky-500',
      activo: filtroEstado.value === 'pendiente' && antiguedad.value === 'todas',
      onClick: () => {
        filtroEstado.value = 'pendiente'
        antiguedad.value = 'todas'
      },
    },
  ]
})

const serie = computed(() => serieDiariaFirmas(filasBase.value, rangoSerie.value, ahoraRef.value))

const optSerie = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, left: 0, textStyle: { fontSize: 11, color: '#475569' } },
  grid: { left: 36, right: 12, top: 36, bottom: 28 },
  xAxis: {
    type: 'category',
    data: serie.value.map((p) => p.dia),
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  yAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
  series: [
    {
      name: 'Enviados',
      type: 'line',
      smooth: true,
      data: serie.value.map((p) => p.enviados),
      color: C_ENV,
      symbolSize: 5,
    },
    {
      name: 'Firmados',
      type: 'line',
      smooth: true,
      data: serie.value.map((p) => p.firmados),
      color: C_OK,
      symbolSize: 5,
    },
  ],
}))

const optEmbudo = computed(() => {
  const r = resumen.value
  return {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'funnel',
        left: '8%',
        width: '84%',
        top: 12,
        bottom: 28,
        minSize: '28%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: { show: true, position: 'inside', formatter: '{b}: {c}', color: '#fff', fontSize: 12 },
        data: [
          { name: 'Enviados', value: r.enviados || 0, itemStyle: { color: C_ENV } },
          { name: 'Firmados', value: r.firmados || 0, itemStyle: { color: C_OK } },
          { name: 'Pendientes', value: r.pendientes || 0, itemStyle: { color: C_PEND } },
        ],
      },
    ],
  }
})

const tasaCierre = computed(() => pct(resumen.value.firmados, resumen.value.enviados))

const tituloTabla = computed(() => {
  if (antiguedad.value === '48h') return 'Pendientes prioritarios'
  if (filtroEstado.value === 'pendiente') return 'Contratos pendientes'
  if (filtroEstado.value === 'firmado') return 'Contratos firmados'
  return 'Contratos TuFirma'
})

const hayFiltros = computed(
  () =>
    busqueda.value.trim() !== '' ||
    carrera.value !== '' ||
    medio.value !== 'todos' ||
    antiguedad.value !== 'todas' ||
    filtroEstado.value !== 'todos',
)

function limpiarFiltros(): void {
  busqueda.value = ''
  carrera.value = ''
  medio.value = 'todos'
  antiguedad.value = 'todas'
  filtroEstado.value = 'todos'
  resetPage()
}

function formatoGenerado(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function actualizadoLabel(): string {
  if (!actualizado.value) return ''
  return actualizado.value.toLocaleTimeString('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function badgeEstado(ready: boolean): string {
  return ready
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800'
}

function badgeRol(rol: 'alumno' | 'apoderado'): string {
  return rol === 'alumno'
    ? 'border-pink-200 bg-pink-50 text-pink-800'
    : 'border-sky-200 bg-sky-50 text-sky-800'
}

function revokePdfUrl(): void {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
}

function invalidatePdfFetch(): void {
  pdfAbortController?.abort()
  pdfAbortController = null
  pdfFetchGeneration.value += 1
}

function isPdfFetchStale(generation: number, numOperacion: string): boolean {
  return (
    generation !== pdfFetchGeneration.value ||
    !dialogOpen.value ||
    seleccionado.value?.num_operacion !== numOperacion
  )
}

async function cargar(): Promise<void> {
  loading.value = true
  try {
    const res = await listContratoFirmas()
    if (!res.ok) {
      mostrarErrorRematricula(res.error ?? 'No se pudo cargar el listado de firmas.')
      rows.value = []
      return
    }
    rows.value = res.data
    actualizado.value = new Date()
    resetPage()
  } finally {
    loading.value = false
  }
}

async function abrirDetalle(row: ContratoFirmaListRow): Promise<void> {
  invalidatePdfFetch()
  revokePdfUrl()

  const numOperacion = row.num_operacion
  const generation = pdfFetchGeneration.value
  const controller = new AbortController()
  pdfAbortController = controller

  seleccionado.value = row
  pdfError.value = null
  dialogOpen.value = true
  pdfLoading.value = true

  try {
    const [res, estado] = await Promise.all([
      downloadContratoFirmaPdf(numOperacion),
      getContratoFirmaEstado(numOperacion),
    ])
    if (isPdfFetchStale(generation, numOperacion) || controller.signal.aborted) return

    if (estado.ok) {
      const actualizadoRow: ContratoFirmaListRow = {
        ...row,
        ready: estado.ready,
        firmantes: estado.firmantes,
      }
      seleccionado.value = actualizadoRow
      const indice = rows.value.findIndex((item) => item.num_operacion === numOperacion)
      if (indice >= 0) rows.value[indice] = { ...rows.value[indice], ...actualizadoRow }
    }

    if (!res.ok) {
      pdfError.value = `No pudimos traer el contrato de la operación ${numOperacion}.`
      mostrarErrorRematricula(res.error, {
        numOperacion: String(numOperacion),
        reintentar: () => {
          void abrirDetalle(row)
        },
      })
      return
    }
    pdfUrl.value = URL.createObjectURL(res.blob)
  } finally {
    if (!isPdfFetchStale(generation, numOperacion)) pdfLoading.value = false
    if (pdfAbortController === controller) pdfAbortController = null
  }
}

function onDialogOpenChange(open: boolean): void {
  dialogOpen.value = open
  if (!open) {
    invalidatePdfFetch()
    revokePdfUrl()
    seleccionado.value = null
    pdfError.value = null
    pdfLoading.value = false
  }
}

async function copiarEnlace(row: ContratoFirmaListRow): Promise<void> {
  const pendiente = firmantesPendientes(row.firmantes)[0]
  if (!pendiente) {
    toast.message('No hay firmantes pendientes')
    return
  }
  enlaceLoading.value = true
  try {
    const res = await getEnlaceFirmaFirmante(row.num_operacion, pendiente.email)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    await navigator.clipboard.writeText(res.signatureLink)
    toast.success(`Link copiado (${etiquetaRolCorto(pendiente.rol)})`)
  } catch {
    toast.error('No se pudo copiar el enlace')
  } finally {
    enlaceLoading.value = false
  }
}

function nombreArchivo(): string {
  return `gestion-firmas-${new Date().toISOString().slice(0, 10)}`
}

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function exportarCsv(): void {
  descargar(
    new Blob(['\ufeff' + filasGestionFirmasACsv(filasVisibles.value, ahoraRef.value)], {
      type: 'text/csv;charset=utf-8',
    }),
    `${nombreArchivo()}.csv`,
  )
}

function exportarExcel(): void {
  const ws = XLSX.utils.aoa_to_sheet(filasGestionFirmasAMatriz(filasVisibles.value, ahoraRef.value))
  ws['!cols'] = [12, 14, 28, 14, 26, 12, 12, 10, 14, 20, 8].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Firmas')
  XLSX.writeFile(wb, `${nombreArchivo()}.xlsx`)
}

onMounted(() => {
  void cargar()
})

onUnmounted(() => {
  invalidatePdfFetch()
  revokePdfUrl()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <Card>
      <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <CardTitle>Gestión de firmas</CardTitle>
          <CardDescription>
            Contratos enviados a TuFirma · PDF en pantalla · quién falta
            <template v-if="actualizado"> · Actualizado hoy {{ actualizadoLabel() }}</template>
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" :disabled="loading" @click="cargar">
            <RefreshCw class="mr-1.5 h-4 w-4" :class="loading ? 'animate-spin' : ''" />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="filasVisibles.length === 0"
            @click="exportarCsv"
          >
            <Download class="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            type="button"
            size="sm"
            :disabled="filasVisibles.length === 0"
            @click="exportarExcel"
          >
            <Download class="mr-1.5 h-4 w-4" />
            Excel (filtros aplicados)
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <Tabs v-model="filtroEstado">
          <TabsList class="flex h-auto flex-wrap">
            <TabsTrigger value="todos">Todos {{ conteoTabs.todos }}</TabsTrigger>
            <TabsTrigger value="pendiente">Pendiente {{ conteoTabs.pendiente }}</TabsTrigger>
            <TabsTrigger value="firmado">Firmado {{ conteoTabs.firmado }}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[220px] flex-1">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="busqueda"
              class="pl-8"
              placeholder="Buscar RUT, nombre o codcli…"
            />
          </div>
          <select
            v-model="carrera"
            class="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Carrera"
          >
            <option value="">Carrera: Todas</option>
            <option v-for="c in carrerasDisponibles" :key="c" :value="c">{{ c }}</option>
          </select>
          <select
            v-model="medio"
            class="h-9 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Medio"
          >
            <option value="todos">Medio: Todos</option>
            <option value="webpay">Webpay</option>
            <option value="pagare">Pagaré</option>
            <option value="cubierto">Cubierto</option>
          </select>
          <select
            v-model="antiguedad"
            class="h-9 min-w-[160px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Antigüedad"
          >
            <option value="todas">Antigüedad: Todas</option>
            <option value="48h">+48 h</option>
          </select>
          <Button type="button" variant="ghost" size="sm" :disabled="!hayFiltros" @click="limpiarFiltros">
            <X class="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        </div>
        <div v-if="hayFiltros" class="flex flex-wrap gap-2">
          <Badge
            v-if="filtroEstado !== 'todos'"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="filtroEstado = 'todos'"
          >
            Estado: {{ filtroEstado === 'pendiente' ? 'Pendiente' : 'Firmado' }}
            <X class="h-3 w-3" />
          </Badge>
          <Badge
            v-if="carrera"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="carrera = ''"
          >
            Carrera: {{ carrera }}
            <X class="h-3 w-3" />
          </Badge>
          <Badge
            v-if="medio !== 'todos'"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="medio = 'todos'"
          >
            Medio: {{ medio }}
            <X class="h-3 w-3" />
          </Badge>
          <Badge
            v-if="antiguedad === '48h'"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="antiguedad = 'todas'"
          >
            +48 h
            <X class="h-3 w-3" />
          </Badge>
          <Badge
            v-if="busqueda.trim()"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="busqueda = ''"
          >
            Búsqueda
            <X class="h-3 w-3" />
          </Badge>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <button
        v-for="c in cards"
        :key="c.id"
        type="button"
        class="relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="c.activo ? 'ring-2 ring-offset-1 ring-slate-400' : ''"
        @click="c.onClick()"
      >
        <div class="absolute inset-x-0 top-0 h-1.5" :class="c.barra" />
        <p class="text-xs font-medium text-muted-foreground">{{ c.titulo }}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums tracking-tight xl:text-3xl">{{ c.valor }}</p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full" :class="c.barra" :style="{ width: `${Math.min(c.pct, 100)}%` }" />
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          <span class="font-semibold text-foreground">{{ c.pct }}%</span>
          {{ c.sub }}
        </p>
        <p class="mt-2 text-[11px] font-medium text-orange-600">Clic → filtra</p>
      </button>
    </div>

    <div v-if="rows.length > 0" class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-base">Enviados vs firmados por día</CardTitle>
          <div class="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              class="rounded px-2 py-1"
              :class="rangoSerie === 14 ? 'bg-muted font-semibold' : 'text-muted-foreground'"
              @click="rangoSerie = 14"
            >
              14 días
            </button>
            <button
              type="button"
              class="rounded px-2 py-1"
              :class="rangoSerie === 30 ? 'bg-muted font-semibold' : 'text-muted-foreground'"
              @click="rangoSerie = 30"
            >
              30 días
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <EChart :option="optSerie" height="260px" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Embudo TuFirma</CardTitle>
          <CardDescription>Enviado → Firmado (ready)</CardDescription>
        </CardHeader>
        <CardContent>
          <EChart :option="optEmbudo" height="220px" />
          <p class="mt-1 text-center text-xs text-muted-foreground">
            Tasa de cierre: {{ tasaCierre }}% · {{ resumen.pendientes48h }} con +48 h
          </p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-base">
          {{ tituloTabla }}
          <span class="font-normal text-muted-foreground">
            ({{ filasVisibles.length }} registro{{ filasVisibles.length === 1 ? '' : 's' }})
          </span>
        </CardTitle>
        <p class="text-[11px] text-muted-foreground">Filas compactas · badges · {{ PAGE_SIZE }}/pág</p>
      </CardHeader>
      <CardContent class="space-y-4 pt-2">
        <div
          v-if="!loading && rows.length === 0"
          class="flex flex-col items-center justify-center gap-3 py-16 text-center"
        >
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 class="h-8 w-8 text-emerald-600" />
          </div>
          <p class="text-lg font-semibold">Sin contratos</p>
          <p class="max-w-md text-sm text-muted-foreground">
            No hay contratos enviados a TuFirma todavía.
          </p>
          <Button type="button" variant="outline" size="sm" @click="cargar">Actualizar</Button>
        </div>

        <div
          v-else-if="!loading && filasVisibles.length === 0"
          class="flex flex-col items-center justify-center gap-3 py-12 text-center"
        >
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 class="h-8 w-8 text-emerald-600" />
          </div>
          <p class="text-lg font-semibold">Sin contratos pendientes</p>
          <p class="max-w-md text-sm text-muted-foreground">
            No hay firmas con los filtros actuales. Prueba «Todos» o limpia los chips.
          </p>
          <Button type="button" variant="outline" size="sm" @click="limpiarFiltros">
            <X class="mr-1.5 h-4 w-4" />
            Limpiar filtros
          </Button>
        </div>

        <template v-else>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Carrera</TableHead>
                  <TableHead>Medios</TableHead>
                  <TableHead>Quién falta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Antigüedad</TableHead>
                  <TableHead>Generado</TableHead>
                  <TableHead class="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="loading">
                  <TableCell colspan="8" class="text-muted-foreground">Cargando…</TableCell>
                </TableRow>
                <TableRow v-for="row in filasPagina" :key="row.num_operacion" class="align-top">
                  <TableCell class="py-2.5">
                    <div class="font-medium leading-tight">
                      {{ row.nombre ?? row.codcli ?? '—' }}
                    </div>
                    <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {{ row.rut ?? '—' }}
                      <span v-if="row.codcli"> · {{ row.codcli }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="max-w-[200px] py-2.5">
                    <span class="line-clamp-2 text-sm" :title="row.carrera ?? undefined">
                      {{ row.carrera ?? '—' }}
                    </span>
                  </TableCell>
                  <TableCell class="py-2.5">
                    <div class="flex flex-wrap gap-1">
                      <Badge variant="outline" class="text-[10px]">
                        M {{ etiquetaMedioFirma(row.medio_matricula) }}
                      </Badge>
                      <Badge variant="outline" class="text-[10px]">
                        A {{ etiquetaMedioFirma(row.medio_arancel) }}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell class="py-2.5">
                    <div class="flex flex-wrap gap-1">
                      <template v-if="!row.ready && firmantesPendientes(row.firmantes).length">
                        <span
                          v-for="f in firmantesPendientes(row.firmantes)"
                          :key="`${f.email}-${f.rol}`"
                          class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          :class="badgeRol(f.rol)"
                        >
                          {{ etiquetaRolCorto(f.rol) }}
                        </span>
                      </template>
                      <span v-else class="text-xs text-muted-foreground">—</span>
                    </div>
                  </TableCell>
                  <TableCell class="py-2.5">
                    <span
                      class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                      :class="badgeEstado(row.ready)"
                    >
                      {{ row.ready ? 'Firmado' : 'Pendiente' }}
                    </span>
                  </TableCell>
                  <TableCell class="py-2.5 whitespace-nowrap text-sm">
                    <span v-if="!row.ready">
                      {{ etiquetaHoras(horasDesdeGenerado(row.created_at, ahoraRef)) }}
                    </span>
                    <span v-else class="text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell class="py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                    {{ formatoGenerado(row.created_at) }}
                  </TableCell>
                  <TableCell class="py-2.5">
                    <div class="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                        title="Ver contrato"
                        @click="abrirDetalle(row)"
                      >
                        <Eye class="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                        title="Copiar link firma"
                        :disabled="row.ready || enlaceLoading"
                        @click="copiarEnlace(row)"
                      >
                        <Link2 class="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="filasVisibles.length > 0"
            class="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-xs text-muted-foreground">
              Mostrando
              <span class="font-semibold text-foreground">{{ rangoDesde }}</span>
              –
              <span class="font-semibold text-foreground">{{ rangoHasta }}</span>
              de
              <span class="font-semibold text-foreground">{{ filasVisibles.length }}</span>
            </p>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                :disabled="page === 1"
                @click="irAPaginaAnterior"
              >
                <ChevronLeft class="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <div class="rounded-md border bg-background px-3 py-1.5 text-sm">
                <span class="font-semibold">{{ page }}</span>
                <span class="text-muted-foreground"> / {{ totalPages }}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                :disabled="page >= totalPages"
                @click="irAPaginaSiguiente"
              >
                Siguiente
                <ChevronRight class="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <Dialog :open="dialogOpen" @update:open="onDialogOpenChange">
      <DialogContent class="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Contrato {{ seleccionado?.num_operacion }}</DialogTitle>
          <DialogDescription>
            {{ seleccionado?.rut ?? '—' }} ·
            {{ seleccionado?.nombre ?? seleccionado?.codcli ?? '—' }}
            · {{ seleccionado?.carrera ?? '—' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <span
              class="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              :class="badgeEstado(!!seleccionado?.ready)"
            >
              {{ seleccionado?.ready ? 'Firmado' : 'Pendiente' }}
            </span>
            <span
              v-if="seleccionado && !seleccionado.ready"
              class="text-xs text-muted-foreground"
            >
              {{ etiquetaHoras(horasDesdeGenerado(seleccionado.created_at, ahoraRef)) }}
            </span>
          </div>
          <ul class="space-y-1 text-sm">
            <li
              v-for="firmante in seleccionado?.firmantes ?? []"
              :key="`${firmante.email}-${firmante.rol}`"
              class="flex flex-wrap items-center gap-2"
            >
              <span class="font-medium">{{ firmante.nombre }}</span>
              <span class="text-muted-foreground">({{ firmante.rol }} · {{ firmante.email }})</span>
              <Badge variant="outline">{{ firmante.ready ? 'Firmado' : 'Pendiente' }}</Badge>
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              :disabled="!seleccionado || enlaceLoading || seleccionado.ready"
              @click="seleccionado && copiarEnlace(seleccionado)"
            >
              <Link2 class="mr-1.5 h-4 w-4" />
              Copiar link
            </Button>
            <Button type="button" size="sm" variant="outline" disabled title="Pendiente de decisión">
              Estampado
            </Button>
          </div>
          <p v-if="pdfLoading" class="text-sm text-muted-foreground">Cargando PDF…</p>
          <p v-else-if="pdfError" class="text-sm text-red-700">{{ pdfError }}</p>
          <iframe
            v-else-if="pdfUrl"
            :src="pdfUrl"
            title="Contrato PDF"
            class="h-[65vh] w-full rounded border"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
