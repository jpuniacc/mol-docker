<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { toast } from 'vue-sonner'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { listarGestionPagos } from '@/services/gestionPagosApi'
import EChart from '@/components/reportes/pagos/EChart.vue'
import {
  aplicaFiltroAntiguedad,
  bucketAntiguedad,
  diasDesdePago,
  etiquetaBucket,
  etiquetaDias,
  filasGestionPagosACsv,
  filasGestionPagosAMatriz,
  porCarreraGestionPagos,
  resumirAntiguedad,
  telefonoWhatsAppUrl,
  type BucketAntiguedad,
  type FilaGestionPagos,
  type FiltroAntiguedad,
} from '@/utils/gestionPagos'

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

const PAGE_SIZE = 25
const C_0_2 = '#10b981'
const C_3_7 = '#f59e0b'
const C_7 = '#ec4899'
const C_TOTAL = '#0f172a'

const periodoActivo = usePeriodoActivoStore()
const rows = ref<FilaGestionPagos[]>([])
const loading = ref(false)
const busqueda = ref('')
const carrera = ref('')
const antigüedad = ref<FiltroAntiguedad>('todas')
const actualizado = ref<Date | null>(null)
const dialogOpen = ref(false)
const seleccionado = ref<FilaGestionPagos | null>(null)

const tienePeriodo = computed(
  () => periodoActivo.anio != null && periodoActivo.semestre != null,
)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

const ahoraRef = computed(() => actualizado.value ?? new Date())

const filasTrasBusqueda = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    return (
      row.rut.toLowerCase().includes(q) ||
      row.nombre.toLowerCase().includes(q) ||
      row.codcli.toLowerCase().includes(q)
    )
  })
})

const filasBase = computed(() => {
  const c = carrera.value.trim()
  if (!c) return filasTrasBusqueda.value
  return filasTrasBusqueda.value.filter((f) => f.carrera === c)
})

const resumen = computed(() => resumirAntiguedad(filasBase.value, ahoraRef.value))

const filasVisibles = computed(() =>
  filasBase.value.filter((f) => aplicaFiltroAntiguedad(f, antigüedad.value, ahoraRef.value)),
)

const carrerasDisponibles = computed(() =>
  [...new Set(rows.value.map((f) => f.carrera).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  ),
)

const tituloTabla = computed(() => {
  if (antigüedad.value === '7+') return 'Alumnos a contactar · prioridad'
  if (antigüedad.value !== 'todas') return `Alumnos a contactar · ${etiquetaBucket(antigüedad.value)}`
  return 'Alumnos a contactar'
})

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

watch([busqueda, carrera, antigüedad], resetPage)

const pct = (n: number, t: number) => (t > 0 ? Math.round((n * 100) / t) : 0)

type CardKpi = {
  id: FiltroAntiguedad
  titulo: string
  n: number
  pct: number
  sub: string
  barra: string
  borde: string
  prioridad?: boolean
}

const cards = computed<CardKpi[]>(() => {
  const r = resumen.value
  const t = r.total
  return [
    {
      id: 'todas',
      titulo: 'Pendientes de arancel',
      n: r.total,
      pct: 100,
      sub: 'Lista operativa · contactar',
      barra: 'bg-slate-800',
      borde: 'border-slate-300',
    },
    {
      id: '0-2',
      titulo: '0–2 días',
      n: r.d0_2,
      pct: pct(r.d0_2, t),
      sub: 'Recién pagaron matrícula',
      barra: 'bg-emerald-500',
      borde: 'border-emerald-200',
    },
    {
      id: '3-7',
      titulo: '3–7 días',
      n: r.d3_7,
      pct: pct(r.d3_7, t),
      sub: 'Seguimiento esta semana',
      barra: 'bg-amber-500',
      borde: 'border-amber-200',
    },
    {
      id: '7+',
      titulo: 'Más de 7 días',
      n: r.d7,
      pct: pct(r.d7, t),
      sub: '⚠ Prioridad de contacto',
      barra: 'bg-pink-500',
      borde: 'border-pink-300',
      prioridad: true,
    },
  ]
})

const optDonut = computed(() => {
  const r = resumen.value
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      textStyle: { fontSize: 11, color: '#475569' },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '44%'],
        label: {
          show: true,
          position: 'center',
          formatter: () => `${r.total}\npendientes`,
          fontSize: 14,
          fontWeight: 700,
          color: C_TOTAL,
          lineHeight: 18,
        },
        emphasis: { label: { show: true } },
        data: [
          { name: '0–2 d', value: r.d0_2, itemStyle: { color: C_0_2 } },
          { name: '3–7 d', value: r.d3_7, itemStyle: { color: C_3_7 } },
          { name: '+7 d', value: r.d7, itemStyle: { color: C_7 } },
        ],
      },
    ],
  }
})

