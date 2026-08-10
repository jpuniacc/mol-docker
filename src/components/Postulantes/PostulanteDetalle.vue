<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import EstadoPostulacionTimeline from './EstadoPostulacionTimeline.vue'
import HistorialEstadosSeguimiento from './HistorialEstadosSeguimiento.vue'
import type { Postulante } from '@/types/postulante'
import { getNombreCompleto, getRutCompleto, formatearFecha, obtenerCarreras, obtenerEstadoCarrera } from '@/types/postulante'
import { useDesistimiento } from '@/composables/useDesistimiento'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
  postulante: Postulante | null
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'desistimiento-actualizado': []
}>()

const { marcarDesistido, desmarcarDesistido, actualizarEstadoSeguimiento, obtenerHistorialEstados, isLoading: isLoadingDesistimiento } = useDesistimiento()

// Historial de estados de seguimiento
const historialEstados = ref<Array<{
  id: number
  estado_anterior: string | null
  estado_nuevo: string | null
  fecha_cambio: string
}>>([])
const isLoadingHistorial = ref(false)

// Cargar historial cuando se abre el diálogo o cambia el postulante
watch([() => props.open, () => props.postulante?.CODINT], async ([isOpen, codint]) => {
  if (isOpen && codint) {
    isLoadingHistorial.value = true
    const historial = await obtenerHistorialEstados(codint)
    if (historial) {
      historialEstados.value = historial
    }
    isLoadingHistorial.value = false
  } else {
    historialEstados.value = []
  }
}, { immediate: true })

// Verificar si el postulante está matriculado en alguna carrera
const estaMatriculado = computed(() => {
  if (!props.postulante?.estados) return false
  return props.postulante.estados.some(estado => estado.ESTADO === 'M')
})

// Verificar si el postulante es alumno vigente
const esAlumnoVigente = computed(() => {
  return props.postulante?.estado_seguimiento === 'alumno_vigente'
})

// Obtener todas las carreras relevantes (interés + matriculadas extras)
const carrerasParaMostrar = computed(() => {
  if (!props.postulante) return []
  
  const carreras: Array<{numero: number, codigo: string, nombre: string | null}> = []
  
  // 1. Agregar carreras de interés (CARRINT1-5)
  const carrerasInteres = obtenerCarreras(props.postulante).map((c) => ({
    numero: c.numero,
    codigo: c.codigo,
    nombre: c.nombre ?? null,
  }))
  carreras.push(...carrerasInteres)
  
  // 2. Agregar carreras matriculadas que NO estén en la lista de interés
  if (props.postulante.estados) {
    const codigosInteres = carrerasInteres.map(c => c.codigo)
    const matriculadas = props.postulante.estados.filter(e => 
      e.ESTADO === 'M' && !codigosInteres.includes(e.CODCARR)
    )
    
    // Agregar cada carrera matriculada extra
    matriculadas.forEach((estado, index) => {
      carreras.push({
        numero: carreras.length + 1,
        codigo: estado.CODCARR,
        nombre: estado.NOMBRE_CARRERA || null
      })
    })
  }
  
  return carreras
})

function handleOpenChange(value: boolean) {
  emit('update:open', value)
}

async function toggleDesistido() {
  if (!props.postulante) return
  
  const exito = props.postulante.desistido 
    ? await desmarcarDesistido(props.postulante.CODINT)
    : await marcarDesistido(props.postulante.CODINT)
    
  if (exito) {
    toast.success(
      props.postulante.desistido ? 'Postulante reactivado' : 'Postulante marcado como desistido',
      {
        description: props.postulante.desistido 
          ? 'El postulante ha sido reactivado exitosamente.'
          : 'El postulante ha sido marcado como desistido.',
      }
    )
      emit('desistimiento-actualizado')
      // Recargar historial
      const historial = await obtenerHistorialEstados(props.postulante.CODINT)
      if (historial) {
        historialEstados.value = historial
      }
      emit('update:open', false)
  } else {
    toast.error('Error', {
      description: 'No se pudo actualizar el estado del postulante.',
    })
  }
}

