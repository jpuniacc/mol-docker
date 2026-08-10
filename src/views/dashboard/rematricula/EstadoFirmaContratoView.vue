<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { RefreshCw, FileText, FileX2, FileSignature, ChevronLeft, ChevronRight, Eye, ChevronDown, Search, X, Download, ExternalLink, Clock } from 'lucide-vue-next'
import { useFirmaAcepta, type FirmaAceptaRow } from '@/composables/useFirmaAcepta'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { admisionApiBaseUrl } from '@/constants/admisionApi'

const { data, total, lastSync, loading, syncing, hasNewData, error, fetchFirmaAcepta, syncFirmaAceptaBackground } = useFirmaAcepta()
const { nextRefreshMessage } = useAutoRefresh()

// PDFs servidos por uniacc-api (filesystem bajo STORAGE_PATH)
function verDocumentoFirmado(tipo: 'contratos' | 'mandatos', rut: string | null, codigo: string | null) {
  if (!rut || !codigo) return
  const url = `${admisionApiBaseUrl()}/api/firma-acepta/documento/${tipo}/${rut}/${codigo}`
  window.open(url, '_blank')
}

// Filtros
const filtroRut = ref('')
const filtroNombre = ref('')
const filtroFirmaFaltante = ref<string>('')

const opcionesFirmaFaltante = ['AMBOS', 'CONTRATO', 'MANDATO', 'NINGUNA']

// Datos filtrados
const dataFiltrada = computed(() => {
  let resultado = data.value

  // Filtro por RUT
  if (filtroRut.value.trim()) {
    const busqueda = filtroRut.value.trim().toLowerCase()
    resultado = resultado.filter((r) => r.rut?.toLowerCase().includes(busqueda))
  }

  // Filtro por Nombre (busca en paterno, materno y nombre)
  if (filtroNombre.value.trim()) {
    const busqueda = filtroNombre.value.trim().toLowerCase()
    resultado = resultado.filter((r) => {
      const nombreCompleto = [r.paterno, r.materno, r.nombre].filter(Boolean).join(' ').toLowerCase()
      return nombreCompleto.includes(busqueda)
    })
  }

  // Filtro por Firma Faltante
  if (filtroFirmaFaltante.value) {
    resultado = resultado.filter((r) => r.firma_faltante === filtroFirmaFaltante.value)
  }

  return resultado
})

function limpiarFiltros() {
  filtroRut.value = ''
  filtroNombre.value = ''
  filtroFirmaFaltante.value = ''
  page.value = 1
}

const hayFiltrosActivos = computed(() => 
  filtroRut.value.trim() !== '' || filtroNombre.value.trim() !== '' || filtroFirmaFaltante.value !== ''
)

const detalleOpen = ref(false)
const detalleSeleccionado = ref<FirmaAceptaRow | null>(null)

function verDetalle(r: FirmaAceptaRow) {
  detalleSeleccionado.value = r
  accordionDetalle.value = new Set(['alumno'])
  detalleOpen.value = true
}

function cerrarDetalle() {
  detalleOpen.value = false
  detalleSeleccionado.value = null
}

function handleDetalleOpenChange(v: boolean) {
  detalleOpen.value = v
  if (!v) detalleSeleccionado.value = null
}

const PAGE_SIZE = 10
const page = ref(1)

const countAmbos = computed(() => data.value.filter((r) => r.firma_faltante === 'AMBOS').length)
const countSoloContrato = computed(() => data.value.filter((r) => r.firma_faltante === 'CONTRATO').length)
const countSoloMandato = computed(() => data.value.filter((r) => r.firma_faltante === 'MANDATO').length)
const countNinguna = computed(() => data.value.filter((r) => r.firma_faltante === 'NINGUNA').length)
const countFaltantes = computed(() => countAmbos.value + countSoloContrato.value + countSoloMandato.value)

// Estado del sheet lateral
const sheetOpen = ref(false)
const sheetTipo = ref<'TOTAL' | 'COMPLETADOS' | 'FALTANTES' | 'AMBOS' | 'CONTRATO' | 'MANDATO'>('TOTAL')

