<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-vue-next'
import type { Prospecto } from '@/types/prospecto'
import type { CarreraUniacc } from '@/types/carrera'
import type { BecaUniacc } from '@/types/beca'
import { getNombreCompletoProspecto, formatearFechaProspecto, getIdentificador } from '@/types/prospecto'
import { useProspectos } from '@/composables/useProspectos'

const props = defineProps<{
  open: boolean
  prospectos?: Prospecto[]
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { fetchCarreraPorId, fetchBecaPorId } = useProspectos()

// Estado para información de carreras y becas por prospecto
const carrerasInfo = ref<Record<string, CarreraUniacc | null>>({})
const isLoadingCarreras = ref<Record<string, boolean>>({})
const becasInfo = ref<Record<string, BecaUniacc | null>>({})
const isLoadingBecas = ref<Record<string, boolean>>({})

// Computed para obtener el primer prospecto (compatibilidad hacia atrás)
const prospectosList = computed(() => {
  const lista = props.prospectos || []
  // Ordenar por fecha descendente (más actual primero)
  return [...lista].sort((a, b) => {
    const fechaA = new Date(a.created_at).getTime()
    const fechaB = new Date(b.created_at).getTime()
    return fechaB - fechaA // Más reciente primero
  })
})
const primerProspecto = computed(() => prospectosList.value[0] || null)
const tieneMultiplesSimulaciones = computed(() => prospectosList.value.length > 1)

// Estado para controlar qué accordions están abiertos
const openAccordions = ref<Set<string>>(new Set())

function toggleAccordion(prospectoId: string) {
  if (openAccordions.value.has(prospectoId)) {
    openAccordions.value.delete(prospectoId)
  } else {
    openAccordions.value.add(prospectoId)
  }
}

// Cargar información de carreras y becas cuando se abren los prospectos
watch([() => props.open, () => prospectosList.value], async ([isOpen, prospectos]) => {
  if (isOpen && prospectos && prospectos.length > 0) {
    // Limpiar información anterior
    carrerasInfo.value = {}
    becasInfo.value = {}
    isLoadingCarreras.value = {}
    isLoadingBecas.value = {}
    
    // NO abrir automáticamente ningún accordion - todos cerrados por defecto
    openAccordions.value = new Set()
    
    // Ordenar prospectos: más actual primero (fecha descendente)
    const prospectosOrdenados = [...prospectos].sort((a, b) => {
      const fechaA = new Date(a.created_at).getTime()
      const fechaB = new Date(b.created_at).getTime()
      return fechaB - fechaA // Más reciente primero
    })
    
    // Cargar información para cada prospecto (en orden)
    for (const prospecto of prospectosOrdenados) {
      if (prospecto.carrera) {
        isLoadingCarreras.value[prospecto.id] = true
        const carrera = await fetchCarreraPorId(prospecto.carrera)
        carrerasInfo.value[prospecto.id] = carrera
        isLoadingCarreras.value[prospecto.id] = false
      }
      
      if (prospecto.beca) {
        isLoadingBecas.value[prospecto.id] = true
        const beca = await fetchBecaPorId(prospecto.beca)
        becasInfo.value[prospecto.id] = beca
        isLoadingBecas.value[prospecto.id] = false
      }
    }
  } else {
    carrerasInfo.value = {}
    becasInfo.value = {}
    isLoadingCarreras.value = {}
    isLoadingBecas.value = {}
    openAccordions.value = new Set()
  }
}, { immediate: true })

function handleOpenChange(value: boolean) {
  emit('update:open', value)
}

// Formatear JSON para mostrar
function formatearJSON(value: any): string {
  if (!value) return '-'
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Formatear fecha completa con hora (en zona horaria de Chile/Santiago)
function formatearFechaCompleta(fecha: string | null): string {
  if (!fecha) return '-'
  try {
    const date = new Date(fecha)
    return date.toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return fecha
  }
}

// Función helper para obtener fuente/campaña de un prospecto
function obtenerFuente(prospecto: Prospecto): string {
  if (prospecto.utm_source) {
    return prospecto.utm_source
  }
  if (prospecto.campaign_id) {
    return `Campaign: ${prospecto.campaign_id}`
  }
  if (prospecto.ad_id) {
    return `Ad: ${prospecto.ad_id}`
  }
  if (prospecto.gclid) {
    return 'Google Ads'
  }
  if (prospecto.fbclid) {
    return 'Facebook'
  }
  if (prospecto.msclkid) {
    return 'Microsoft Ads'
  }
  if (prospecto.ttclid) {
    return 'TikTok'
  }
  if (prospecto.li_fat_id) {
    return 'LinkedIn'
  }
  return 'Directo'
}

// Computed para analizar diferencias entre simulaciones
const diferenciasSimulaciones = computed(() => {
  if (!tieneMultiplesSimulaciones.value || prospectosList.value.length < 2) {
    return null
  }

  const prospectos = prospectosList.value
  
  // Analizar carreras
  const carrerasUnicas = new Set<string>()
  const carrerasConInfo: Array<{ id: string, nombre: string }> = []
  prospectos.forEach(p => {
    if (p.carrera) {
      const carreraInfo = carrerasInfo.value[p.id]
      if (carreraInfo) {
        const nombre = carreraInfo.nombre_programa
        if (!carrerasUnicas.has(nombre)) {
          carrerasUnicas.add(nombre)
          carrerasConInfo.push({ id: p.id, nombre })
        }
      } else {
        carrerasConInfo.push({ id: p.id, nombre: `Carrera ID: ${p.carrera}` })
      }
    }
  })

  // Analizar becas
  const becasUnicas = new Set<string>()
  const becasConInfo: Array<{ id: string, nombre: string }> = []
  prospectos.forEach(p => {
    if (p.beca) {
      const becaInfo = becasInfo.value[p.id]
      if (becaInfo) {
        const nombre = becaInfo.nombre
        if (!becasUnicas.has(nombre)) {
          becasUnicas.add(nombre)
          becasConInfo.push({ id: p.id, nombre })
        }
      } else {
        becasConInfo.push({ id: p.id, nombre: `Beca ID: ${p.beca}` })
      }
    }
  })

  // Analizar fuentes/campañas
  const fuentesUnicas = new Set<string>()
  const fuentesConInfo: Array<{ id: string, fuente: string }> = []
  prospectos.forEach(p => {
    const fuente = obtenerFuente(p)
    if (!fuentesUnicas.has(fuente)) {
      fuentesUnicas.add(fuente)
      fuentesConInfo.push({ id: p.id, fuente })
    }
  })

  // Analizar fechas
  const fechas = prospectos.map(p => new Date(p.created_at).getTime()).sort((a, b) => a - b)
  const fechaMasAntigua = new Date(fechas[0])
  const fechaMasReciente = new Date(fechas[fechas.length - 1])

  return {
    totalSimulaciones: prospectos.length,
    tieneDiferentesCarreras: carrerasUnicas.size > 1,
    carreras: carrerasConInfo,
    tieneDiferentesBecas: becasUnicas.size > 1,
    becas: becasConInfo,
    tieneDiferentesFuentes: fuentesUnicas.size > 1,
    fuentes: fuentesConInfo,
    fechaMasAntigua,
    fechaMasReciente,
    diasDiferencia: Math.ceil((fechaMasReciente.getTime() - fechaMasAntigua.getTime()) / (1000 * 60 * 60 * 24))
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="max-h-[90vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {{ tieneMultiplesSimulaciones ? `Detalle de Simulaciones (${prospectosList.length})` : 'Detalle del Prospecto' }}
        </DialogTitle>
        <DialogDescription>
          {{ tieneMultiplesSimulaciones ? `Información completa de ${prospectosList.length} simulaciones` : 'Información completa del prospecto' }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="py-8 text-center">
        <p class="text-muted-foreground">Cargando...</p>
      </div>

      <div v-else-if="prospectosList && prospectosList.length > 0" class="space-y-6">
        <!-- Datos Básicos del Usuario (siempre visibles) -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Información Personal</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Nombre Completo</p>
              <p class="text-base">{{ getNombreCompletoProspecto(primerProspecto) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Email</p>
              <a :href="`mailto:${primerProspecto?.email}`" class="text-base text-primary hover:underline">
                {{ primerProspecto?.email }}
              </a>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Teléfono</p>
              <p class="text-base">{{ primerProspecto?.telefono || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">RUT/Pasaporte</p>
              <p class="text-base font-mono">{{ getIdentificador(primerProspecto) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Género</p>
              <p class="text-base">{{ primerProspecto?.genero || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Año de Nacimiento</p>
              <p class="text-base">{{ primerProspecto?.anio_nacimiento || '-' }}</p>
            </div>
            <div v-if="tieneMultiplesSimulaciones" class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground">Total de Simulaciones</p>
              <Badge variant="outline" class="text-base">
                {{ prospectosList.length }} {{ prospectosList.length === 1 ? 'simulación' : 'simulaciones' }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Card de Resumen de Diferencias (solo si hay múltiples simulaciones) -->
        <Card v-if="tieneMultiplesSimulaciones && diferenciasSimulaciones" class="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle class="text-lg">Resumen de Simulaciones</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <p class="text-sm text-muted-foreground">
              Este usuario realizó <strong>{{ diferenciasSimulaciones.totalSimulaciones }} simulaciones</strong> con las siguientes diferencias:
            </p>
            
            <div class="space-y-2">
              <!-- Diferencias de Carreras -->
              <div v-if="diferenciasSimulaciones.tieneDiferentesCarreras" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Carreras:</span>
                <div class="flex flex-wrap gap-2">
                  <Badge 
                    v-for="(carrera, idx) in diferenciasSimulaciones.carreras" 
                    :key="carrera.id"
                    variant="outline"
                    class="text-xs"
                  >
                    {{ carrera.nombre }}
                  </Badge>
                </div>
              </div>
              <div v-else-if="diferenciasSimulaciones.carreras.length > 0" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Carrera:</span>
                <Badge variant="outline" class="text-xs">
                  {{ diferenciasSimulaciones.carreras[0].nombre }}
                </Badge>
                <span class="text-xs text-muted-foreground">(misma en todas las simulaciones)</span>
              </div>

              <!-- Diferencias de Becas -->
              <div v-if="diferenciasSimulaciones.tieneDiferentesBecas" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Becas:</span>
                <div class="flex flex-wrap gap-2">
                  <Badge 
                    v-for="(beca, idx) in diferenciasSimulaciones.becas" 
                    :key="beca.id"
                    variant="outline"
                    class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    {{ beca.nombre }}
                  </Badge>
                </div>
              </div>
              <div v-else-if="diferenciasSimulaciones.becas.length > 0" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Beca:</span>
                <Badge variant="outline" class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {{ diferenciasSimulaciones.becas[0].nombre }}
                </Badge>
                <span class="text-xs text-muted-foreground">(misma en todas las simulaciones)</span>
              </div>

              <!-- Diferencias de Fuentes -->
              <div v-if="diferenciasSimulaciones.tieneDiferentesFuentes" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Fuentes:</span>
                <div class="flex flex-wrap gap-2">
                  <Badge 
                    v-for="(fuente, idx) in diferenciasSimulaciones.fuentes" 
                    :key="fuente.id"
                    variant="outline"
                    class="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                  >
                    {{ fuente.fuente }}
                  </Badge>
                </div>
              </div>
              <div v-else-if="diferenciasSimulaciones.fuentes.length > 0" class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Fuente:</span>
                <Badge variant="outline" class="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  {{ diferenciasSimulaciones.fuentes[0].fuente }}
                </Badge>
                <span class="text-xs text-muted-foreground">(misma en todas las simulaciones)</span>
              </div>

              <!-- Período de tiempo -->
              <div class="flex items-start gap-2">
                <span class="text-sm font-medium text-muted-foreground min-w-[120px]">Período:</span>
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-muted-foreground">
                    Desde {{ formatearFechaProspecto(diferenciasSimulaciones.fechaMasAntigua.toISOString()) }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    Hasta {{ formatearFechaProspecto(diferenciasSimulaciones.fechaMasReciente.toISOString()) }}
                  </span>
                  <span v-if="diferenciasSimulaciones.diasDiferencia > 0" class="text-xs text-muted-foreground">
                    ({{ diferenciasSimulaciones.diasDiferencia }} {{ diferenciasSimulaciones.diasDiferencia === 1 ? 'día' : 'días' }} de diferencia)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Accordion de Simulaciones -->
        <div class="space-y-2">
          <h3 class="text-lg font-semibold mb-3">Simulaciones</h3>
          <Card v-for="(prospecto, index) in prospectosList" :key="prospecto.id" class="border">
            <CardHeader class="pb-3">
              <button
                type="button"
                @click="toggleAccordion(prospecto.id)"
                class="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity"
              >
                <div class="flex items-center gap-3 flex-1">
                  <span class="text-sm font-semibold text-muted-foreground">#{{ index + 1 }}</span>
                  <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <CardTitle class="text-base">
                        Simulación {{ index + 1 }}
                      </CardTitle>
                      <!-- Badge de más reciente -->
                      <Badge v-if="index === 0" variant="default" class="text-xs">
                        Más reciente
                      </Badge>
                      <!-- Badge de más antigua -->
                      <Badge v-if="index === prospectosList.length - 1 && prospectosList.length > 1" variant="secondary" class="text-xs">
                        Más antigua
                      </Badge>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap mt-1">
                      <!-- Badge de Carrera -->
                      <Badge 
                        v-if="carrerasInfo[prospecto.id]" 
                        variant="outline" 
                        class="text-xs"
                      >
                        {{ carrerasInfo[prospecto.id]?.nombre_programa }}
                      </Badge>
                      <Badge 
                        v-else-if="prospecto.carrera" 
                        variant="outline" 
                        class="text-xs"
                      >
                        Carrera ID: {{ prospecto.carrera }}
                      </Badge>
                      <!-- Badge de Beca -->
                      <Badge 
                        v-if="becasInfo[prospecto.id]" 
                        variant="outline" 
                        class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        Beca: {{ becasInfo[prospecto.id]?.nombre }}
                      </Badge>
                      <Badge 
                        v-else-if="prospecto.beca" 
                        variant="outline" 
                        class="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        Beca ID: {{ prospecto.beca }}
                      </Badge>
                      <!-- Badge de Fuente -->
                      <Badge 
                        variant="outline" 
                        class="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {{ obtenerFuente(prospecto) }}
                      </Badge>
                      <!-- Fecha -->
                      <span class="text-xs text-muted-foreground">
                        {{ formatearFechaProspecto(prospecto.created_at) }}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronDown 
                  class="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2"
                  :class="{ 'rotate-180': openAccordions.has(prospecto.id) }"
                />
              </button>
            </CardHeader>
            <CardContent v-show="openAccordions.has(prospecto.id)" class="pt-0 space-y-4">
              <!-- Información Académica -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Información Académica</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Curso</p>
              <p class="text-base">{{ prospecto.curso }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Colegio</p>
              <p class="text-base">{{ prospecto.colegio || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Año de Egreso</p>
              <p class="text-base">{{ prospecto.año_egreso || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">NEM</p>
              <p class="text-base">{{ prospecto.nem || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Ranking</p>
              <p class="text-base">{{ prospecto.ranking || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">PAES</p>
              <Badge :variant="prospecto.paes ? 'default' : 'secondary'">
                {{ prospecto.paes ? 'Sí' : 'No' }}
              </Badge>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Comprensión Lectora</p>
              <p class="text-base">{{ prospecto.comprension_lectora || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Matemática 1</p>
              <p class="text-base">{{ prospecto.matematica1 || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">CAE</p>
              <Badge :variant="prospecto.cae ? 'default' : 'secondary'">
                {{ prospecto.cae ? 'Sí' : 'No' }}
              </Badge>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Becas Estado</p>
              <Badge :variant="prospecto.becas_estado ? 'default' : 'secondary'">
                {{ prospecto.becas_estado ? 'Sí' : 'No' }}
              </Badge>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Rango Ingreso</p>
              <p class="text-base">{{ prospecto.rango_ingreso || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Decil</p>
              <p class="text-base">{{ prospecto.decil || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Información de Ubicación -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Ubicación</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Región</p>
              <p class="text-base">{{ prospecto.region || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Comuna</p>
              <p class="text-base">{{ prospecto.comuna || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Información de Carrera -->
        <Card v-if="prospecto.carrera">
          <CardHeader>
            <CardTitle class="text-lg">Información de Carrera</CardTitle>
          </CardHeader>
          <CardContent v-if="isLoadingCarreras[prospecto.id]" class="py-4 text-center">
            <p class="text-sm text-muted-foreground">Cargando información de la carrera...</p>
          </CardContent>
          <CardContent v-else-if="carrerasInfo[prospecto.id]" class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">ID</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.id }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Año</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.anio }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground">Nombre del Programa</p>
              <p class="text-base font-semibold">{{ carrerasInfo[prospecto.id]?.nombre_programa }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Nivel Académico</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.nivel_academico || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Modalidad</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.modalidad_programa || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Duración</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.duracion_programa }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Facultad</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.facultad || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Código de Carrera</p>
              <p class="text-base font-mono">{{ carrerasInfo[prospecto.id]?.codigo_carrera || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Matrícula</p>
              <p class="text-base">${{ carrerasInfo[prospecto.id]?.matricula?.toLocaleString('es-CL') }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Arancel</p>
              <p class="text-base">${{ carrerasInfo[prospecto.id]?.arancel?.toLocaleString('es-CL') }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Arancel Referencia</p>
              <p class="text-base">${{ carrerasInfo[prospecto.id]?.arancel_referencia?.toLocaleString('es-CL') }} ({{ carrerasInfo[prospecto.id]?.anio_arancel_referencia }})</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Versión Simulador</p>
              <p class="text-base">{{ carrerasInfo[prospecto.id]?.version_simulador }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground mb-2">Descripción del Programa</p>
              <p class="text-sm">{{ carrerasInfo[prospecto.id]?.descripcion_programa }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground mb-2">Requisitos de Ingreso</p>
              <p class="text-sm whitespace-pre-wrap">{{ carrerasInfo[prospecto.id]?.requisitos_ingreso }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground mb-2">Malla</p>
              <p class="text-sm whitespace-pre-wrap">{{ carrerasInfo[prospecto.id]?.malla }}</p>
            </div>
          </CardContent>
          <CardContent v-else class="py-4 text-center">
            <p class="text-sm text-muted-foreground">No se encontró información de la carrera</p>
          </CardContent>
        </Card>

        <!-- Información de Beca -->
        <Card v-if="prospecto.beca">
          <CardHeader>
            <CardTitle class="text-lg">Información de Beca</CardTitle>
          </CardHeader>
          <CardContent v-if="isLoadingBecas[prospecto.id]" class="py-4 text-center">
            <p class="text-sm text-muted-foreground">Cargando información de la beca...</p>
          </CardContent>
          <CardContent v-else-if="becasInfo[prospecto.id]" class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Código de Beca</p>
              <p class="text-base font-mono">{{ becasInfo[prospecto.id]?.codigo_beca }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Descuento Porcentaje</p>
              <p class="text-base font-semibold">{{ becasInfo[prospecto.id]?.descuento_porcentaje }}%</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground">Nombre</p>
              <p class="text-base font-semibold">{{ becasInfo[prospecto.id]?.nombre }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-sm font-medium text-muted-foreground mb-2">Descripción</p>
              <p class="text-sm whitespace-pre-wrap">{{ becasInfo[prospecto.id]?.descripcion }}</p>
            </div>
          </CardContent>
          <CardContent v-else class="py-4 text-center">
            <p class="text-sm text-muted-foreground">No se encontró información de la beca</p>
          </CardContent>
        </Card>

        <!-- Información de Marketing -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Información de Marketing</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Consentimiento Contacto</p>
              <Badge :variant="prospecto.consentimiento_contacto ? 'default' : 'destructive'">
                {{ prospecto.consentimiento_contacto ? 'Sí' : 'No' }}
              </Badge>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">URL Origen</p>
              <a v-if="prospecto.url_origen" :href="prospecto.url_origen" target="_blank" class="text-sm text-primary hover:underline break-all">
                {{ prospecto.url_origen }}
              </a>
              <p v-else class="text-sm">-</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">UTM Source</p>
              <p class="text-sm">{{ prospecto.utm_source || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">UTM Medium</p>
              <p class="text-sm">{{ prospecto.utm_medium || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">UTM Campaign</p>
              <p class="text-sm">{{ prospecto.utm_campaign || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">UTM Term</p>
              <p class="text-sm">{{ prospecto.utm_term || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">UTM Content</p>
              <p class="text-sm">{{ prospecto.utm_content || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Campaign ID</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.campaign_id || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Ad ID</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.ad_id || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Google Click ID (gclid)</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.gclid || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Facebook Click ID (fbclid)</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.fbclid || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Microsoft Click ID (msclkid)</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.msclkid || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">TikTok Click ID (ttclid)</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.ttclid || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">LinkedIn Click ID (li_fat_id)</p>
              <p class="text-sm font-mono text-xs">{{ prospecto.li_fat_id || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">First Touch URL</p>
              <a v-if="prospecto.first_touch_url" :href="prospecto.first_touch_url" target="_blank" class="text-sm text-primary hover:underline break-all">
                {{ prospecto.first_touch_url }}
              </a>
              <p v-else class="text-sm">-</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">First Touch Timestamp</p>
              <p class="text-sm">{{ formatearFechaCompleta(prospecto.first_touch_timestamp) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Last Touch URL</p>
              <a v-if="prospecto.last_touch_url" :href="prospecto.last_touch_url" target="_blank" class="text-sm text-primary hover:underline break-all">
                {{ prospecto.last_touch_url }}
              </a>
              <p v-else class="text-sm">-</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Last Touch Timestamp</p>
              <p class="text-sm">{{ formatearFechaCompleta(prospecto.last_touch_timestamp) }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Fechas del Sistema -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Fechas del Sistema</CardTitle>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Fecha de Creación</p>
              <p class="text-sm">{{ formatearFechaCompleta(prospecto.created_at) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Última Actualización</p>
              <p class="text-sm">{{ formatearFechaCompleta(prospecto.updated_at) }}</p>
            </div>
          </CardContent>
        </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

