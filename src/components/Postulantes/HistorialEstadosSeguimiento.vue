<script setup lang="ts">
import { formatearFecha } from '@/types/postulante'
import { ChevronRight } from 'lucide-vue-next'

interface HistorialItem {
  id: number
  estado_anterior: string | null
  estado_nuevo: string | null
  fecha_cambio: string
}

const props = defineProps<{
  historial: HistorialItem[]
  isLoading?: boolean
  variant?: 'compact-list' | 'compact-timeline' | 'badges' | 'table'
}>()

const variant = props.variant || 'compact-list'

const estadosLabels: Record<string, string> = {
  'no_contesta': 'No Contesta',
  'pendiente_documentacion': 'Pendiente documentación',
  'evaluando': 'Evaluando',
  'alumno_vigente': 'Alumno Vigente',
}

function obtenerLabelEstado(estado: string | null): string {
  if (!estado) return 'Sin estado'
  return estadosLabels[estado] || estado
}

function obtenerColorEstado(estado: string | null): string {
  if (!estado) return 'bg-gray-500'
  
  const colores: Record<string, string> = {
    'no_contesta': 'bg-gray-500',
    'pendiente_documentacion': 'bg-yellow-500',
    'evaluando': 'bg-blue-500',
    'alumno_vigente': 'bg-cyan-600',
  }
  
  return colores[estado] || 'bg-gray-500'
}

function obtenerColorBadge(estado: string | null): string {
  if (!estado) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  
  const colores: Record<string, string> = {
    'no_contesta': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    'pendiente_documentacion': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'evaluando': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'alumno_vigente': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  }
  
  return colores[estado] || 'bg-gray-100 text-gray-700'
}
</script>

<template>
  <!-- Loading State -->
  <div v-if="isLoading" class="py-2">
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <div class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      <span>Cargando historial...</span>
    </div>
  </div>
  
  <!-- Empty State -->
  <div v-else-if="historial.length === 0" class="py-2">
    <p class="text-xs text-muted-foreground text-center">No hay historial de cambios</p>
  </div>
  
  <!-- Variant: Compact List (Default) -->
  <div v-else-if="variant === 'compact-list'" class="space-y-1.5">
    <div 
      v-for="item in historial" 
      :key="item.id"
      class="flex items-center gap-2 text-xs py-1"
    >
      <div 
        :class="[
          'w-2 h-2 rounded-full flex-shrink-0',
          item.estado_nuevo ? obtenerColorEstado(item.estado_nuevo) : 'bg-gray-300'
        ]"
      ></div>
      <span class="text-muted-foreground flex-shrink-0 min-w-[85px]">
        {{ formatearFecha(item.fecha_cambio) }}
      </span>
      <ChevronRight class="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span 
        v-if="item.estado_anterior"
        class="text-muted-foreground line-through"
      >
        {{ obtenerLabelEstado(item.estado_anterior) }}
      </span>
      <span 
        v-if="item.estado_anterior && item.estado_nuevo"
        class="text-muted-foreground"
      >
        →
      </span>
      <span 
        :class="[
          'font-medium',
          item.estado_nuevo ? '' : 'text-muted-foreground'
        ]"
      >
        {{ item.estado_nuevo ? obtenerLabelEstado(item.estado_nuevo) : 'Estado eliminado' }}
      </span>
    </div>
  </div>

  <!-- Variant: Compact Timeline Vertical -->
  <div v-else-if="variant === 'compact-timeline'" class="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700">
    <div 
      v-for="(item, index) in historial" 
      :key="item.id"
      class="relative pb-3 last:pb-0"
    >
      <!-- Dot -->
      <div 
        :class="[
          'absolute -left-[9px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900',
          item.estado_nuevo ? obtenerColorEstado(item.estado_nuevo) : 'bg-gray-300'
        ]"
      ></div>
      
      <!-- Content -->
      <div class="text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span 
            v-if="item.estado_anterior"
            class="text-muted-foreground line-through"
          >
            {{ obtenerLabelEstado(item.estado_anterior) }}
          </span>
          <ChevronRight 
            v-if="item.estado_anterior && item.estado_nuevo"
            class="h-3 w-3 text-muted-foreground"
          />
          <span 
            :class="[
              'font-medium',
              item.estado_nuevo ? '' : 'text-muted-foreground'
            ]"
          >
            {{ item.estado_nuevo ? obtenerLabelEstado(item.estado_nuevo) : 'Estado eliminado' }}
          </span>
        </div>
        <p class="text-muted-foreground mt-0.5">
          {{ formatearFecha(item.fecha_cambio) }}
        </p>
      </div>
    </div>
  </div>

  <!-- Variant: Badges -->
  <div v-else-if="variant === 'badges'" class="flex flex-wrap gap-1.5">
    <div 
      v-for="item in historial" 
      :key="item.id"
      class="flex items-center gap-1.5 text-xs"
      :title="`${formatearFecha(item.fecha_cambio)} - ${item.estado_anterior ? obtenerLabelEstado(item.estado_anterior) + ' → ' : ''}${item.estado_nuevo ? obtenerLabelEstado(item.estado_nuevo) : 'Estado eliminado'}`"
    >
      <div 
        :class="[
          'px-2 py-0.5 rounded-md text-xs font-medium',
          item.estado_nuevo ? obtenerColorBadge(item.estado_nuevo) : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        ]"
      >
        {{ item.estado_nuevo ? obtenerLabelEstado(item.estado_nuevo) : 'Eliminado' }}
      </div>
      <span class="text-muted-foreground text-[10px]">
        {{ formatearFecha(item.fecha_cambio) }}
      </span>
    </div>
  </div>

  <!-- Variant: Table -->
  <div v-else-if="variant === 'table'" class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700">
          <th class="text-left py-1.5 px-2 text-muted-foreground font-medium">Fecha</th>
          <th class="text-left py-1.5 px-2 text-muted-foreground font-medium">Cambio</th>
        </tr>
      </thead>
      <tbody>
        <tr 
          v-for="item in historial" 
          :key="item.id"
          class="border-b border-gray-100 dark:border-gray-800 last:border-0"
        >
          <td class="py-1.5 px-2 text-muted-foreground">
            {{ formatearFecha(item.fecha_cambio) }}
          </td>
          <td class="py-1.5 px-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span 
                v-if="item.estado_anterior"
                class="text-muted-foreground line-through"
              >
                {{ obtenerLabelEstado(item.estado_anterior) }}
              </span>
              <ChevronRight 
                v-if="item.estado_anterior && item.estado_nuevo"
                class="h-3 w-3 text-muted-foreground"
              />
              <span 
                :class="[
                  'font-medium',
                  item.estado_nuevo ? '' : 'text-muted-foreground'
                ]"
              >
                {{ item.estado_nuevo ? obtenerLabelEstado(item.estado_nuevo) : 'Estado eliminado' }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
