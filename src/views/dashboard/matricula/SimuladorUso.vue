<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useProspectos } from '@/composables/useProspectos'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Search, Download, Eye, RefreshCw } from 'lucide-vue-next'
import type { Prospecto, FiltrosProspecto } from '@/types/prospecto'
import { getNombreCompletoProspecto, formatearFechaProspecto, getIdentificador } from '@/types/prospecto'
import { toast } from 'vue-sonner'
import ProspectoDetalle from '@/components/Prospectos/ProspectoDetalle.vue'

const { loading, fetchProspectos, fetchProspectoPorId, fetchProspectosPorRUT, fetchBecaPorId } = useProspectos()

// Estado
const prospectos = ref<Prospecto[]>([])
const totalProspectos = ref(0)
const paginaActual = ref(1)
const pageSize = 50
const filtros = ref<FiltrosProspecto>({})
const busqueda = ref('')
const filtroConsentimiento = ref<string>('')

// Modal de detalle
const detalleOpen = ref(false)
const prospectosSeleccionados = ref<Prospecto[]>([])
const isLoadingDetalle = ref(false)

// Auto-refresh cada hora
const isRefreshing = ref(false)
const lastRefreshTime = ref<Date | null>(null)
const refreshIntervalId = ref<number | null>(null)
const timerIntervalId = ref<number | null>(null)
const currentTime = ref(new Date())

// Calcular minutos hasta próxima actualización
const minutesUntilNextRefresh = computed(() => {
  const now = currentTime.value
  // Calcular la próxima hora completa
  const nextHour = new Date(now)
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0) // Próxima hora en punto
  
  const diffMs = nextHour.getTime() - now.getTime()
  const diffMinutes = Math.ceil(diffMs / (1000 * 60))
  return Math.max(0, diffMinutes)
})

// Mensaje de próxima actualización
const nextRefreshMessage = computed(() => {
  const minutes = minutesUntilNextRefresh.value
  if (minutes === 0 && (isRefreshing.value || loading.value)) {
    return 'Actualizando...'
  }
  if (minutes === 0) {
    return 'Próxima actualización en 60 minutos'
  }
  if (minutes === 1) {
    return 'Próxima actualización en 1 minuto'
  }
  return `Próxima actualización en ${minutes} minutos`
})

// Función de actualización automática
async function autoRefresh() {
  if (!loading.value && !isRefreshing.value) {
    isRefreshing.value = true
    try {
      const response = await fetchProspectos(paginaActual.value, pageSize, filtros.value)
      if (!response.error) {
        prospectos.value = response.data
        totalProspectos.value = response.count || 0
        lastRefreshTime.value = new Date()
        toast.success('Datos actualizados automáticamente')
      }
    } catch (error) {
      console.error('Error en actualización automática:', error)
    } finally {
      isRefreshing.value = false
    }
  }
}

// Actualización manual
async function handleRefresh() {
  isRefreshing.value = true
  try {
    const response = await fetchProspectos(paginaActual.value, pageSize, filtros.value)
    if (response.error) {
      toast.error('Error al actualizar datos')
    } else {
      prospectos.value = response.data
      totalProspectos.value = response.count || 0
      lastRefreshTime.value = new Date()
      toast.success('Datos actualizados')
    }
  } catch (error) {
    toast.error('Error al actualizar datos')
  } finally {
    isRefreshing.value = false
  }
}

// Configurar auto-refresh cada hora
function setupAutoRefresh() {
  // Actualizar cada hora (3600000 ms)
  refreshIntervalId.value = window.setInterval(() => {
    autoRefresh()
  }, 3600000) // 1 hora = 3600000 ms
  
  // Actualizar el tiempo actual cada minuto para actualizar el mensaje
  currentTime.value = new Date()
  timerIntervalId.value = window.setInterval(() => {
    currentTime.value = new Date()
  }, 60000) // 60 segundos
}

// Limpiar intervals al desmontar
function cleanupAutoRefresh() {
  if (refreshIntervalId.value !== null) {
    clearInterval(refreshIntervalId.value)
    refreshIntervalId.value = null
  }
  if (timerIntervalId.value !== null) {
    clearInterval(timerIntervalId.value)
    timerIntervalId.value = null
  }
}