// Datos filtrados para el sheet según el tipo seleccionado
const sheetData = computed(() => {
  switch (sheetTipo.value) {
    case 'TOTAL':
      return data.value
    case 'COMPLETADOS':
      return data.value.filter((r) => r.firma_faltante === 'NINGUNA')
    case 'FALTANTES':
      return data.value.filter((r) => r.firma_faltante !== 'NINGUNA')
    case 'AMBOS':
      return data.value.filter((r) => r.firma_faltante === 'AMBOS')
    case 'CONTRATO':
      return data.value.filter((r) => r.firma_faltante === 'CONTRATO')
    case 'MANDATO':
      return data.value.filter((r) => r.firma_faltante === 'MANDATO')
    default:
      return []
  }
})

// Título dinámico del sheet
const sheetTitle = computed(() => {
  const titles: Record<typeof sheetTipo.value, string> = {
    TOTAL: 'Total registros',
    COMPLETADOS: 'Completados',
    FALTANTES: 'Total faltantes',
    AMBOS: 'Faltan ambos',
    CONTRATO: 'Falta solo contrato',
    MANDATO: 'Falta solo mandato',
  }
  return titles[sheetTipo.value]
})

// Función para abrir el sheet
function abrirSheet(tipo: typeof sheetTipo.value) {
  sheetTipo.value = tipo
  sheetOpen.value = true
}

const totalPages = computed(() => Math.max(1, Math.ceil(dataFiltrada.value.length / PAGE_SIZE)))
const dataPaginated = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return dataFiltrada.value.slice(start, start + PAGE_SIZE)
})

// Resetear página al cambiar filtros
watch([filtroRut, filtroNombre, filtroFirmaFaltante], () => {
  page.value = 1
})

function irAPaginaAnterior() {
  if (page.value > 1) page.value--
}
function irAPaginaSiguiente() {
  if (page.value < totalPages.value) page.value++
}

watch(totalPages, () => {
  if (page.value > totalPages.value) page.value = 1
})

onMounted(() => {
  fetchFirmaAcepta()
})

// Sincronización en segundo plano
async function handleRefresh() {
  // Ejecuta sync en segundo plano sin bloquear la UI
  await syncFirmaAceptaBackground()
  // El diálogo se mostrará automáticamente cuando hasNewData sea true
}

// Recargar datos después de confirmar en el diálogo
async function recargarDatos() {
  await fetchFirmaAcepta()
  page.value = 1
}

function formatearFecha(v: string | null | undefined): string {
  if (!v) return '-'
  try {
    return new Date(v).toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(v)
  }
}

function nombreCompleto(r: FirmaAceptaRow): string {
  const p = [r.paterno, r.materno, r.nombre].filter(Boolean).join(' ')
  return p || '-'
}

function firmaFaltanteVariant(f: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!f) return 'outline'
  const v: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    CONTRATO: 'destructive',
    MANDATO: 'destructive',
    AMBOS: 'destructive',
    NINGUNA: 'secondary',
  }
  return v[f] ?? 'outline'
}

const accordionDetalle = ref<Set<string>>(new Set(['alumno']))

function toggleAccordionDetalle(key: string) {
  if (accordionDetalle.value.has(key)) {
    accordionDetalle.value.delete(key)
  } else {
    accordionDetalle.value.add(key)
  }
  accordionDetalle.value = new Set(accordionDetalle.value)
}

