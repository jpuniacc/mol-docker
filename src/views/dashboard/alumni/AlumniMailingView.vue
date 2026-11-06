<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  CheckCircle2,
  Copy,
  Download,
  Link2,
  Mail,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
  X,
} from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { toast } from 'vue-sonner'

import EChart from '@/components/reportes/pagos/EChart.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  downloadUrlPublica,
  listarAlumniMailing,
  type AlumniMailingFila,
  type AlumniMailingPorLote,
  type AlumniMailingResumen,
  type AlumniMailingSerieDia,
} from '@/services/alumniMailingAdminApi'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

type EstadoUi = 'todos' | 'descargado' | 'enviado' | 'pendiente' | 'error'
type DescargaUi = 'todas' | 'si' | 'no'
type RangoSerie = '14' | '30' | 'todo'

const PAGE_SIZE = 25

const loading = ref(false)
const lotes = ref<string[]>([])
const resumen = ref<AlumniMailingResumen>({
  total: 0,
  pending: 0,
  sent: 0,
  error: 0,
  downloaded: 0,
})
const serieDiaria = ref<AlumniMailingSerieDia[]>([])
const porLote = ref<AlumniMailingPorLote[]>([])

const lote = ref('todos')
const estadoUi = ref<EstadoUi>('todos')
const descargaUi = ref<DescargaUi>('todas')
const q = ref('')
const qDebounced = ref('')
const page = ref(1)
const rangoSerie = ref<RangoSerie>('14')
const actualizado = ref<Date | null>(null)

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' })
}

function estadoDisplay(fila: AlumniMailingFila): Exclude<EstadoUi, 'todos'> {
  if (fila.status === 'error') return 'error'
  if (fila.downloaded_at) return 'descargado'
  if (fila.status === 'sent') return 'enviado'
  return 'pendiente'
}

const ESTADO_LABEL: Record<Exclude<EstadoUi, 'todos'>, string> = {
  descargado: 'Descargado',
  enviado: 'Enviado',
  pendiente: 'Pendiente',
  error: 'Error',
}

const ESTADO_BADGE: Record<Exclude<EstadoUi, 'todos'>, string> = {
  descargado: 'border-sky-200 bg-sky-50 text-sky-800',
  enviado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  pendiente: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
}

const todasFilas = ref<AlumniMailingFila[]>([])

async function cargar(): Promise<void> {
  loading.value = true
  try {
    // KPIs/gráficos globales del lote(+q); estado/descarga filtran solo la tabla
    const list = await listarAlumniMailing({
      lote: lote.value === 'todos' ? null : lote.value,
      q: qDebounced.value.trim() || null,
      limit: 2000,
      offset: 0,
    })
    if (!list.ok) {
      mostrarErrorRematricula(`Error al cargar mailing: ${list.error}`)
      return
    }
    todasFilas.value = list.filas
    lotes.value = list.lotes
    resumen.value = list.resumen
    serieDiaria.value = list.serie_diaria
    porLote.value = list.por_lote
    actualizado.value = new Date()
    page.value = 1
  } finally {
    loading.value = false
  }
}

const filasFiltradas = computed(() => {
  let rows = todasFilas.value
  if (estadoUi.value === 'pendiente') {
    rows = rows.filter((f) => f.status === 'pending')
  } else if (estadoUi.value === 'error') {
    rows = rows.filter((f) => f.status === 'error')
  } else if (estadoUi.value === 'enviado') {
    rows = rows.filter((f) => f.status === 'sent' && !f.downloaded_at)
  } else if (estadoUi.value === 'descargado') {
    rows = rows.filter((f) => Boolean(f.downloaded_at))
  }
  if (descargaUi.value === 'si') {
    rows = rows.filter((f) => Boolean(f.downloaded_at))
  } else if (descargaUi.value === 'no') {
    rows = rows.filter((f) => !f.downloaded_at)
  }
  return rows
})

const totalFiltrado = computed(() => filasFiltradas.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalFiltrado.value / PAGE_SIZE)))
const pageStart = computed(() =>
  totalFiltrado.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1,
)
const pageEnd = computed(() => Math.min(page.value * PAGE_SIZE, totalFiltrado.value))
const filasPagina = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filasFiltradas.value.slice(start, start + PAGE_SIZE)
})

const pct = (n: number, den: number) => {
  if (!den) return '0%'
  return `${Math.round((n / den) * 100)}%`
}