// Cargar prospectos
async function cargarProspectos() {
  const response = await fetchProspectos(paginaActual.value, pageSize, filtros.value)
  if (response.error) {
    toast.error('Error al cargar prospectos')
    return
  }
  prospectos.value = response.data
  totalProspectos.value = response.count || 0
  // Actualizar el tiempo de última actualización solo si no está refrescando manualmente
  if (!isRefreshing.value) {
    lastRefreshTime.value = new Date()
  }
}

// Paginación
const totalPages = computed(() => Math.ceil(totalProspectos.value / pageSize))

// Computed para contar simulaciones por RUT en la lista actual
const simulacionesPorRUT = computed(() => {
  const conteo: Record<string, number> = {}
  const detalles: Record<string, Array<{ id: string, nombre: string, rutOriginal: string, pasaporteOriginal: string }>> = {}
  
  prospectos.value.forEach((prospecto) => {
    const identificador = getIdentificador(prospecto)
    if (identificador && identificador !== '-') {
      conteo[identificador] = (conteo[identificador] || 0) + 1
      
      // Guardar detalles para debugging
      if (!detalles[identificador]) {
        detalles[identificador] = []
      }
      detalles[identificador].push({
        id: prospecto.id,
        nombre: `${prospecto.nombre} ${prospecto.apellido}`,
        rutOriginal: prospecto.rut || '',
        pasaporteOriginal: prospecto.pasaporte || ''
      })
    }
  })
  
  // Log para RUTs con múltiples simulaciones
  Object.entries(conteo).forEach(([rut, count]) => {
    if (count > 1) {
      console.log(`📊 RUT "${rut}" tiene ${count} simulaciones:`, detalles[rut])
    }
  })
  
  // Log para verificar duplicados potenciales
  const rutConEspacios = Object.entries(detalles).filter(([rut, items]) => {
    return items.some(item => 
      (item.rutOriginal && item.rutOriginal !== item.rutOriginal.trim()) ||
      (item.pasaporteOriginal && item.pasaporteOriginal !== item.pasaporteOriginal.trim())
    )
  })
  
  if (rutConEspacios.length > 0) {
    console.log('⚠️ RUTs con espacios detectados:', rutConEspacios)
  }
  
  return conteo
})

// Función para obtener cantidad de simulaciones de un RUT
function getCantidadSimulaciones(prospecto: Prospecto): number {
  const identificador = getIdentificador(prospecto)
  return simulacionesPorRUT.value[identificador] || 1
}

// Computed para deduplicar prospectos: mostrar solo uno por RUT (el más reciente)
const prospectosUnicos = computed(() => {
  const prospectosOrdenados = [...prospectos.value].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const rutVistos = new Set<string>()
  const prospectosDeduplicados: Prospecto[] = []
  
  // Ordenar por fecha de creación descendente para priorizar siempre el más reciente
  prospectosOrdenados.forEach((prospecto) => {
    const identificador = getIdentificador(prospecto)
    
    // Si el RUT es válido y no lo hemos visto antes, agregarlo
    if (identificador && identificador !== '-') {
      if (!rutVistos.has(identificador)) {
        rutVistos.add(identificador)
        prospectosDeduplicados.push(prospecto)
        console.log(`✅ Agregando prospecto único para RUT "${identificador}":`, {
          id: prospecto.id,
          nombre: `${prospecto.nombre} ${prospecto.apellido}`,
          fecha: formatearFechaProspecto(prospecto.created_at),
          totalSimulaciones: simulacionesPorRUT.value[identificador] || 1
        })
      } else {
        console.log(`⏭️ Omitiendo prospecto duplicado para RUT "${identificador}":`, {
          id: prospecto.id,
          nombre: `${prospecto.nombre} ${prospecto.apellido}`,
          fecha: formatearFechaProspecto(prospecto.created_at)
        })
      }
    } else {
      // Si no tiene RUT válido, agregarlo de todas formas
      prospectosDeduplicados.push(prospecto)
    }
  })
  
  console.log(`📊 Deduplicación: ${prospectos.value.length} prospectos → ${prospectosDeduplicados.length} únicos`)
  
  return prospectosDeduplicados
})