const datosCarrera = computed(() => porCarreraGestionPagos(filasBase.value, 7).reverse())

const optCarrera = computed(() => ({
  grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  xAxis: {
    type: 'value',
    minInterval: 1,
    axisLabel: { fontSize: 10, color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
  yAxis: {
    type: 'category',
    data: datosCarrera.value.map((d) => d.carrera),
    axisLabel: { fontSize: 10, color: '#334155', width: 140, overflow: 'truncate' },
    axisLine: { lineStyle: { color: '#e2e8f0' } },
  },
  series: [
    {
      type: 'bar',
      barMaxWidth: 16,
      itemStyle: { color: '#4D98C5', borderRadius: [0, 4, 4, 0] },
      data: datosCarrera.value.map((d) => d.n),
      label: { show: true, position: 'right', fontSize: 11, color: '#334155' },
    },
  ],
}))

function clickDonut(p: { name?: string }): void {
  const n = (p.name ?? '').toLowerCase()
  if (n.includes('0–2') || n.includes('0-2')) antigüedad.value = '0-2'
  else if (n.includes('3–7') || n.includes('3-7')) antigüedad.value = '3-7'
  else if (n.includes('+7') || n.includes('7')) antigüedad.value = '7+'
}

function clickCarrera(p: { name?: string }): void {
  const name = p.name?.trim()
  if (!name || name === 'Otras') return
  if (carrerasDisponibles.value.includes(name)) carrera.value = name
}

function setAntiguedad(id: FiltroAntiguedad): void {
  if (id === 'todas') {
    antigüedad.value = 'todas'
    return
  }
  antigüedad.value = antigüedad.value === id ? 'todas' : id
}

function etiquetaFiltroAntiguedad(f: FiltroAntiguedad): string {
  if (f === 'todas') return 'Todas'
  return etiquetaBucket(f)
}

function limpiarFiltros(): void {
  busqueda.value = ''
  carrera.value = ''
  antigüedad.value = 'todas'
  resetPage()
}

const hayFiltros = computed(
  () =>
    busqueda.value.trim() !== '' ||
    carrera.value !== '' ||
    antigüedad.value !== 'todas',
)

function formatoFecha(iso: string | null): string {
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

function celda(v: string): string {
  return v.trim() ? v : '—'
}

function badgeClass(bucket: BucketAntiguedad | null): string {
  if (bucket === '0-2') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (bucket === '3-7') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (bucket === '7+') return 'border-pink-200 bg-pink-50 text-pink-800'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function diasDe(f: FilaGestionPagos): number | null {
  return diasDesdePago(f.fechaPagoMatricula, ahoraRef.value)
}

function bucketDe(f: FilaGestionPagos): BucketAntiguedad | null {
  return bucketAntiguedad(diasDe(f))
}

async function cargar(): Promise<void> {
  if (!tienePeriodo.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const res = await listarGestionPagos(periodoActivo.anio!, periodoActivo.semestre!)
    if (res.error) {
      mostrarErrorRematricula(res.error)
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

function nombreArchivo(): string {
  return `gestion-pagos-${periodoActivo.anio}-${periodoActivo.semestre}`
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
    new Blob(['\ufeff' + filasGestionPagosACsv(filasVisibles.value, ahoraRef.value)], {
      type: 'text/csv;charset=utf-8',
    }),
    `${nombreArchivo()}.csv`,
  )
}

function exportarExcel(): void {
  const ws = XLSX.utils.aoa_to_sheet(filasGestionPagosAMatriz(filasVisibles.value, ahoraRef.value))
  ws['!cols'] = [14, 32, 14, 28, 14, 28, 22, 10].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gestión Pagos')
  XLSX.writeFile(wb, `${nombreArchivo()}.xlsx`)
}

async function copiarCorreo(email: string): Promise<void> {
  const t = email.trim()
  if (!t) {
    toast.message('Sin correo validado')
    return
  }
  try {
    await navigator.clipboard.writeText(t)
    toast.success('Correo copiado')
  } catch {
    toast.error('No se pudo copiar el correo')
  }
}

function abrirWhatsApp(tel: string): void {
  const url = telefonoWhatsAppUrl(tel)
  if (!url) {
    toast.message('Teléfono no válido para WhatsApp')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function verCaso(row: FilaGestionPagos): void {
  seleccionado.value = row
  dialogOpen.value = true
}

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  await cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-5">
    <Card>
      <CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <CardTitle>Gestión Pagos</CardTitle>
          <CardDescription>
            Alumnos con matrícula Webpay autorizada en
            <span class="font-medium text-foreground">{{ periodoLabel }}</span>
            que aún no cerraron arancel
            <template v-if="actualizado">
              · Actualizado hoy {{ actualizadoLabel() }}
            </template>
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="loading || !tienePeriodo"
            @click="cargar"
          >
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
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-[220px] flex-1">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="busqueda"
              class="pl-8"
              placeholder="Buscar RUT, nombre o codcli…"
            />
          </div>
          <select
            v-model="carrera"
            class="h-9 min-w-[200px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Carrera"
          >
            <option value="">Carrera: Todas</option>
            <option v-for="c in carrerasDisponibles" :key="c" :value="c">{{ c }}</option>
          </select>
          <select
            v-model="antigüedad"
            class="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Antigüedad"
          >
            <option value="todas">Antigüedad: Todas</option>
            <option value="0-2">0–2 días</option>
            <option value="3-7">3–7 días</option>
            <option value="7+">+7 días</option>
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :disabled="!hayFiltros"
            @click="limpiarFiltros"
          >
            <X class="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        </div>
        <div v-if="hayFiltros" class="flex flex-wrap gap-2">
          <Badge
            v-if="busqueda.trim()"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="busqueda = ''"
          >
            Búsqueda: {{ busqueda.trim() }}
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
            v-if="antigüedad !== 'todas'"
            variant="secondary"
            class="cursor-pointer gap-1"
            @click="antigüedad = 'todas'"
          >
            Antigüedad: {{ etiquetaFiltroAntiguedad(antigüedad) }}
            <X class="h-3 w-3" />
          </Badge>
        </div>
        <p v-if="!tienePeriodo" class="text-sm text-muted-foreground">
          No hay periodo académico activo configurado.
        </p>
      </CardContent>
    </Card>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="c in cards"
        :key="c.id"
        type="button"
        class="relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="[
          c.borde,
          antigüedad === c.id ? 'ring-2 ring-offset-1 ring-slate-400' : '',
          c.id === '7+' && antigüedad === '7+' ? 'ring-pink-400' : '',
        ]"
        @click="setAntiguedad(c.id)"
      >
        <div class="absolute inset-x-0 top-0 h-1.5" :class="c.barra" />
        <p class="text-xs font-medium text-muted-foreground">{{ c.titulo }}</p>
        <p class="mt-1 text-3xl font-bold tabular-nums tracking-tight">{{ c.n }}</p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full" :class="c.barra" :style="{ width: `${c.pct}%` }" />
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          <span class="font-semibold text-foreground">{{ c.pct }}%</span>
          {{ c.sub }}
        </p>
        <p class="mt-2 text-[11px] font-medium text-orange-600">Clic → filtra tabla</p>
      </button>
    </div>

    <div
      v-if="rows.length > 0"
      class="grid gap-4 lg:grid-cols-2"
    >
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Antigüedad desde pago matrícula</CardTitle>
        </CardHeader>
        <CardContent>
          <EChart :option="optDonut" height="260px" @click="clickDonut" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Pendientes por carrera</CardTitle>
        </CardHeader>
        <CardContent>
          <EChart :option="optCarrera" height="260px" @click="clickCarrera" />
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle class="text-base">
            {{ tituloTabla }}
            <span class="font-normal text-muted-foreground">
              ({{ filasVisibles.length }} registro{{ filasVisibles.length === 1 ? '' : 's' }})
            </span>
          </CardTitle>
        </div>
        <p class="text-[11px] text-muted-foreground">
          Filas compactas · {{ PAGE_SIZE }} por página
        </p>
      </CardHeader>
      <CardContent class="space-y-4 pt-2">
        <div
          v-if="!loading && rows.length === 0"
          class="flex flex-col items-center justify-center gap-3 py-16 text-center"
        >
          <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircle2 class="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p class="text-lg font-semibold">Sin pendientes de arancel</p>
            <p class="mt-1 max-w-md text-sm text-muted-foreground">
              Todos los alumnos con matrícula Webpay en {{ periodoLabel }} ya cerraron arancel
              (Webpay o contrato TuFirma).
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" @click="cargar">
            <RefreshCw class="mr-1.5 h-4 w-4" />
            Actualizar
          </Button>
        </div>

        <div
          v-else-if="!loading && filasVisibles.length === 0"
          class="py-12 text-center text-sm text-muted-foreground"
        >
          Ningún alumno coincide con los filtros actuales.
          <Button type="button" variant="link" class="px-1" @click="limpiarFiltros">
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
                  <TableHead>Antigüedad</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead class="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="loading">
                  <TableCell colspan="6" class="text-muted-foreground">Cargando…</TableCell>
                </TableRow>
                <TableRow v-for="row in filasPagina" :key="row.codcli" class="align-top">
                  <TableCell class="py-2.5">
                    <div class="font-medium leading-tight">{{ celda(row.nombre) }}</div>
                    <div class="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {{ celda(row.rut) }}
                      <span v-if="row.codcli"> · {{ row.codcli }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="max-w-[220px] py-2.5">
                    <span class="line-clamp-2 text-sm leading-snug" :title="row.carrera || undefined">
                      {{ celda(row.carrera) }}
                    </span>
                  </TableCell>
                  <TableCell class="py-2.5">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                      :class="badgeClass(bucketDe(row))"
                    >
                      {{ etiquetaDias(diasDe(row)) }}
                    </span>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ formatoFecha(row.fechaPagoMatricula) }}
                    </div>
                  </TableCell>
                  <TableCell class="py-2.5 whitespace-nowrap text-sm">
                    {{ celda(row.telefono) }}
                  </TableCell>
                  <TableCell class="max-w-[200px] py-2.5 truncate text-sm" :title="row.email || undefined">
                    {{ celda(row.email) }}
                  </TableCell>
                  <TableCell class="py-2.5">
                    <div class="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                        title="Copiar correo"
                        @click="copiarCorreo(row.email)"
                      >
                        <Mail class="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                        title="WhatsApp"
                        @click="abrirWhatsApp(row.telefono)"
                      >
                        <MessageCircle class="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8"
                        title="Ver caso"
                        @click="verCaso(row)"
                      >
                        <Eye class="h-4 w-4" />
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
              · Filas: {{ PAGE_SIZE }}
            </p>
            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="page <= 1"
                @click="irAPaginaAnterior"
              >
                <ChevronLeft class="h-4 w-4" />
                Anterior
              </Button>
              <span class="text-xs text-muted-foreground">{{ page }} / {{ totalPages }}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="page >= totalPages"
                @click="irAPaginaSiguiente"
              >
                Siguiente
                <ChevronRight class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle alumno</DialogTitle>
          <DialogDescription>Datos de contacto y pago de matrícula</DialogDescription>
        </DialogHeader>
        <div v-if="seleccionado" class="space-y-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground">Alumno</p>
            <p class="font-medium">{{ celda(seleccionado.nombre) }}</p>
            <p class="font-mono text-xs text-muted-foreground">
              {{ celda(seleccionado.rut) }} · {{ seleccionado.codcli }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Carrera</p>
            <p>{{ celda(seleccionado.carrera) }}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs text-muted-foreground">Teléfono</p>
              <p>{{ celda(seleccionado.telefono) }}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">Email</p>
              <p class="break-all">{{ celda(seleccionado.email) }}</p>
            </div>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Pago matrícula</p>
            <p>{{ formatoFecha(seleccionado.fechaPagoMatricula) }}</p>
            <p class="text-xs text-muted-foreground">
              Antigüedad: {{ etiquetaDias(diasDe(seleccionado)) }}
            </p>
          </div>
          <div class="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="copiarCorreo(seleccionado.email)"
            >
              <Copy class="mr-1.5 h-4 w-4" />
              Copiar correo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              @click="abrirWhatsApp(seleccionado.telefono)"
            >
              <MessageCircle class="mr-1.5 h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