// Exportar CSV
function exportarCSV() {
  if (!data.value.length) return

  const headers = [
    'Año Mat',
    'Periodo Mat',
    'CodCli',
    'RUT',
    'Paterno',
    'Materno',
    'Nombre',
    'Email',
    'Email Institucional',
    'Tipo Programa',
    'Cod Facultad',
    'Facultad',
    'Nombre Jornada',
    'Estado Traspaso UMAS',
    'Estado Solicitud',
    'Contrato ID Documento ACEPTA',
    'Contrato Fecha Envío ACEPTA',
    'Contrato Fecha Recepción ACEPTA',
    'Usuario Recepción Contrato',
    'Mandato ID Documento ACEPTA',
    'Mandato Fecha Envío ACEPTA',
    'Mandato Fecha Recepción ACEPTA',
    'Usuario Recepción Mandato',
    'Pendiente Contrato',
    'Pendiente Mandato',
    'Firma Faltante',
    'Apoderado Nombre',
    'Apoderado Paterno',
    'Apoderado Materno',
    'Apoderado Email',
    'Apoderado Celular',
    'Sync Timestamp',
  ]

  const rows = data.value.map((r) => [
    r.ano_mat ?? '',
    r.periodo_mat ?? '',
    r.codcli ?? '',
    r.rut ?? '',
    r.paterno ?? '',
    r.materno ?? '',
    r.nombre ?? '',
    r.mail ?? '',
    r.mail_inst ?? '',
    r.tipo_programa ?? '',
    r.cod_facultad ?? '',
    r.facultad ?? '',
    r.nombre_jornada ?? '',
    r.estado_traspaso_umas ?? '',
    r.descripcion_estado_solicitud ?? '',
    r.contrato_id_documento_acepta ?? '',
    r.contrato_fecha_envio_acepta ? formatearFecha(r.contrato_fecha_envio_acepta) : '',
    r.contrato_fecha_recepcion_acepta ? formatearFecha(r.contrato_fecha_recepcion_acepta) : '',
    r.usuario_recepcion_contrato ?? '',
    r.mandato_id_documento_acepta ?? '',
    r.mandato_fecha_envio_acepta ? formatearFecha(r.mandato_fecha_envio_acepta) : '',
    r.mandato_fecha_recepcion_acepta ? formatearFecha(r.mandato_fecha_recepcion_acepta) : '',
    r.usuario_recepcion_mandato ?? '',
    r.pendiente_contrato ?? '',
    r.pendiente_mandato ?? '',
    r.firma_faltante ?? '',
    r.apod_nombre ?? '',
    r.apod_paterno ?? '',
    r.apod_materno ?? '',
    r.apod_mail ?? '',
    r.apod_celular ?? '',
    r.sync_timestamp ? formatearFecha(r.sync_timestamp) : '',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  // Descargar
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `estado_firma_contrato_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Encabezado -->
    <div class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-primary">Estado Firma Contrato</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ total }} registros
            <template v-if="lastSync">
              · Última sync: {{ formatearFecha(lastSync) }}
            </template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
            <Clock class="h-3.5 w-3.5 text-primary" />
            <span class="text-xs font-semibold text-primary">
              {{ nextRefreshMessage }}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="syncing || loading"
            @click="handleRefresh"
          >
            <RefreshCw :class="['mr-1.5 h-3.5 w-3.5', { 'animate-spin': syncing }]" />
            {{ syncing ? 'Sincronizando...' : 'Actualizar' }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="loading || !data.length"
            @click="exportarCSV"
          >
            <Download class="mr-1.5 h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>
    </div>

    <!-- Cards de resumen - Fila 1: Totales -->
    <div class="grid gap-3 md:grid-cols-2">
      <Card 
        class="overflow-hidden border-l-4 border-l-blue-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('TOTAL')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-sm font-medium">Total registros</CardTitle>
          <div class="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900">
            <FileText class="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-3xl font-bold text-blue-600 dark:text-blue-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ total }}</div>
          <p class="text-xs text-muted-foreground mt-1">Enviados a ACEPTA (completados + faltantes)</p>
        </CardContent>
      </Card>
      <Card 
        class="overflow-hidden border-l-4 border-l-green-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('COMPLETADOS')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-sm font-medium">Completados</CardTitle>
          <div class="rounded-full bg-green-100 p-1.5 dark:bg-green-900">
            <FileSignature class="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-3xl font-bold text-green-600 dark:text-green-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ countNinguna }}</div>
          <p class="text-xs text-muted-foreground mt-1">Contrato y mandato firmados</p>
        </CardContent>
      </Card>
    </div>

    <!-- Cards de resumen - Fila 2: Faltantes -->
    <div class="grid gap-3 md:grid-cols-4">
      <Card 
        class="overflow-hidden border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('FALTANTES')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-sm font-medium">Total faltantes</CardTitle>
          <div class="rounded-full bg-orange-100 p-1.5 dark:bg-orange-900">
            <FileX2 class="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-3xl font-bold text-orange-600 dark:text-orange-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ countFaltantes }}</div>
          <p class="text-xs text-muted-foreground mt-1">Pendientes de firma</p>
        </CardContent>
      </Card>
      <Card 
        class="overflow-hidden border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('AMBOS')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-xs font-medium">Faltan ambos</CardTitle>
          <div class="rounded-full bg-red-100 p-1.5 dark:bg-red-900">
            <FileX2 class="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-2xl font-bold text-red-600 dark:text-red-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ countAmbos }}</div>
          <p class="text-[10px] text-muted-foreground mt-0.5">Contrato y mandato</p>
        </CardContent>
      </Card>
      <Card 
        class="overflow-hidden border-l-4 border-l-purple-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('CONTRATO')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-xs font-medium">Solo contrato</CardTitle>
          <div class="rounded-full bg-purple-100 p-1.5 dark:bg-purple-900">
            <FileText class="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ countSoloContrato }}</div>
          <p class="text-[10px] text-muted-foreground mt-0.5">Falta solo contrato</p>
        </CardContent>
      </Card>
      <Card 
        class="overflow-hidden border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-shadow"
        @click="abrirSheet('MANDATO')"
      >
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3">
          <CardTitle class="text-xs font-medium">Solo mandato</CardTitle>
          <div class="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900">
            <FileSignature class="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent class="pb-3">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400 transition-opacity" :class="{ 'opacity-50': loading }">{{ countSoloMandato }}</div>
          <p class="text-[10px] text-muted-foreground mt-0.5">Falta solo mandato</p>
        </CardContent>
      </Card>
    </div>

    <!-- Filtros -->
    <Card>
      <CardContent class="p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <!-- Filtro RUT -->
          <div class="flex-1 min-w-[150px]">
            <label class="text-xs font-medium text-muted-foreground mb-1.5 block">RUT</label>
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="filtroRut"
                placeholder="Buscar por RUT..."
                class="pl-9 h-9"
              />
            </div>
          </div>

          <!-- Filtro Nombre -->
          <div class="flex-1 min-w-[200px]">
            <label class="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre</label>
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="filtroNombre"
                placeholder="Buscar por nombre..."
                class="pl-9 h-9"
              />
            </div>
          </div>

          <!-- Filtro Firma Faltante -->
          <div class="min-w-[160px]">
            <label class="text-xs font-medium text-muted-foreground mb-1.5 block">Firma Faltante</label>
            <select
              v-model="filtroFirmaFaltante"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Todos</option>
              <option v-for="opcion in opcionesFirmaFaltante" :key="opcion" :value="opcion">
                {{ opcion }}
              </option>
            </select>
          </div>

          <!-- Botón limpiar -->
          <Button
            v-if="hayFiltrosActivos"
            variant="ghost"
            size="sm"
            class="h-9 px-3"
            @click="limpiarFiltros"
          >
            <X class="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        </div>

        <!-- Indicador de resultados filtrados -->
        <div v-if="hayFiltrosActivos" class="mt-3 text-xs text-muted-foreground">
          Mostrando <span class="font-semibold text-foreground">{{ dataFiltrada.length }}</span> de <span class="font-semibold text-foreground">{{ data.length }}</span> registros
        </div>
      </CardContent>
    </Card>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
      {{ error.message }}
    </div>

    <!-- Tabla -->
    <Card>
      <CardContent class="p-0">
        <div v-if="loading" class="space-y-3 p-6">
          <div v-for="i in 6" :key="i" class="flex gap-4">
            <div class="h-4 w-24 animate-pulse rounded bg-muted" />
            <div class="h-4 flex-1 animate-pulse rounded bg-muted" />
            <div class="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>

        <div v-else-if="dataFiltrada.length === 0" class="p-8 text-center text-muted-foreground">
          <template v-if="hayFiltrosActivos">
            No se encontraron registros con los filtros aplicados.
            <Button variant="link" class="px-1 h-auto" @click="limpiarFiltros">Limpiar filtros</Button>
          </template>
          <template v-else>
            No hay registros de estado firma contrato.
          </template>
        </div>

        <div v-else>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-border">
              <thead class="bg-muted/50">
                <tr>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">CodCLi</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">RUT</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Nombre</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Año</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Periodo</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Tipo Alumno</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Estado Solicitud</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Firma Faltante</th>
                  <th class="px-3 py-2.5 text-left text-xs font-semibold">Fecha envío contrato</th>
                  <th class="px-3 py-2.5 text-right text-xs font-semibold">Ver detalle</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border bg-background">
                <tr
                  v-for="r in dataPaginated"
                  :key="`${r.ano_mat}-${r.periodo_mat}-${r.codcli}`"
                  class="group hover:bg-muted/50 transition-colors"
                >
                  <td class="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                    {{ r.codcli || '-' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-sm">
                    {{ r.rut || '-' }}
                  </td>
                  <td class="px-3 py-2.5 text-sm">
                    {{ nombreCompleto(r) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-sm">
                    {{ r.ano_mat ?? '-' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-sm">
                    {{ r.periodo_mat ?? '-' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-xs">
                    {{ r.estado_traspaso_umas || '-' }}
                  </td>
                  <td class="px-3 py-2.5 text-xs max-w-[140px] truncate" :title="r.descripcion_estado_solicitud || ''">
                    {{ r.descripcion_estado_solicitud || '-' }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5">
                    <Badge v-if="r.firma_faltante" :variant="firmaFaltanteVariant(r.firma_faltante)" class="text-xs">
                      {{ r.firma_faltante }}
                    </Badge>
                    <span v-else class="text-muted-foreground">-</span>
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                    {{ formatearFecha(r.contrato_fecha_envio_acepta) }}
                  </td>
                  <td class="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 px-2 hover:bg-primary hover:text-primary-foreground"
                      @click="verDetalle(r)"
                    >
                      <Eye class="h-3.5 w-3.5 mr-1" />
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          <div v-if="dataFiltrada.length > PAGE_SIZE" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div class="text-xs font-medium">
              <span class="font-bold text-primary">{{ (page - 1) * PAGE_SIZE + 1 }}</span>
              -
              <span class="font-bold text-primary">{{ Math.min(page * PAGE_SIZE, dataFiltrada.length) }}</span>
              de
              <span class="font-bold text-primary">{{ dataFiltrada.length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                :disabled="page === 1"
                class="font-medium"
                @click="irAPaginaAnterior"
              >
                <ChevronLeft class="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <div class="rounded-md border bg-background px-3 py-1.5">
                <span class="text-sm font-semibold">{{ page }}</span>
                <span class="text-sm text-muted-foreground"> / {{ totalPages }}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                :disabled="page >= totalPages"
                class="font-medium"
                @click="irAPaginaSiguiente"
              >
                Siguiente
                <ChevronRight class="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Modal detalle (todos los campos de la query) -->
    <Dialog :open="detalleOpen" @update:open="handleDetalleOpenChange">
      <DialogContent class="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle — {{ detalleSeleccionado?.codcli || '' }}</DialogTitle>
        </DialogHeader>
        <div v-if="detalleSeleccionado" class="space-y-2">
          <!-- Accordion: Datos del alumno -->
          <Card class="border">
            <CardHeader class="py-3">
              <button
                type="button"
                @click="toggleAccordionDetalle('alumno')"
                class="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
              >
                <CardTitle class="text-base">Datos del alumno</CardTitle>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200"
                  :class="{ 'rotate-180': accordionDetalle.has('alumno') }"
                />
              </button>
            </CardHeader>
            <CardContent v-show="accordionDetalle.has('alumno')" class="pt-0">
              <div class="grid gap-3 sm:grid-cols-2 text-sm">
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Año mat.</p>
                  <p>{{ detalleSeleccionado.ano_mat ?? '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Periodo mat.</p>
                  <p>{{ detalleSeleccionado.periodo_mat ?? '-' }}</p>
                </div>
                <div class="space-y-1 sm:col-span-2">
                  <p class="font-medium text-muted-foreground">CodCLi</p>
                  <p class="font-mono">{{ detalleSeleccionado.codcli || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Estado traspaso UMAS (Tipo Alumno)</p>
                  <p>{{ detalleSeleccionado.estado_traspaso_umas || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Estado solicitud</p>
                  <p>{{ detalleSeleccionado.descripcion_estado_solicitud || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Tipo programa</p>
                  <p>{{ detalleSeleccionado.tipo_programa || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Cod. facultad</p>
                  <p>{{ detalleSeleccionado.cod_facultad || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Facultad</p>
                  <p>{{ detalleSeleccionado.facultad || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Nombre jornada</p>
                  <p>{{ detalleSeleccionado.nombre_jornada || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">RUT</p>
                  <p>{{ detalleSeleccionado.rut || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Paterno</p>
                  <p>{{ detalleSeleccionado.paterno || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Materno</p>
                  <p>{{ detalleSeleccionado.materno || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Nombre</p>
                  <p>{{ detalleSeleccionado.nombre || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Mail</p>
                  <p class="break-all">{{ detalleSeleccionado.mail || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Mail institucional</p>
                  <p class="break-all">{{ detalleSeleccionado.mail_inst || '-' }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Accordion: Datos del Apoderado -->
          <Card class="border">
            <CardHeader class="py-3">
              <button
                type="button"
                @click="toggleAccordionDetalle('apoderado')"
                class="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
              >
                <CardTitle class="text-base">Datos del Apoderado</CardTitle>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200"
                  :class="{ 'rotate-180': accordionDetalle.has('apoderado') }"
                />
              </button>
            </CardHeader>
            <CardContent v-show="accordionDetalle.has('apoderado')" class="pt-0">
              <div class="grid gap-3 sm:grid-cols-2 text-sm">
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Nombre</p>
                  <p>{{ detalleSeleccionado.apod_nombre || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Paterno</p>
                  <p>{{ detalleSeleccionado.apod_paterno || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Materno</p>
                  <p>{{ detalleSeleccionado.apod_materno || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Mail</p>
                  <p class="break-all">{{ detalleSeleccionado.apod_mail || '-' }}</p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Celular</p>
                  <p>{{ detalleSeleccionado.apod_celular || '-' }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Accordion: Datos del contrato -->
          <Card class="border">
            <CardHeader class="py-3">
              <button
                type="button"
                @click="toggleAccordionDetalle('contrato')"
                class="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
              >
                <CardTitle class="text-base">Datos del contrato</CardTitle>
                <ChevronDown
                  class="h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-200"
                  :class="{ 'rotate-180': accordionDetalle.has('contrato') }"
                />
              </button>
            </CardHeader>
            <CardContent v-show="accordionDetalle.has('contrato')" class="pt-0">
              <div class="grid gap-3 sm:grid-cols-2 text-sm">
                <!-- Sección Contrato -->
                <div class="sm:col-span-2 border-b pb-3 mb-2">
                  <h4 class="font-semibold text-primary mb-3">Contrato</h4>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-1 sm:col-span-2">
                      <p class="font-medium text-muted-foreground">ID documento ACEPTA</p>
                      <p class="font-mono text-xs break-all">{{ detalleSeleccionado.contrato_id_documento_acepta || '-' }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Fecha envío ACEPTA</p>
                      <p>{{ formatearFecha(detalleSeleccionado.contrato_fecha_envio_acepta) }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Fecha recepción ACEPTA</p>
                      <p>{{ formatearFecha(detalleSeleccionado.contrato_fecha_recepcion_acepta) }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Usuario recepción</p>
                      <p>{{ detalleSeleccionado.usuario_recepcion_contrato || '-' }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Pendiente</p>
                      <Badge :variant="detalleSeleccionado.pendiente_contrato === 0 ? 'secondary' : 'destructive'">
                        {{ detalleSeleccionado.pendiente_contrato === 0 ? 'Firmado' : 'Pendiente' }}
                      </Badge>
                    </div>
                    <!-- Botón ver contrato firmado -->
                    <div v-if="detalleSeleccionado.contrato_ruta_documento_firmado" class="sm:col-span-2">
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-full sm:w-auto"
                        @click="verDocumentoFirmado('contratos', detalleSeleccionado.rut, detalleSeleccionado.contrato_id_documento_acepta)"
                      >
                        <ExternalLink class="mr-2 h-4 w-4" />
                        Ver Contrato Firmado
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- Sección Mandato -->
                <div class="sm:col-span-2 border-b pb-3 mb-2">
                  <h4 class="font-semibold text-primary mb-3">Mandato</h4>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-1 sm:col-span-2">
                      <p class="font-medium text-muted-foreground">ID documento ACEPTA</p>
                      <p class="font-mono text-xs break-all">{{ detalleSeleccionado.mandato_id_documento_acepta || '-' }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Fecha envío ACEPTA</p>
                      <p>{{ formatearFecha(detalleSeleccionado.mandato_fecha_envio_acepta) }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Fecha recepción ACEPTA</p>
                      <p>{{ formatearFecha(detalleSeleccionado.mandato_fecha_recepcion_acepta) }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Usuario recepción</p>
                      <p>{{ detalleSeleccionado.usuario_recepcion_mandato || '-' }}</p>
                    </div>
                    <div class="space-y-1">
                      <p class="font-medium text-muted-foreground">Pendiente</p>
                      <Badge :variant="detalleSeleccionado.pendiente_mandato === 0 ? 'secondary' : 'destructive'">
                        {{ detalleSeleccionado.pendiente_mandato === 0 ? 'Firmado' : 'Pendiente' }}
                      </Badge>
                    </div>
                    <!-- Botón ver mandato firmado -->
                    <div v-if="detalleSeleccionado.mandato_ruta_documento_firmado" class="sm:col-span-2">
                      <Button
                        variant="outline"
                        size="sm"
                        class="w-full sm:w-auto"
                        @click="verDocumentoFirmado('mandatos', detalleSeleccionado.rut, detalleSeleccionado.mandato_id_documento_acepta)"
                      >
                        <ExternalLink class="mr-2 h-4 w-4" />
                        Ver Mandato Firmado
                      </Button>
                    </div>
                  </div>
                </div>

                <!-- Resumen -->
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Firma faltante</p>
                  <p>
                    <Badge v-if="detalleSeleccionado.firma_faltante" :variant="firmaFaltanteVariant(detalleSeleccionado.firma_faltante)">
                      {{ detalleSeleccionado.firma_faltante }}
                    </Badge>
                    <span v-else>-</span>
                  </p>
                </div>
                <div class="space-y-1">
                  <p class="font-medium text-muted-foreground">Sync timestamp</p>
                  <p>{{ formatearFecha(detalleSeleccionado.sync_timestamp) }}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Diálogo de datos actualizados -->
    <Dialog :open="hasNewData">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos actualizados</DialogTitle>
          <DialogDescription>
            La sincronización ha finalizado. Hay nuevos datos disponibles desde el servidor.
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end pt-4">
          <Button @click="recargarDatos">
            Recargar datos
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Sheet lateral con lista de registros -->
    <Sheet :open="sheetOpen" @update:open="sheetOpen = $event">
      <SheetContent class="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{{ sheetTitle }}</SheetTitle>
          <SheetDescription>
            {{ sheetData.length }} registros
          </SheetDescription>
        </SheetHeader>
        
        <div class="mt-4 space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div
            v-for="r in sheetData"
            :key="`sheet-${r.ano_mat}-${r.periodo_mat}-${r.codcli}`"
            class="rounded-lg border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
            @click="verDetalle(r); sheetOpen = false"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-sm truncate">
                  {{ [r.paterno, r.materno, r.nombre].filter(Boolean).join(' ') || '-' }}
                </p>
                <p class="text-xs text-muted-foreground font-mono">{{ r.rut || '-' }}</p>
              </div>
              <Badge :variant="firmaFaltanteVariant(r.firma_faltante)" class="text-xs shrink-0">
                {{ r.firma_faltante || '-' }}
              </Badge>
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div class="truncate" :title="r.mail || ''">{{ r.mail || '-' }}</div>
              <div class="truncate" :title="r.tipo_programa || ''">{{ r.tipo_programa || '-' }}</div>
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              Enviado: {{ formatearFecha(r.contrato_fecha_envio_acepta) }}
            </div>
          </div>
          
          <div v-if="sheetData.length === 0" class="text-center py-8 text-muted-foreground">
            No hay registros
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