type KpiId = 'total' | 'enviados' | 'descargados' | 'pendientes' | 'errores'
const kpis = computed(() => {
  const r = resumen.value
  const den = r.total || 1
  return [
    {
      id: 'total' as KpiId,
      label: 'Total destinatarios',
      value: r.total,
      sub: '100%',
      icon: Users,
      active: estadoUi.value === 'todos' && descargaUi.value === 'todas',
    },
    {
      id: 'enviados' as KpiId,
      label: 'Enviados',
      value: r.sent,
      sub: pct(r.sent, den),
      icon: Mail,
      active: estadoUi.value === 'enviado',
    },
    {
      id: 'descargados' as KpiId,
      label: 'Descargados',
      value: r.downloaded,
      sub: pct(r.downloaded, r.sent || den),
      icon: Download,
      active: estadoUi.value === 'descargado',
    },
    {
      id: 'pendientes' as KpiId,
      label: 'Pendientes de envío',
      value: r.pending,
      sub: pct(r.pending, den),
      icon: CheckCircle2,
      active: estadoUi.value === 'pendiente',
    },
    {
      id: 'errores' as KpiId,
      label: 'Errores',
      value: r.error,
      sub: pct(r.error, den),
      icon: TriangleAlert,
      active: estadoUi.value === 'error',
    },
  ]
})

function clickKpi(id: KpiId): void {
  page.value = 1
  if (id === 'total') {
    estadoUi.value = 'todos'
    descargaUi.value = 'todas'
  } else if (id === 'enviados') {
    estadoUi.value = 'enviado'
    descargaUi.value = 'todas'
  } else if (id === 'descargados') {
    estadoUi.value = 'descargado'
    descargaUi.value = 'todas'
  } else if (id === 'pendientes') {
    estadoUi.value = 'pendiente'
    descargaUi.value = 'todas'
  } else {
    estadoUi.value = 'error'
    descargaUi.value = 'todas'
  }
}

const chips = computed(() => {
  const out: { key: string; label: string; clear: () => void }[] = []
  if (qDebounced.value.trim()) {
    out.push({
      key: 'q',
      label: `Búsqueda: ${qDebounced.value.trim()}`,
      clear: () => {
        q.value = ''
        qDebounced.value = ''
      },
    })
  }
  if (lote.value !== 'todos') {
    out.push({
      key: 'lote',
      label: `Lote: ${lote.value}`,
      clear: () => {
        lote.value = 'todos'
      },
    })
  }
  if (estadoUi.value !== 'todos') {
    out.push({
      key: 'estado',
      label: `Estado: ${ESTADO_LABEL[estadoUi.value]}`,
      clear: () => {
        estadoUi.value = 'todos'
      },
    })
  }
  if (descargaUi.value !== 'todas') {
    out.push({
      key: 'dl',
      label: `Descarga: ${descargaUi.value === 'si' ? 'Sí' : 'No'}`,
      clear: () => {
        descargaUi.value = 'todas'
      },
    })
  }
  return out
})

function limpiarFiltros(): void {
  lote.value = 'todos'
  estadoUi.value = 'todos'
  descargaUi.value = 'todas'
  q.value = ''
  qDebounced.value = ''
  page.value = 1
}

const serieFiltrada = computed(() => {
  const rows = [...serieDiaria.value].sort((a, b) => a.dia.localeCompare(b.dia))
  if (rangoSerie.value === 'todo') return rows
  const n = rangoSerie.value === '14' ? 14 : 30
  return rows.slice(-n)
})

const optSerie = computed(() => {
  const rows = serieFiltrada.value
  return {
    color: ['#16a34a', '#0284c7'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['Enviados', 'Descargados'], bottom: 0 },
    grid: { left: 40, right: 16, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.dia.slice(5)),
    },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        name: 'Enviados',
        type: 'line',
        smooth: true,
        data: rows.map((r) => r.enviados),
      },
      {
        name: 'Descargados',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dashed' },
        data: rows.map((r) => r.descargados),
      },
    ],
  }
})

const optLotes = computed(() => {
  const rows = porLote.value
  return {
    color: ['#0284c7', '#16a34a', '#eab308', '#e11d48'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: ['Descargado', 'Enviado sin descarga', 'Pendiente', 'Error'],
      bottom: 0,
    },
    grid: { left: 100, right: 24, top: 16, bottom: 48 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.lote),
    },
    series: [
      {
        name: 'Descargado',
        type: 'bar',
        stack: 't',
        data: rows.map((r) => r.downloaded),
      },
      {
        name: 'Enviado sin descarga',
        type: 'bar',
        stack: 't',
        data: rows.map((r) => r.sent_sin_dl),
      },
      {
        name: 'Pendiente',
        type: 'bar',
        stack: 't',
        data: rows.map((r) => r.pending),
      },
      {
        name: 'Error',
        type: 'bar',
        stack: 't',
        data: rows.map((r) => r.error),
      },
    ],
  }
})