function irAPaginaAnterior() {
  if (paginaActual.value > 1) {
    paginaActual.value--
    cargarProspectos()
  }
}

function irAPaginaSiguiente() {
  if (paginaActual.value < totalPages.value) {
    paginaActual.value++
    cargarProspectos()
  }
}

// Función para aplicar filtros
function aplicarFiltros() {
  const nuevosFiltros: FiltrosProspecto = {}
  
  if (busqueda.value.trim()) {
    nuevosFiltros.nombre = busqueda.value.trim()
  }
  
  if (filtroConsentimiento.value) {
    if (filtroConsentimiento.value === 'si') {
      nuevosFiltros.consentimiento_contacto = true
    } else if (filtroConsentimiento.value === 'no') {
      nuevosFiltros.consentimiento_contacto = false
    }
  }
  
  filtros.value = nuevosFiltros
  paginaActual.value = 1
  cargarProspectos()
}

// Búsqueda instantánea con debounce
let timeoutId: ReturnType<typeof setTimeout> | null = null

watch(busqueda, () => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
  
  timeoutId = setTimeout(() => {
    aplicarFiltros()
  }, 300) // Espera 300ms después de que el usuario deje de escribir
})

// Búsqueda manual (para el botón, aunque ya no es necesario)
function handleBuscar() {
  aplicarFiltros()
}

function limpiarFiltros() {
  busqueda.value = ''
  filtroConsentimiento.value = ''
  filtros.value = {}
  paginaActual.value = 1
  cargarProspectos()
}