// Estados de seguimiento disponibles
const estadosSeguimiento = [
  { valor: 'no_contesta', label: 'No Contesta', color: 'secondary' },
  { valor: 'pendiente_documentacion', label: 'Pendiente envío documentación', color: 'default' },
  { valor: 'evaluando', label: 'Evaluando', color: 'default' },
  { valor: 'alumno_vigente', label: 'Alumno Vigente', color: 'default' },
]

async function cambiarEstadoSeguimiento(estado: string) {
  if (!props.postulante) return
  
  // Si el estado ya está seleccionado, preguntar si se desea eliminar
  if (props.postulante.estado_seguimiento === estado) {
    const estadoLabel = estadosSeguimiento.find(e => e.valor === estado)?.label || estado
    const confirmar = window.confirm(
      `¿Desea eliminar el estado "${estadoLabel}"?\n\nEl estado de seguimiento será removido del postulante.`
    )
    
    if (!confirmar) {
      return
    }
    
    // Eliminar el estado (pasar null)
    const exito = await actualizarEstadoSeguimiento(props.postulante.CODINT, null)
    
    if (exito) {
      toast.success('Estado eliminado', {
        description: `El estado de seguimiento "${estadoLabel}" ha sido eliminado.`,
      })
      emit('desistimiento-actualizado')
      // Recargar historial
      const historial = await obtenerHistorialEstados(props.postulante.CODINT)
      if (historial) {
        historialEstados.value = historial
      }
      emit('update:open', false)
    } else {
      toast.error('Error', {
        description: 'No se pudo eliminar el estado de seguimiento.',
      })
    }
    return
  }
  
  // Si no está seleccionado, actualizar normalmente
  const exito = await actualizarEstadoSeguimiento(props.postulante.CODINT, estado)
  
  if (exito) {
    const estadoLabel = estadosSeguimiento.find(e => e.valor === estado)?.label || estado
    toast.success('Estado actualizado', {
      description: `El estado de seguimiento se ha actualizado a: ${estadoLabel}`,
    })
    emit('desistimiento-actualizado')
    // Recargar historial
    const historial = await obtenerHistorialEstados(props.postulante.CODINT)
    if (historial) {
      historialEstados.value = historial
    }
    emit('update:open', false)
  } else {
    toast.error('Error', {
      description: 'No se pudo actualizar el estado de seguimiento.',
    })
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="max-h-[90vh] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Detalle del Postulante</DialogTitle>
        <DialogDescription>
          <span v-if="postulante">
            {{ getRutCompleto(postulante) }} - Registrado el {{ formatearFecha(postulante.FECREG) }}
          </span>
          <span v-else>
            Cargando información del postulante...
          </span>
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="space-y-4">
        <div class="h-20 animate-pulse rounded-lg bg-muted"></div>
        <div class="h-20 animate-pulse rounded-lg bg-muted"></div>
        <div class="h-20 animate-pulse rounded-lg bg-muted"></div>
      </div>

      <div v-else-if="postulante" class="space-y-4">
        <!-- Carreras de Interés y Estado de Postulación (PRIMERO) -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Carreras de Interés y Estado de Postulación</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="carrerasParaMostrar.length > 0" class="flex flex-col gap-6">
              <div 
                v-for="carrera in carrerasParaMostrar" 
                :key="carrera.numero" 
                :class="[
                  'border rounded-lg p-4',
                  obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'M' 
                    ? 'bg-gradient-to-r from-teal-50 to-transparent border-teal-300 dark:from-teal-950 dark:border-teal-700' 
                    : obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'R'
                    ? 'bg-gradient-to-r from-red-50 to-transparent border-red-300 dark:from-red-950 dark:border-red-700'
                    : 'bg-gradient-to-r from-primary/5 to-transparent'
                ]"
              >
                <!-- Header de carrera -->
                <div class="flex items-start gap-3 mb-4">
                  <Badge :variant="carrera.numero === 1 ? 'default' : 'secondary'" class="shrink-0">
                    {{ carrera.numero }}
                  </Badge>
                  <div class="flex-1">
                    <div class="flex items-start gap-2 flex-wrap">
                      <p :class="carrera.numero === 1 ? 'text-base font-bold' : 'text-sm font-semibold'">
                        {{ carrera.nombre || carrera.codigo }}
                      </p>
                      <!-- Badge de MATRICULADO -->
                      <Badge 
                        v-if="obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'M'"
                        variant="default"
                        class="bg-teal-600 text-white text-xs gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        MATRICULADO
                      </Badge>
                      <!-- Badge de RECHAZADO -->
                      <Badge 
                        v-else-if="obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'R'"
                        variant="destructive"
                        class="text-xs gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        RECHAZADO
                      </Badge>
                    </div>
                    <p v-if="carrera.nombre" class="text-xs text-muted-foreground mt-0.5">
                      Código: {{ carrera.codigo }}
                    </p>
                    <!-- Fecha de matrícula -->
                    <p 
                      v-if="obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'M' && obtenerEstadoCarrera(postulante, carrera.codigo)?.FECMOD"
                      class="text-xs text-teal-700 dark:text-teal-400 mt-1 font-medium flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Matriculado el {{ formatearFecha(obtenerEstadoCarrera(postulante, carrera.codigo)?.FECMOD ?? '') }}
                    </p>
                    <!-- Mensaje de rechazado -->
                    <p 
                      v-if="obtenerEstadoCarrera(postulante, carrera.codigo)?.ESTADO === 'R'"
                      class="text-xs text-red-700 dark:text-red-400 mt-1 font-medium flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Postulación rechazada - No se sigue gestionando
                    </p>
                  </div>
                </div>
                
                <!-- Timeline de estados -->
                <EstadoPostulacionTimeline 
                  :estado-actual="obtenerEstadoCarrera(postulante, carrera.codigo)"
                  :es-alumno-vigente="postulante.estado_seguimiento === 'alumno_vigente'"
                  :es-desistido="postulante.desistido === true"
                />
              </div>
            </div>
            <p v-else class="text-sm text-muted-foreground">
              No hay información de carreras o matrículas registradas
            </p>
          </CardContent>
        </Card>
        
        <!-- Datos Personales -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Datos Personales</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Nombre Completo</p>
              <p class="text-sm">{{ getNombreCompleto(postulante) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">RUT</p>
              <p class="text-sm">{{ getRutCompleto(postulante) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Sexo</p>
              <p class="text-sm">{{ postulante.SEXO }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Fecha de Nacimiento</p>
              <p class="text-sm">{{ formatearFecha(postulante.FECNAC) }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Estado Civil</p>
              <p class="text-sm">{{ postulante.ESTADOCIVIL || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Nacionalidad</p>
              <p class="text-sm">{{ postulante.NACIONALIDAD || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Estado de Seguimiento Actual -->
        <Card v-if="postulante.estado_seguimiento" class="border-primary">
          <CardContent class="pt-4">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Badge variant="outline" class="text-sm">
                  Estado:
                  {{
                    estadosSeguimiento.find((e) => e.valor === postulante!.estado_seguimiento)?.label
                      ?? postulante!.estado_seguimiento
                  }}
                </Badge>
                <Badge 
                  v-if="postulante.estado_seguimiento === 'alumno_vigente' && postulante.es_vigente_automatico" 
                  variant="secondary" 
                  class="text-xs"
                  title="Este estado fue detectado automáticamente desde la base de datos de alumnos"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Auto
                </Badge>
              </div>
            </div>
            <p v-if="postulante.estado_seguimiento === 'alumno_vigente' && postulante.es_vigente_automatico" class="text-xs text-muted-foreground mt-2">
              Detectado automáticamente: El postulante está registrado como alumno vigente en el sistema académico.
            </p>
          </CardContent>
        </Card>

        <!-- Acciones de Estado de Seguimiento -->
        <Card v-if="!estaMatriculado">
          <CardHeader>
            <CardTitle class="text-lg">Estado de Seguimiento</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid grid-cols-2 gap-2">
              <Button
                v-for="estado in estadosSeguimiento"
                :key="estado.valor"
                :variant="postulante.estado_seguimiento === estado.valor ? 'default' : 'outline'"
                :disabled="isLoadingDesistimiento"
                @click="cambiarEstadoSeguimiento(estado.valor)"
                class="w-full justify-start"
                size="sm"
              >
                {{ estado.label }}
              </Button>
            </div>
            
            <!-- Historial de Estados -->
            <div v-if="historialEstados.length > 0 || isLoadingHistorial" class="border-t pt-3">
              <h4 class="text-xs font-semibold mb-2 text-muted-foreground">Historial de Cambios</h4>
              <HistorialEstadosSeguimiento 
                :historial="historialEstados" 
                :is-loading="isLoadingHistorial"
                variant="compact-list"
              />
            </div>
            
            <!-- Separador -->
            <div class="border-t pt-4">
              <!-- Acciones de Desistimiento -->
              <div v-if="!esAlumnoVigente" class="flex justify-between items-center">
                <Button
                  :variant="postulante.desistido ? 'outline' : 'destructive'"
                  :disabled="isLoadingDesistimiento"
                  @click="toggleDesistido"
                  class="gap-2"
                >
                  <svg v-if="postulante.desistido" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {{ postulante.desistido ? 'Reactivar Postulante' : 'Marcar como Desistido' }}
                </Button>
              </div>
              
              <!-- Mensaje cuando es alumno vigente -->
              <div v-else-if="esAlumnoVigente" class="flex items-center gap-2 text-sm text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>El postulante es alumno vigente. No es posible marcarlo como desistido.</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <!-- Mensaje cuando está matriculado (fuera del card de estado de seguimiento) -->
        <div v-if="estaMatriculado" class="flex items-center gap-2 pt-4 border-t text-sm text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>El postulante está matriculado. No es posible marcarlo como desistido.</span>
        </div>

        <!-- Datos de Contacto -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Datos de Contacto</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Email</p>
              <p class="text-sm">{{ postulante.EMAIL || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Celular</p>
              <p class="text-sm">{{ postulante.CELULAR || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Teléfono</p>
              <p class="text-sm">{{ postulante.TELEFONO || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Dirección</p>
              <p class="text-sm">{{ postulante.DIRECCION || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Comuna</p>
              <p class="text-sm">{{ postulante.COMUNA || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Ciudad</p>
              <p class="text-sm">{{ postulante.CIUDAD || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Información Académica -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Información Académica</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Colegio</p>
              <p class="text-sm">{{ postulante.NOMBRECOL || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Comuna del Colegio</p>
              <p class="text-sm">{{ postulante.COMUNACOLEGIO || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Nota Enseñanza Media</p>
              <p class="text-sm">{{ postulante.NOTAEM || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Año de Egreso</p>
              <p class="text-sm">{{ postulante.ANOEGRESO || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Información Adicional -->
        <Card>
          <CardHeader>
            <CardTitle class="text-lg">Información Adicional</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 md:grid-cols-2">
            <div>
              <p class="text-sm font-medium text-muted-foreground">Sede</p>
              <p class="text-sm">{{ postulante.SEDE || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Jornada</p>
              <p class="text-sm">{{ postulante.JORNADACARRER || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Periodo</p>
              <p class="text-sm">{{ postulante.PERIODO || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Año</p>
              <p class="text-sm">{{ postulante.ANO || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Vía de Consulta</p>
              <p class="text-sm">{{ postulante.VIACONSULTA || '-' }}</p>
            </div>
            <div>
              <p class="text-sm font-medium text-muted-foreground">Código de Medio</p>
              <p class="text-sm">{{ postulante.CODMEDIO || '-' }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Observaciones -->
        <Card v-if="postulante.OBSERVAC1 || postulante.OBSERVAC2 || postulante.OBSERVAC3">
          <CardHeader>
            <CardTitle class="text-lg">Observaciones</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <p v-if="postulante.OBSERVAC1" class="text-sm">{{ postulante.OBSERVAC1 }}</p>
            <p v-if="postulante.OBSERVAC2" class="text-sm">{{ postulante.OBSERVAC2 }}</p>
            <p v-if="postulante.OBSERVAC3" class="text-sm">{{ postulante.OBSERVAC3 }}</p>
          </CardContent>
        </Card>
      </div>
    </DialogContent>
  </Dialog>
</template>

