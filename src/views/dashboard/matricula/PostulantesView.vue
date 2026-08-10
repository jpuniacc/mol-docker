<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, Eye, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next'
import { usePostulantesStore } from '@/stores/postulantes'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PostulantesFiltros from '@/components/Postulantes/PostulantesFiltros.vue'
import PostulantesStats from '@/components/Postulantes/PostulantesStats.vue'
import PostulanteDetalle from '@/components/Postulantes/PostulanteDetalle.vue'
import { Badge } from '@/components/ui/badge'
import { toast } from 'vue-sonner'
import { getNombreCompleto, getRutCompleto, formatearFecha, contarCarreras, obtenerEstadoCarrera, obtenerBadgeEstado } from '@/types/postulante'
import type { Postulante } from '@/types/postulante'

const store = usePostulantesStore()
const { nextRefreshMessage } = useAutoRefresh()

// Estado local
const detalleOpen = ref(false)
const isLoadingDetalle = ref(false)
const isRefreshing = ref(false)

onMounted(async () => {
  await store.cargarStats()
  await store.cargarPostulantes()
})

// Manejar filtros
function handleActualizarFiltros(filtros: Parameters<typeof store.actualizarFiltros>[0]) {
  store.actualizarFiltros(filtros)
}

function handleLimpiarFiltros() {
  store.limpiarFiltros()
  store.cargarPostulantes()
}

function handleBuscar() {
  store.cargarPostulantes()
}

// Paginación
function irAPaginaAnterior() {
  if (store.paginacion.page > 1) {
    store.cambiarPagina(store.paginacion.page - 1)
  }
}

function irAPaginaSiguiente() {
  if (store.paginacion.page < store.paginacion.totalPages) {
    store.cambiarPagina(store.paginacion.page + 1)
  }
}

// Ver detalle
async function verDetalle(postulante: Postulante) {
  isLoadingDetalle.value = true
  detalleOpen.value = true
  await store.cargarPostulante(postulante.CODINT)
  isLoadingDetalle.value = false
}

function cerrarDetalle() {
  detalleOpen.value = false
  store.limpiarPostulanteSeleccionado()
}

// Manejar actualización de desistimiento
async function handleDesistimientoActualizado() {
  await Promise.all([
    store.cargarPostulantes(),
    store.cargarStats()
  ])
  store.limpiarPostulanteSeleccionado()
}

// Exportar
async function handleExportar(format: 'csv' | 'json' = 'csv') {
  await store.exportar(format)
}

// Actualizar datos manualmente
async function handleRefresh() {
  isRefreshing.value = true
  try {
    await store.refreshData()
  } finally {
    isRefreshing.value = false
  }
}

// Obtener label del estado de seguimiento
function obtenerLabelEstadoSeguimiento(estado: string | null | undefined): string | null {
  if (!estado) return null
  
  const estados: Record<string, string> = {
    'no_contesta': 'No Contesta',
    'pendiente_documentacion': 'Pendiente documentación',
    'evaluando': 'Evaluando',
    'alumno_vigente': 'Alumno Vigente',
  }
  
  return estados[estado] || estado
}

type EstadoCarreraCodigo = NonNullable<Postulante['estados']>[number]['ESTADO']

// Obtener el estado más relevante para mostrar en la tabla
function obtenerEstadoParaTabla(postulante: Postulante): EstadoCarreraCodigo | null {
  // 1. Si está matriculado en CUALQUIER carrera, mostrar 'M'
  if (postulante.estados?.some(e => e.ESTADO === 'M')) {
    return 'M'
  }

  // 2. Si no, buscar el estado de su carrera principal (CARRINT1 + JORNADACARRER)
  const estadoCarreraPrincipal = postulante.estados?.find(
    (e) => e.CODCARR === postulante.CARRINT1 && e.JORNADA === postulante.JORNADACARRER,
  )

  const raw = estadoCarreraPrincipal?.ESTADO
  if (raw === 'U' || raw === 'E' || raw === 'A' || raw === 'M' || raw === 'R') {
    return raw
  }

  // 3. Si no hay estado, es "Pendiente actualización datos U+"
  return null
}

