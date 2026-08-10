<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { RefreshCw, ChevronLeft, ChevronRight, Eye, Search, X, Download, ChevronDown } from 'lucide-vue-next'
import { useMatriculados, type Matriculado } from '@/composables/useMatriculados'
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
import { toast } from 'vue-sonner'

const { 
  data, total, 
  loading, syncing, hasNewData, 
  fetchMatriculados, syncMatriculadosBackground, exportCSV 
} = useMatriculados()

const { nextRefreshMessage } = useAutoRefresh()

// Filtros
const filtroRut = ref('')
const filtroTipoAlumno = ref<string>('')

// Paginación local
const currentPage = ref(1)
const PAGE_SIZE = 15

// Datos filtrados localmente (para búsqueda rápida)
const dataFiltrada = computed(() => {
  let resultado = data.value

  // Filtro por RUT o CodCli
  if (filtroRut.value.trim()) {
    const busqueda = filtroRut.value.trim().toLowerCase().replace(/\./g, '').replace(/-/g, '')
    resultado = resultado.filter((r) => {
      const rutLimpio = r.rut?.toLowerCase().replace(/\./g, '').replace(/-/g, '') || ''
      const codcliLimpio = r.codcli?.toLowerCase() || ''
      return rutLimpio.includes(busqueda) || codcliLimpio.includes(busqueda)
    })
  }

  if (filtroTipoAlumno.value) {
    resultado = resultado.filter((r) => r.tipo_alumno === filtroTipoAlumno.value)
  }

  return resultado
})

// Paginación sobre datos filtrados
const dataPaginada = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return dataFiltrada.value.slice(start, start + PAGE_SIZE)
})

const totalPagesLocal = computed(() => Math.ceil(dataFiltrada.value.length / PAGE_SIZE))

function limpiarFiltros() {
  filtroRut.value = ''
  filtroTipoAlumno.value = ''
  currentPage.value = 1
}

const hayFiltrosActivos = computed(() => 
  filtroRut.value.trim() !== '' || 
  filtroTipoAlumno.value !== ''
)

// Detalle
const detalleOpen = ref(false)
const detalleSeleccionado = ref<Matriculado | null>(null)

// Acordeones abiertos en el detalle
const accordionOpen = ref<Set<string>>(new Set(['alumno']))

function toggleAccordion(key: string) {
  if (accordionOpen.value.has(key)) {
    accordionOpen.value.delete(key)
  } else {
    accordionOpen.value.add(key)
  }
  // Forzar reactividad
  accordionOpen.value = new Set(accordionOpen.value)
}

function verDetalle(r: Matriculado) {
  detalleSeleccionado.value = r
  accordionOpen.value = new Set(['alumno'])
  detalleOpen.value = true
}

function cerrarDetalle() {
  detalleOpen.value = false
  detalleSeleccionado.value = null
}

// Estado firma: "CONTRATO/MANDATO FIRMADO" = Completado (verde); resto con etiqueta según valor
// Si estado_firma viene null desde la API, usar descripcion_situ (ahí viene el texto desde BD)
function estadoFirmaEfectivo(r: Matriculado | null): string | null {
  if (!r) return null
  const raw = r.estado_firma ?? r.descripcion_situ
  const v = normalizarEstadoFirma(raw)
  return v || null
}

// Normaliza: trim, quitar comillas (rectas y tipográficas), colapsar espacios
function normalizarEstadoFirma(estado: string | null | undefined): string {
  if (estado == null || estado === '') return ''
  let v = String(estado)
    .replace(/[\u201C\u201D\u201E\u201F\u2033"]/g, '"') // comillas tipográficas → rectas
    .trim()
    .replace(/\s+/g, ' ')
  v = v.replace(/^"+|"+$/g, '').trim()
  return v
}

function esFirmaCompletada(estado: string | null | undefined): boolean {
  const v = normalizarEstadoFirma(estado).toUpperCase()
  if (!v) return false
  // "SI" o cualquier texto que contenga "CONTRATO/MANDATO FIRMADO" (por variaciones de espacios/comillas)
  return v === 'SI' || v.includes('CONTRATO/MANDATO FIRMADO')
}

function esFirmaPendiente(estado: string | null | undefined): boolean {
  const v = normalizarEstadoFirma(estado).toUpperCase()
  if (!v) return false
  return v === 'NO' || v === 'CONTRATO/MANDATO NO FIRMADO'
}

function etiquetaEstadoFirma(estado: string | null | undefined): string {
  const v = normalizarEstadoFirma(estado)
  if (!v) return '—'
  return v
}

// Sincronización
async function handleRefresh() {
  const result = await syncMatriculadosBackground()
  if (result.ok) {
    toast.success('Sincronización completada', {
      description: `${result.inserted || 0} nuevos, ${result.updated || 0} actualizados`
    })
  } else {
    toast.error('Error en sincronización')
  }
}

function recargarDatos() {
  fetchMatriculados({ page: 1, limit: 10000 })
  hasNewData.value = false
  currentPage.value = 1
}

// Exportar
async function handleExport() {
  try {
    await exportCSV()
    toast.success('Exportación completada')
  } catch (e) {
    toast.error('Error al exportar')
  }
}

// Formatear moneda
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value)
}