// Exportar
async function exportarCSV() {
  try {
    // Obtener todos los prospectos sin paginación para exportar
    const response = await fetchProspectos(1, 10000, filtros.value)
    if (response.error || !response.data.length) {
      toast.error('No hay datos para exportar')
      return
    }

    // Garantizar orden por fecha de creación descendente como en la vista
    const prospectosOrdenados = [...response.data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Calcular cantidad de simulaciones por RUT y asignar número de simulación
    const conteoSimulaciones: Record<string, number> = {}
    const numeroSimulacionPorRUT: Record<string, number> = {}
    const nombreBecaPorId: Record<string, string> = {}

    // Resolver nombres de beca a partir de IDs únicos
    const becasIdsUnicas = [...new Set(prospectosOrdenados.map((p) => p.beca).filter(Boolean) as string[])]
    await Promise.all(
      becasIdsUnicas.map(async (becaId) => {
        const becaInfo = await fetchBecaPorId(becaId)
        nombreBecaPorId[becaId] = becaInfo?.nombre || ''
      })
    )
    
    // Primer paso: contar total de simulaciones por RUT
    prospectosOrdenados.forEach((p) => {
      const identificador = getIdentificador(p)
      if (identificador && identificador !== '-') {
        conteoSimulaciones[identificador] = (conteoSimulaciones[identificador] || 0) + 1
      }
    })

    // Crear CSV con todos los campos
    const headers = [
      'ID',
      'Nombre',
      'Apellido',
      'Email',
      'Teléfono',
      'RUT/Pasaporte',
      'Número Simulación',
      'Cantidad Simulaciones',
      'Género',
      'Año Nacimiento',
      'Curso',
      'Año Egreso',
      'Región',
      'Comuna',
      'Colegio',
      'Carrera',
      'Carrera Título',
      'Área Interés',
      'Segmentación',
      'NEM',
      'Ranking',
      'PAES',
      'Comprensión Lectora',
      'Matemática',
      'CAE',
      'Becas Estado',
      'Rango Ingreso',
      'Decil',
      'Beca',
      'Beca Nombre',
      'Modalidad Preferencia',
      'Objetivo',
      'Consentimiento Contacto',
      'URL Origen',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Fecha Creación',
    ]

    const rows = prospectosOrdenados.map((p) => {
      const identificador = getIdentificador(p)
      // Asignar número de simulación (1 = más reciente, 2 = siguiente, etc.)
      // El orden por fecha ya se garantiza en frontend (descendente)
      if (identificador && identificador !== '-') {
        numeroSimulacionPorRUT[identificador] = (numeroSimulacionPorRUT[identificador] || 0) + 1
      }
      const numeroSimulacion = identificador && identificador !== '-' 
        ? numeroSimulacionPorRUT[identificador] 
        : 1
      
      return [
        p.id,
        p.nombre,
        p.apellido,
        p.email,
        p.telefono || '',
        identificador,
        numeroSimulacion,
        conteoSimulaciones[identificador] || 1,
        p.genero || '',
        p.anio_nacimiento || '',
        p.curso,
        p.año_egreso || '',
        p.region || '',
        p.comuna || '',
        p.colegio || '',
        p.carrera?.toString() || '',
        p.carreratitulo || '',
        p.area_interes || '',
        p.segmentacion,
        p.nem || '',
        p.ranking || '',
        p.paes ? 'Sí' : 'No',
        p.comprension_lectora || '',
        p.matematica1 || '',
        p.cae ? 'Sí' : 'No',
        p.becas_estado ? 'Sí' : 'No',
        p.rango_ingreso || '',
        p.decil || '',
        p.beca || '',
        p.beca ? (nombreBecaPorId[p.beca] || '') : '',
        p.modalidadpreferencia ? JSON.stringify(p.modalidadpreferencia) : '',
        p.objetivo ? JSON.stringify(p.objetivo) : '',
        p.consentimiento_contacto ? 'Sí' : 'No',
        p.url_origen || '',
        p.utm_source || '',
        p.utm_medium || '',
        p.utm_campaign || '',
        formatearFechaProspecto(p.created_at),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    // Descargar
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `prospectos_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Datos exportados correctamente')
  } catch (error) {
    console.error('Error al exportar:', error)
    toast.error('Error al exportar datos')
  }
}

// Ver detalle
async function verDetalle(prospecto: Prospecto) {
  isLoadingDetalle.value = true
  detalleOpen.value = true
  
  const identificador = getIdentificador(prospecto)
  const cantidadSimulaciones = getCantidadSimulaciones(prospecto)
  
  // Si hay más de una simulación, cargar todas las del RUT
  if (cantidadSimulaciones > 1 && identificador && identificador !== '-') {
    const todosProspectos = await fetchProspectosPorRUT(identificador)
    if (todosProspectos.length > 0) {
      // Cargar datos completos de cada prospecto
      const prospectosCompletos = await Promise.all(
        todosProspectos.map(async (p) => {
          const completo = await fetchProspectoPorId(p.id)
          return completo || p
        })
      )
      prospectosSeleccionados.value = prospectosCompletos
    } else {
      // Fallback: usar solo el prospecto actual
      const prospectoCompleto = await fetchProspectoPorId(prospecto.id)
      prospectosSeleccionados.value = prospectoCompleto ? [prospectoCompleto] : [prospecto]
    }
  } else {
    // Si solo hay una simulación, mantener el comportamiento actual
    const prospectoCompleto = await fetchProspectoPorId(prospecto.id)
    if (prospectoCompleto) {
      prospectosSeleccionados.value = [prospectoCompleto]
    } else {
      prospectosSeleccionados.value = [prospecto]
    }
  }
  
  isLoadingDetalle.value = false
}

function cerrarDetalle() {
  detalleOpen.value = false
  prospectosSeleccionados.value = []
}

onMounted(async () => {
  await cargarProspectos()
  // Establecer el tiempo de última actualización después de cargar
  lastRefreshTime.value = new Date()
  setupAutoRefresh()
})

onUnmounted(() => {
  cleanupAutoRefresh()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Encabezado -->
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>Prospectos - Simulador de Becas</CardTitle>
            <p class="text-sm text-muted-foreground mt-1">
              {{ totalProspectos }} registros totales
            </p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-xs font-semibold text-primary">
                {{ nextRefreshMessage }}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              @click="handleRefresh"
              :disabled="isRefreshing || loading"
            >
              <RefreshCw :class="['mr-2 h-4 w-4', { 'animate-spin': isRefreshing || loading }]" />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" @click="exportarCSV" :disabled="loading">
              <Download class="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <!-- Búsqueda y Filtros -->
        <div class="space-y-3 mb-4">
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="busqueda"
                placeholder="Buscar por nombre o apellido..."
                class="pl-10"
              />
            </div>
            <Button variant="outline" @click="limpiarFiltros" :disabled="loading">
              Limpiar
            </Button>
          </div>
          <div class="flex gap-2">
            <div class="w-64">
              <label class="mb-1.5 block text-xs font-medium">Consentimiento de Contacto</label>
              <select
                v-model="filtroConsentimiento"
                @change="handleBuscar"
                class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tabla -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4 rounded-lg border p-4">
            <div class="h-10 w-24 animate-pulse rounded-md bg-muted"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-48 animate-pulse rounded bg-muted"></div>
              <div class="h-3 w-32 animate-pulse rounded bg-muted"></div>
            </div>
          </div>
        </div>

        <div v-else-if="prospectosUnicos.length > 0" class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email / Teléfono</TableHead>
                <TableHead>RUT/Pasaporte</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Consentimiento Contacto</TableHead>
                <TableHead class="w-24">Ver Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow 
                v-for="prospecto in prospectosUnicos" 
                :key="prospecto.id"
                class="cursor-pointer hover:bg-muted/50"
                @click="verDetalle(prospecto)"
              >
                <TableCell class="font-medium">
                  {{ getNombreCompletoProspecto(prospecto) }}
                </TableCell>
                <TableCell>
                  <div class="flex flex-col gap-1">
                    <a
                      :href="`mailto:${prospecto.email}`"
                      class="text-primary hover:underline text-sm"
                      @click.stop
                    >
                      {{ prospecto.email }}
                    </a>
                    <span v-if="prospecto.telefono" class="text-xs text-muted-foreground">
                      {{ prospecto.telefono }}
                    </span>
                  </div>
                </TableCell>
                <TableCell class="font-mono text-xs">
                  {{ getIdentificador(prospecto) }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ formatearFechaProspecto(prospecto.created_at) }}
                </TableCell>
                <TableCell>
                  <span 
                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                    :class="prospecto.consentimiento_contacto 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-gray-800 dark:bg-red-800 dark:text-gray-200'"
                  >
                    {{ prospecto.consentimiento_contacto ? 'Sí' : 'No' }}
                  </span>
                </TableCell>
                <TableCell @click.stop>
                  <div class="flex items-center gap-2">
                    <!-- Badge clickeable cuando hay múltiples simulaciones -->
                    <button
                      v-if="getCantidadSimulaciones(prospecto) > 1"
                      @click="verDetalle(prospecto)"
                      class="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                    >
                      {{ getCantidadSimulaciones(prospecto) }} simulaciones
                    </button>
                    <!-- Icono de ojo solo cuando hay una sola simulación -->
                    <Button
                      v-else
                      variant="ghost"
                      size="sm"
                      @click="verDetalle(prospecto)"
                      class="h-8 w-8 p-0"
                    >
                      <Eye class="h-4 w-4" />
                      <span class="sr-only">Ver detalle</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div v-else class="text-center py-12">
          <p class="text-muted-foreground">No se encontraron prospectos</p>
        </div>

        <!-- Paginación -->
        <div v-if="prospectosUnicos.length > 0" class="flex items-center justify-between mt-4">
          <div class="text-sm text-muted-foreground">
            Mostrando {{ (paginaActual - 1) * pageSize + 1 }} - 
            {{ Math.min(paginaActual * pageSize, totalProspectos) }} de {{ totalProspectos }}
            <span v-if="prospectosUnicos.length < prospectos.length" class="ml-2 text-xs text-muted-foreground">
              ({{ prospectosUnicos.length }} únicos mostrados, {{ prospectos.length - prospectosUnicos.length }} duplicados ocultos)
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="irAPaginaAnterior"
              :disabled="paginaActual === 1 || loading"
            >
              <ChevronLeft class="h-4 w-4" />
              Anterior
            </Button>
            <span class="text-sm text-muted-foreground">
              Página {{ paginaActual }} de {{ totalPages }}
            </span>
            <Button
              variant="outline"
              size="sm"
              @click="irAPaginaSiguiente"
              :disabled="paginaActual === totalPages || loading"
            >
              Siguiente
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Modal de Detalle -->
    <ProspectoDetalle
      :open="detalleOpen"
      :prospectos="prospectosSeleccionados"
      :is-loading="isLoadingDetalle"
      @update:open="cerrarDetalle"
    />
  </div>
</template>