// Obtener el nombre, código y jornada de la carrera a mostrar en la tabla
function obtenerCarreraParaTabla(postulante: Postulante): { nombre: string | null, codigo: string | null, jornada: string | null } {
  // 1. Si tiene carrera de interés (CARRINT1), mostrar esa
  if (postulante.NOMBRE_C) {
    return {
      nombre: postulante.NOMBRE_C,
      codigo: postulante.CARRINT1,
      jornada: postulante.JORNADACARRER
    }
  }
  
  // 2. Si no, pero está matriculado, mostrar la carrera matriculada
  const matriculado = postulante.estados?.find(e => e.ESTADO === 'M')
  if (matriculado) {
    return {
      nombre: matriculado.NOMBRE_CARRERA || matriculado.CODCARR,
      codigo: matriculado.CODCARR,
      jornada: matriculado.JORNADA
    }
  }
  
  // 3. Si no hay nada, retornar null
  return { nombre: null, codigo: null, jornada: null }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Encabezado compacto -->
    <div class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-primary">Postulantes 2026</h1>
          <p class="text-sm text-muted-foreground mt-1">
            {{ store.paginacion.total }} registrados
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
            :disabled="isRefreshing || store.isLoading"
          >
            <RefreshCw :class="['mr-1.5 h-3.5 w-3.5', { 'animate-spin': isRefreshing || store.isLoading }]" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" @click="handleExportar('csv')">
            <Download class="mr-1.5 h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      </div>
    </div>

    <!-- Estadísticas -->
    <div class="relative z-0 mb-4" style="isolation: isolate;">
      <PostulantesStats :stats="store.stats" :is-loading="store.isLoading" />
    </div>

    <!-- Filtros -->
    <div class="relative z-20" style="isolation: isolate;">
      <PostulantesFiltros
        :filtros="store.filtros"
        :carreras="store.carrerasDisponibles"
        @update="handleActualizarFiltros"
        @limpiar="handleLimpiarFiltros"
        @buscar="handleBuscar"
      />
    </div>

    <!-- Tabla de postulantes -->
    <Card>
      <CardContent class="p-0">
        <!-- Loading state -->
        <div v-if="store.isLoading" class="space-y-3">
          <div v-for="i in 8" :key="i" class="flex items-center gap-4 rounded-lg border p-4">
            <div class="h-10 w-24 animate-pulse rounded-md bg-muted"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-48 animate-pulse rounded bg-muted"></div>
              <div class="h-3 w-32 animate-pulse rounded bg-muted"></div>
            </div>
            <div class="space-y-1.5">
              <div class="h-8 w-40 animate-pulse rounded-full bg-muted"></div>
              <div class="h-3 w-24 animate-pulse rounded bg-muted ml-1"></div>
            </div>
            <div class="h-4 w-20 animate-pulse rounded bg-muted"></div>
            <div class="h-8 w-24 animate-pulse rounded bg-muted"></div>
          </div>
        </div>

        <!-- Tabla con datos -->
        <div v-else-if="store.postulantes.length > 0" class="overflow-x-auto">
          <div class="min-w-full inline-block align-middle">
            <div class="overflow-hidden rounded-lg border">
              <table class="min-w-full divide-y divide-border">
                <thead class="bg-muted/50">
                  <tr>
                    <th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold">
                      RUT
                    </th>
                    <th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold">
                      Nombre Postulante
                    </th>
                    <th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold">
                      Contacto
                    </th>
                    <th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold">
                      Carrera
                    </th>
                    <th scope="col" class="px-3 py-2.5 text-left text-xs font-semibold">
                      Fecha Postulación
                    </th>
                    <th scope="col" class="relative px-3 py-2.5 w-24">
                      <span class="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border bg-background">
                  <tr 
                    v-for="postulante in store.postulantes" 
                    :key="postulante.CODINT"
                    class="group hover:bg-muted/50 transition-all duration-100"
                  >
                    <!-- RUT -->
                    <td class="whitespace-nowrap px-3 py-2.5">
                      <span class="font-mono text-xs font-medium text-primary">
                        {{ getRutCompleto(postulante) }}
                      </span>
                    </td>

                    <!-- Nombre -->
                    <td class="px-3 py-2.5">
                      <div class="flex flex-col">
                        <div class="font-medium text-sm">
                          {{ getNombreCompleto(postulante) }}
                        </div>
                        <div v-if="postulante.NOMBRECOL" class="text-xs text-muted-foreground truncate max-w-[180px]">
                          {{ postulante.NOMBRECOL }}
                        </div>
                      </div>
                    </td>

                    <!-- Contacto -->
                    <td class="px-3 py-2.5">
                      <div class="flex flex-col gap-0.5">
                        <div v-if="postulante.EMAIL" class="flex items-center gap-1 text-xs">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span class="truncate max-w-[160px]" :title="postulante.EMAIL">
                            {{ postulante.EMAIL.toLowerCase() }}
                          </span>
                        </div>
                        <div v-if="postulante.CELULAR" class="flex items-center gap-1 text-xs text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span class="font-mono">{{ postulante.CELULAR }}</span>
                        </div>
                        <div v-if="!postulante.EMAIL && !postulante.CELULAR" class="text-xs text-muted-foreground">
                          -
                        </div>
                      </div>
                    </td>

                    <!-- Carrera -->
                    <td class="px-3 py-2.5">
                      <div v-if="obtenerCarreraParaTabla(postulante).nombre" class="flex flex-col gap-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <!-- Nombre de carrera con código -->
                          <span class="text-xs font-medium text-primary truncate max-w-[180px]" :title="obtenerCarreraParaTabla(postulante).nombre!">
                            <template v-if="obtenerCarreraParaTabla(postulante).codigo && obtenerCarreraParaTabla(postulante).nombre">
                              {{ obtenerCarreraParaTabla(postulante).codigo }}-{{ obtenerCarreraParaTabla(postulante).nombre }}
                            </template>
                            <template v-else>
                              {{ obtenerCarreraParaTabla(postulante).nombre }}
                            </template>
                          </span>
                          
                          <!-- Badge de estado de seguimiento (solo si NO es alumno_vigente, ya que ese se muestra como estado principal) -->
                          <Badge 
                            v-if="postulante.estado_seguimiento && postulante.estado_seguimiento !== 'alumno_vigente' && !postulante.desistido" 
                            variant="outline"
                            class="text-[10px] gap-0.5 font-medium px-1.5 py-0"
                          >
                            {{ obtenerLabelEstadoSeguimiento(postulante.estado_seguimiento) }}
                          </Badge>
                          
                          <!-- Badge de desistido -->
                          <Badge 
                            v-if="postulante.desistido" 
                            variant="destructive"
                            class="text-[10px] gap-0.5 font-medium px-1.5 py-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Desistido
                          </Badge>
                          
                          <!-- Badge de estado (solo si NO está desistido) -->
                          <Badge 
                            v-if="!postulante.desistido"
                            :variant="obtenerBadgeEstado(obtenerEstadoParaTabla(postulante), postulante.FECREG, postulante.estado_seguimiento).variant"
                            class="text-[10px] gap-0.5 font-medium px-1.5 py-0"
                            :title="obtenerBadgeEstado(obtenerEstadoParaTabla(postulante), postulante.FECREG, postulante.estado_seguimiento).descripcion"
                          >
                            <!-- Icono -->
                            <svg 
                              v-if="obtenerBadgeEstado(obtenerEstadoParaTabla(postulante), postulante.FECREG, postulante.estado_seguimiento).tieneAlerta"
                              xmlns="http://www.w3.org/2000/svg" 
                              class="h-2.5 w-2.5" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <template v-else>
                              <svg 
                                v-if="!obtenerEstadoParaTabla(postulante) && !postulante.estado_seguimiento" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-3 w-3" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <svg 
                                v-else-if="postulante.estado_seguimiento === 'alumno_vigente'" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-2.5 w-2.5" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <!-- Indicador de detección automática -->
                              <svg 
                                v-if="postulante.estado_seguimiento === 'alumno_vigente' && postulante.es_vigente_automatico" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-2.5 w-2.5 ml-0.5 text-cyan-600" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                                title="Detectado automáticamente desde la base de datos"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              <svg 
                                v-else-if="obtenerEstadoParaTabla(postulante) === 'E'" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-3 w-3" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              <svg 
                                v-else-if="obtenerEstadoParaTabla(postulante) === 'A'" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-2.5 w-2.5" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <svg 
                                v-else-if="obtenerEstadoParaTabla(postulante) === 'M'" 
                                xmlns="http://www.w3.org/2000/svg" 
                                class="h-2.5 w-2.5" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                              </svg>
                            </template>
                            {{ obtenerBadgeEstado(obtenerEstadoParaTabla(postulante), postulante.FECREG, postulante.estado_seguimiento).texto }}
                          </Badge>
                          
                          <!-- Contador de carreras -->
                          <span v-if="contarCarreras(postulante) > 1" 
                                class="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
                                :title="`Postuló a ${contarCarreras(postulante)} carreras`">
                            +{{ contarCarreras(postulante) - 1 }}
                          </span>
                        </div>
                        
                        <!-- Jornada -->
                        <div v-if="obtenerCarreraParaTabla(postulante).jornada" class="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{{ obtenerCarreraParaTabla(postulante).jornada }}</span>
                        </div>
                      </div>
                      <span v-else class="text-xs text-muted-foreground">
                        Sin información de carrera
                      </span>
                    </td>

                    <!-- Fecha -->
                    <td class="whitespace-nowrap px-3 py-2.5">
                      <div class="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span class="text-xs text-muted-foreground">
                          {{ formatearFecha(postulante.FECREG) }}
                        </span>
                      </div>
                    </td>

                    <!-- Acciones -->
                    <td class="whitespace-nowrap px-3 py-2.5 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          class="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
                          @click="verDetalle(postulante)"
                        >
                          <Eye class="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Paginación -->
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div class="text-xs font-medium">
              <span class="font-bold text-primary">
                {{ (store.paginacion.page - 1) * store.paginacion.limit + 1 }}
              </span>
              -
              <span class="font-bold text-primary">
                {{
                  Math.min(
                    store.paginacion.page * store.paginacion.limit,
                    store.paginacion.total,
                  )
                }}
              </span>
              de 
              <span class="font-bold text-primary">{{ store.paginacion.total }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                :disabled="store.paginacion.page === 1"
                @click="irAPaginaAnterior"
                class="font-medium"
              >
                <ChevronLeft class="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <div class="rounded-md border bg-background px-3 py-1.5">
                <span class="text-sm font-semibold">
                  {{ store.paginacion.page }}
                </span>
                <span class="text-sm text-muted-foreground">
                  / {{ store.paginacion.totalPages }}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                :disabled="store.paginacion.page === store.paginacion.totalPages"
                @click="irAPaginaSiguiente"
                class="font-medium"
              >
                Siguiente
                <ChevronRight class="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Estado vacío -->
        <div v-else class="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12">
          <div class="rounded-full bg-muted p-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div class="text-center">
            <p class="text-base font-semibold">No se encontraron postulantes</p>
            <p class="mt-1 text-xs text-muted-foreground max-w-sm">
              No hay resultados que coincidan con los filtros aplicados.
            </p>
          </div>
          <Button variant="outline" size="sm" @click="handleLimpiarFiltros">
            Limpiar filtros
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Modal de detalle -->
    <PostulanteDetalle
      :open="detalleOpen"
      :postulante="store.postulanteSeleccionado"
      :is-loading="isLoadingDetalle"
      @update:open="cerrarDetalle"
      @desistimiento-actualizado="handleDesistimientoActualizado"
    />
  </div>
</template>