function exportarExcel(): void {
  const matriz = [
    [
      'Nombre',
      'Email',
      'Lote',
      'Estado',
      'Enviado',
      'Descargado',
      '# DL',
      'Error',
      'Token',
      'URL',
    ],
    ...filasFiltradas.value.map((f) => [
      f.nombre,
      f.email,
      f.lote,
      ESTADO_LABEL[estadoDisplay(f)],
      f.sent_at ?? '',
      f.downloaded_at ?? '',
      f.download_count,
      f.error_message ?? '',
      f.token,
      downloadUrlPublica(f.token),
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(matriz)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Mailing')
  XLSX.writeFile(wb, `alumni-mailing-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

async function copiarLink(token: string): Promise<void> {
  const url = downloadUrlPublica(token)
  try {
    await navigator.clipboard.writeText(url)
    toast.success('Link copiado')
  } catch {
    toast.error('No se pudo copiar el link')
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(q, (v) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    qDebounced.value = v
    page.value = 1
  }, 350)
})

watch([lote, qDebounced], () => {
  void cargar()
})

watch([estadoUi, descargaUi], () => {
  page.value = 1
})

async function copiarEmail(email: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(email)
    toast.success('Email copiado')
  } catch {
    toast.error('No se pudo copiar el email')
  }
}

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="space-y-5 p-4 md:p-6">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-[var(--color-navy,#1E3A5F)]">
          Alumni · Mailing
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Envío y descarga de fotografías profesionales
          <span v-if="actualizado">
            · Actualizado {{ fmtFecha(actualizado.toISOString()) }}
          </span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer"
          :disabled="loading"
          @click="cargar"
        >
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />
          Actualizar
        </Button>
        <Button
          type="button"
          class="cursor-pointer"
          :disabled="filasFiltradas.length === 0"
          @click="exportarExcel"
        >
          <Download class="mr-2 h-4 w-4" />
          Excel (filtros aplicados)
        </Button>
      </div>
    </div>

    <Card>
      <CardContent class="flex flex-col gap-3 pt-6">
        <div class="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div class="relative min-w-[220px] flex-1">
            <Search class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="q"
              type="search"
              placeholder="Buscar nombre o email…"
              class="pl-8"
            />
          </div>
          <Select v-model="lote">
            <SelectTrigger class="w-full lg:w-44">
              <SelectValue placeholder="Lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los lotes</SelectItem>
              <SelectItem v-for="l in lotes" :key="l" :value="l">{{ l }}</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="estadoUi">
            <SelectTrigger class="w-full lg:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="descargado">Descargado</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="descargaUi">
            <SelectTrigger class="w-full lg:w-40">
              <SelectValue placeholder="Descarga" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="si">Con descarga</SelectItem>
              <SelectItem value="no">Sin descarga</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            class="cursor-pointer"
            :disabled="chips.length === 0"
            @click="limpiarFiltros"
          >
            Limpiar
          </Button>
        </div>
        <div v-if="chips.length" class="flex flex-wrap gap-2">
          <button
            v-for="c in chips"
            :key="c.key"
            type="button"
            class="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs text-white"
            @click="c.clear()"
          >
            {{ c.label }}
            <X class="h-3 w-3" />
          </button>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <button
        v-for="k in kpis"
        :key="k.id"
        type="button"
        class="cursor-pointer rounded-xl border bg-white text-left shadow-sm transition hover:border-[var(--color-celeste,#3B9EC9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="k.active ? 'border-[var(--color-pink,#D91B7A)] ring-1 ring-[var(--color-pink,#D91B7A)]' : 'border-border'"
        @click="clickKpi(k.id)"
      >
        <div class="flex items-start justify-between p-4">
          <div>
            <p class="text-xs font-medium text-muted-foreground">{{ k.label }}</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ k.value }}</p>
            <p class="mt-0.5 text-xs text-muted-foreground">{{ k.sub }}</p>
            <p class="mt-2 text-[11px] text-[var(--color-celeste,#3B9EC9)]">Clic → filtra tabla</p>
          </div>
          <component :is="k.icon" class="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle class="text-base">Envíos y descargas por día</CardTitle>
            <CardDescription>Serie temporal (zona America/Santiago)</CardDescription>
          </div>
          <div class="flex gap-1">
            <Button
              v-for="r in (['14', '30', 'todo'] as RangoSerie[])"
              :key="r"
              type="button"
              size="sm"
              variant="outline"
              class="h-7 cursor-pointer px-2 text-xs"
              :class="rangoSerie === r ? 'bg-slate-900 text-white' : ''"
              @click="rangoSerie = r"
            >
              {{ r === 'todo' ? 'Todo' : `${r} días` }}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <EChart v-if="serieFiltrada.length" :option="optSerie" height="260px" />
          <p v-else class="py-10 text-center text-sm text-muted-foreground">
            Sin datos de serie aún
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Estado por lote</CardTitle>
          <CardDescription>Distribución apilada por lote</CardDescription>
        </CardHeader>
        <CardContent>
          <EChart v-if="porLote.length" :option="optLotes" height="260px" />
          <p v-else class="py-10 text-center text-sm text-muted-foreground">Sin lotes</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Envíos ({{ totalFiltrado }} registros)</CardTitle>
          <CardDescription>
            {{ PAGE_SIZE }} filas/página · encabezado fijo al hacer scroll
          </CardDescription>
        </div>
        <p v-if="totalFiltrado" class="text-sm text-muted-foreground">
          Mostrando {{ pageStart }}–{{ pageEnd }} de {{ totalFiltrado }}
        </p>
      </CardHeader>
      <CardContent>
        <div class="max-h-[28rem] overflow-auto rounded-md border">
          <Table>
            <TableHeader class="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow>
                <TableHead>Destinatario</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Descargado</TableHead>
                <TableHead class="text-right"># DL</TableHead>
                <TableHead>Error</TableHead>
                <TableHead class="w-[88px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && todasFilas.length === 0">
                <TableCell colspan="8" class="py-10 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
              <TableRow v-else-if="filasFiltradas.length === 0">
                <TableCell colspan="8" class="py-12 text-center">
                  <Search class="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                  <p class="font-medium">
                    Sin resultados
                    <span v-if="qDebounced.trim()"> para «{{ qDebounced.trim() }}»</span>
                  </p>
                  <p class="mt-1 text-sm text-muted-foreground">
                    Ningún envío coincide con la búsqueda y los filtros.
                  </p>
                  <Button
                    type="button"
                    class="mt-4 cursor-pointer"
                    variant="outline"
                    @click="limpiarFiltros"
                  >
                    Limpiar filtros
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-for="fila in filasPagina" :key="fila.token">
                <TableCell>
                  <div class="max-w-[240px]">
                    <p class="truncate font-medium" :title="fila.nombre">{{ fila.nombre }}</p>
                    <p class="truncate text-xs text-muted-foreground" :title="fila.email">
                      {{ fila.email }}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{{ fila.lote }}</TableCell>
                <TableCell>
                  <Badge variant="outline" :class="ESTADO_BADGE[estadoDisplay(fila)]">
                    {{ ESTADO_LABEL[estadoDisplay(fila)] }}
                  </Badge>
                </TableCell>
                <TableCell class="whitespace-nowrap text-sm">
                  {{ fmtFecha(fila.sent_at) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-sm">
                  {{ fmtFecha(fila.downloaded_at) }}
                </TableCell>
                <TableCell class="text-right tabular-nums">{{ fila.download_count }}</TableCell>
                <TableCell
                  class="max-w-[160px] truncate text-sm text-rose-700"
                  :title="fila.error_message || ''"
                >
                  {{ fila.error_message || '—' }}
                </TableCell>
                <TableCell>
                  <div class="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="h-8 w-8 cursor-pointer"
                      title="Copiar link de descarga"
                      @click="copiarLink(fila.token)"
                    >
                      <Link2 class="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="h-8 w-8 cursor-pointer"
                      title="Copiar email"
                      @click="copiarEmail(fila.email)"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div
          v-if="totalFiltrado > 0"
          class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-sm text-muted-foreground">
            Mostrando {{ pageStart }}–{{ pageEnd }} de {{ totalFiltrado }} · Página
            {{ page }} / {{ totalPages }}
          </p>
          <div class="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="cursor-pointer"
              :disabled="page <= 1"
              @click="page -= 1"
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="cursor-pointer"
              :disabled="page >= totalPages"
              @click="page += 1"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