// Formatear fecha
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return dateStr
}

// Watch para resetear página al cambiar filtros
watch([filtroRut, filtroTipoAlumno], () => {
  currentPage.value = 1
})

// Búsqueda por RUT/CodCli en el servidor (el filtro local solo ve los primeros 100; si buscas un RUT que no está en esa página, no aparece)
const initialLoadDone = ref(false)
let debounceSearch: ReturnType<typeof setTimeout> | null = null

watch(filtroRut, async (valor) => {
  const busqueda = valor.trim()
  if (debounceSearch) {
    clearTimeout(debounceSearch)
    debounceSearch = null
  }
  if (busqueda.length >= 2) {
    debounceSearch = setTimeout(async () => {
      debounceSearch = null
      await fetchMatriculados({ page: 1, limit: 100, search: busqueda })
    }, 400)
  } else if (busqueda === '' && initialLoadDone.value) {
    await fetchMatriculados({ page: 1, limit: 10000 })
  }
})

onMounted(async () => {
  await fetchMatriculados({ page: 1, limit: 10000 })
  initialLoadDone.value = true
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Matriculados 2026</h1>
        <p class="text-muted-foreground">
          Gestión de alumnos matriculados · {{ total }} registros
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div v-if="nextRefreshMessage" class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs font-semibold text-primary">
            {{ nextRefreshMessage }}
          </span>
        </div>
        <Button variant="outline" size="sm" @click="handleExport" :disabled="loading || data.length === 0">
          <Download class="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button variant="default" size="sm" @click="handleRefresh" :disabled="syncing">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': syncing }" />
          {{ syncing ? 'Sincronizando...' : 'Actualizar' }}
        </Button>
      </div>
    </div>

    <!-- Dialog de recarga de datos -->
    <Dialog :open="hasNewData" @update:open="(v) => { if (!v) hasNewData = false }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Datos actualizados</DialogTitle>
          <DialogDescription>
            La sincronización ha finalizado. ¿Desea recargar los datos para ver los cambios?
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2 mt-4">
          <Button variant="outline" @click="hasNewData = false">Cancelar</Button>
          <Button @click="recargarDatos">Recargar datos</Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Filtros -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-wrap gap-4 items-end">
          <div class="w-[250px]">
            <label class="text-sm font-medium mb-1 block">Buscar por RUT / CodCli</label>
            <div class="relative">
              <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="filtroRut"
                placeholder="Ej: 12345678 o 123456789"
                class="pl-8"
              />
            </div>
          </div>
          
          <div class="w-[150px]">
            <label class="text-sm font-medium mb-1 block">Tipo alumno</label>
            <select
              v-model="filtroTipoAlumno"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Todos</option>
              <option value="NUEVO">Nuevo</option>
              <option value="ANTIGUO">Antiguo</option>
            </select>
          </div>

          <Button 
            v-if="hayFiltrosActivos" 
            variant="ghost" 
            size="sm" 
            @click="limpiarFiltros"
          >
            <X class="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Tabla -->
    <Card>
      <CardContent class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/50">
                <th class="px-4 py-3 text-left font-medium">RUT</th>
                <th class="px-4 py-3 text-left font-medium">Nombre</th>
                <th class="px-4 py-3 text-left font-medium">Carrera</th>
                <th class="px-4 py-3 text-left font-medium">Facultad</th>
                <th class="px-4 py-3 text-center font-medium">Tipo Alumno</th>
                <th class="px-4 py-3 text-center font-medium">Estado Académico</th>
                <th class="px-4 py-3 text-right font-medium">Copago Matricula</th>
                <th class="px-4 py-3 text-right font-medium">Copago Arancel</th>
                <th class="px-4 py-3 text-left font-medium">Fecha Matricula</th>
                <th class="px-4 py-3 text-center font-medium">Ver Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading && data.length === 0">
                <td colspan="10" class="px-4 py-8 text-center text-muted-foreground">
                  <RefreshCw class="inline-block h-5 w-5 animate-spin mr-2" />
                  Cargando datos...
                </td>
              </tr>
              <tr v-else-if="dataPaginada.length === 0">
                <td colspan="10" class="px-4 py-8 text-center text-muted-foreground">
                  No se encontraron matriculados
                </td>
              </tr>
              <tr
                v-else
                v-for="row in dataPaginada"
                :key="`${row.codcli}-${row.codcarpr}`"
                class="border-b hover:bg-muted/30 transition-colors"
              >
                <td class="px-3 py-3 font-mono text-xs whitespace-nowrap">{{ row.rut }}-{{ row.dig }}</td>
                <td class="px-4 py-3">
                  <div class="font-medium">{{ row.apellido_pat }} {{ row.apellido_mat }}</div>
                  <div class="text-xs text-muted-foreground">{{ row.nombre }}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="max-w-[200px] truncate" :title="row.carrera || ''">{{ row.carrera || '-' }}</div>
                  <div class="text-xs text-muted-foreground">{{ row.codcarpr }}</div>
                </td>
                <td class="px-4 py-3">
                  <div class="max-w-[150px] truncate" :title="row.facultad || ''">{{ row.facultad || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-center">
                  <Badge :variant="row.tipo_alumno === 'NUEVO' ? 'default' : 'secondary'">
                    {{ row.tipo_alumno || '-' }}
                  </Badge>
                </td>
                <td class="px-4 py-3 text-center text-xs">{{ row.estacad || '-' }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs">{{ formatCurrency(row.copago_mat) }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs">{{ formatCurrency(row.copago_ara) }}</td>
                <td class="px-4 py-3 text-xs">{{ formatDate(row.fec_mat) }}</td>
                <td class="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" @click="verDetalle(row)">
                    <Eye class="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="flex items-center justify-between border-t px-4 py-3">
          <div class="text-sm text-muted-foreground">
            Mostrando {{ dataPaginada.length }} de {{ dataFiltrada.length }} registros
            <span v-if="dataFiltrada.length !== data.length" class="text-muted-foreground/70">
              (filtrados de {{ data.length }} total)
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            >
              <ChevronLeft class="h-4 w-4" />
            </Button>
            <span class="text-sm">
              Página {{ currentPage }} de {{ totalPagesLocal || 1 }}
            </span>
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalPagesLocal"
              @click="currentPage++"
            >
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Dialog de detalle con acordeones -->
    <Dialog :open="detalleOpen" @update:open="(v) => { if (!v) cerrarDetalle() }">
      <DialogContent class="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Matriculado</DialogTitle>
          <DialogDescription v-if="detalleSeleccionado">
            {{ detalleSeleccionado.rut }}-{{ detalleSeleccionado.dig }} · {{ detalleSeleccionado.nombre }} {{ detalleSeleccionado.apellido_pat }} {{ detalleSeleccionado.apellido_mat }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="detalleSeleccionado" class="space-y-3 mt-4">
          <!-- Datos del Alumno -->
          <Card>
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('alumno')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">Datos del Alumno</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('alumno') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('alumno')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-muted-foreground">RUT:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.rut }}-{{ detalleSeleccionado.dig }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Código:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.codcli }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Nombre:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.nombre }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Apellidos:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.apellido_pat }} {{ detalleSeleccionado.apellido_mat }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Email:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.mail || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Email Inst.:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.mail_inst || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Teléfono:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.fonoact || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Celular:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.celularact || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Tipo Alumno:</span>
                  <Badge class="ml-2" :variant="detalleSeleccionado.tipo_alumno === 'NUEVO' ? 'default' : 'secondary'">
                    {{ detalleSeleccionado.tipo_alumno }}
                  </Badge>
                </div>
                <div>
                  <span class="text-muted-foreground">Categoría:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.categoria || '-' }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Datos Académicos -->
          <Card>
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('academico')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">Datos Académicos</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('academico') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('academico')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="col-span-2">
                  <span class="text-muted-foreground">Carrera:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.carrera }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Código Carrera:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.codcarpr }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Tipo Carrera:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.tipo_carr || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Facultad:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.facultad || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Jornada:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.jornada || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Nivel:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.nivel || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Estado Académico:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.estacad || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Situación:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.descripcion_situ || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Código Plan:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.codpestud || '-' }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Datos de Matrícula -->
          <Card>
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('matricula')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">Datos de Matrícula</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('matricula') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('matricula')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-muted-foreground">Año Matrícula:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.ano_mat }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Período:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.periodo_mat }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Fecha Matrícula:</span>
                  <span class="ml-2 font-medium">{{ formatDate(detalleSeleccionado.fec_mat) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Hora:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.hora_mat || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Mat. Efectiva:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.mat_efectiva || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Año Ingreso:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.ano_ingreso || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Estado Firma:</span>
                  <Badge
                    class="ml-2 text-white border-0"
                    :class="esFirmaCompletada(estadoFirmaEfectivo(detalleSeleccionado)) ? 'bg-green-600' : 'bg-amber-500'"
                  >
                    {{ etiquetaEstadoFirma(estadoFirmaEfectivo(detalleSeleccionado)) }}
                  </Badge>
                </div>
                <div>
                  <span class="text-muted-foreground">Nº Contrato:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.num_contrato || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Usuario Matrícula:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.usuario_mat || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Caja:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.caja || '-' }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Datos Financieros -->
          <Card>
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('financiero')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">Datos Financieros</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('financiero') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('financiero')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-muted-foreground">Lista Matrícula:</span>
                  <span class="ml-2 font-medium font-mono">{{ formatCurrency(detalleSeleccionado.lista_mat) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Beneficio Matrícula:</span>
                  <span class="ml-2 font-medium font-mono text-green-600">{{ formatCurrency(detalleSeleccionado.ben_matr) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Copago Matrícula:</span>
                  <span class="ml-2 font-medium font-mono text-blue-600">{{ formatCurrency(detalleSeleccionado.copago_mat) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Doc. Matrícula:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.documento_mat || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Lista Arancel:</span>
                  <span class="ml-2 font-medium font-mono">{{ formatCurrency(detalleSeleccionado.lista_arancel) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Beneficio Arancel:</span>
                  <span class="ml-2 font-medium font-mono text-green-600">{{ formatCurrency(detalleSeleccionado.ben_aran) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Copago Arancel:</span>
                  <span class="ml-2 font-medium font-mono text-blue-600">{{ formatCurrency(detalleSeleccionado.copago_ara) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Doc. Arancel:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.documento_ara || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Copago Total:</span>
                  <span class="ml-2 font-medium font-mono text-blue-600">{{ formatCurrency(detalleSeleccionado.copago_total) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Nº Boleta/Factura:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.num_bol_fact || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Deuda Morosa:</span>
                  <span class="ml-2 font-medium font-mono" :class="detalleSeleccionado.deuda_morosa ? 'text-red-600' : ''">
                    {{ formatCurrency(detalleSeleccionado.deuda_morosa) }}
                  </span>
                </div>
                <div>
                  <span class="text-muted-foreground">Pago Doc. 386:</span>
                  <span class="ml-2 font-medium font-mono">{{ formatCurrency(detalleSeleccionado.pagodoc386) }}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- CAE y Becas -->
          <Card>
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('cae')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">CAE y Becas</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('cae') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('cae')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-muted-foreground">Monto CAE:</span>
                  <span class="ml-2 font-medium font-mono">{{ formatCurrency(detalleSeleccionado.cae_monto) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Estado CAE:</span>
                  <Badge v-if="detalleSeleccionado.estado_cae" class="ml-2" 
                         :variant="detalleSeleccionado.estado_cae === 'VIGENTE' ? 'default' : 
                                  detalleSeleccionado.estado_cae === 'MOROSO' ? 'destructive' : 'secondary'">
                    {{ detalleSeleccionado.estado_cae }}
                  </Badge>
                  <span v-else class="ml-2">-</span>
                </div>
                <div class="col-span-2">
                  <span class="text-muted-foreground">Beca Ministerial:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.beca_ministerial || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Monto Beca Ministerial:</span>
                  <span class="ml-2 font-medium font-mono">{{ formatCurrency(detalleSeleccionado.monto_beca_minesterial) }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Estado Beca Ministerial:</span>
                  <Badge v-if="detalleSeleccionado.estado_beca_mine" class="ml-2" 
                         :variant="detalleSeleccionado.estado_beca_mine === 'VIGENTE' ? 'default' : 
                                  detalleSeleccionado.estado_beca_mine === 'MOROSO' ? 'destructive' : 'secondary'">
                    {{ detalleSeleccionado.estado_beca_mine }}
                  </Badge>
                  <span v-else class="ml-2">-</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Apoderado -->
          <Card v-if="detalleSeleccionado.rut_apod">
            <CardHeader 
              class="cursor-pointer py-3 px-4" 
              @click="toggleAccordion('apoderado')"
            >
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-semibold">Datos del Apoderado</CardTitle>
                <ChevronDown 
                  class="h-4 w-4 transition-transform" 
                  :class="{ 'rotate-180': accordionOpen.has('apoderado') }" 
                />
              </div>
            </CardHeader>
            <CardContent v-if="accordionOpen.has('apoderado')" class="pt-0 pb-4">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-muted-foreground">RUT:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.rut_apod }}-{{ detalleSeleccionado.dv_apod }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Nombre:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.nombre_apod }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Apellido Paterno:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.ap_paterno_apod || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Apellido Materno:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.ap_materno_apod || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Teléfono:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.telefono_apod || '-' }}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">Email:</span>
                  <span class="ml-2 font-medium">{{ detalleSeleccionado.mail_apod || '-' }}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
