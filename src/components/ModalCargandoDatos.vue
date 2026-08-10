<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Check } from 'lucide-vue-next'

type EstadoActualizacion = 'pendiente' | 'cargando' | 'completado'

const props = defineProps<{
  open: boolean
  añoAnterior?: number
  añoNuevo?: number
  estadoAlumnos?: EstadoActualizacion
  estadoCursos?: EstadoActualizacion
  estadoVistas?: EstadoActualizacion
}>()

const getIconoEstado = (estado?: EstadoActualizacion) => {
  if (estado === 'completado') {
    return Check
  }
  if (estado === 'cargando') {
    return Loader2
  }
  return null
}

const getClaseEstado = (estado?: EstadoActualizacion) => {
  if (estado === 'completado') {
    return 'text-green-600'
  }
  if (estado === 'cargando') {
    return 'text-red-600 animate-spin'
  }
  return 'text-gray-400'
}
</script>

<template>
  <Dialog :open="open" :modal="true">
    <DialogContent 
      class="sm:max-w-md pointer-events-auto [&>button]:hidden" 
      @pointer-down-outside.prevent
      @escape-key-down.prevent
    >
      <DialogHeader class="sr-only">
        <DialogTitle>Cargando datos del año escolar</DialogTitle>
        <DialogDescription>
          <span v-if="añoAnterior && añoNuevo">
            Actualizando datos del año escolar {{ añoAnterior }} a {{ añoNuevo }}
          </span>
          <span v-else>
            Por favor espera mientras se cargan los datos del año escolar
          </span>
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col items-center justify-center space-y-4 py-6">
        <Loader2 
          v-if="estadoVistas !== 'completado'"
          class="h-12 w-12 animate-spin text-red-600" 
        />
        <Check 
          v-else
          class="h-12 w-12 text-green-600" 
        />
        <div class="text-center space-y-2">
          <h3 class="text-lg font-semibold">Cargando datos del año escolar</h3>
          <p v-if="añoAnterior && añoNuevo" class="text-sm text-muted-foreground">
            Actualizando de {{ añoAnterior }} a {{ añoNuevo }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            Por favor espera mientras se cargan los datos...
          </p>
        </div>
        <div class="w-full max-w-xs space-y-3 pt-2">
          <div class="flex items-center justify-between text-sm">
            <span :class="estadoAlumnos === 'completado' ? 'text-green-600 font-medium' : 'text-muted-foreground'">
              Actualizando alumnos...
            </span>
            <component 
              :is="getIconoEstado(estadoAlumnos)" 
              v-if="getIconoEstado(estadoAlumnos)"
              :class="['h-4 w-4', getClaseEstado(estadoAlumnos)]"
            />
          </div>
          <div class="flex items-center justify-between text-sm">
            <span :class="estadoCursos === 'completado' ? 'text-green-600 font-medium' : 'text-muted-foreground'">
              Actualizando cursos...
            </span>
            <component 
              :is="getIconoEstado(estadoCursos)" 
              v-if="getIconoEstado(estadoCursos)"
              :class="['h-4 w-4', getClaseEstado(estadoCursos)]"
            />
          </div>
          <div class="flex items-center justify-between text-sm">
            <span :class="estadoVistas === 'completado' ? 'text-green-600 font-medium' : 'text-muted-foreground'">
              Sincronizando vistas...
            </span>
            <component 
              :is="getIconoEstado(estadoVistas)" 
              v-if="getIconoEstado(estadoVistas)"
              :class="['h-4 w-4', getClaseEstado(estadoVistas)]"
            />
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

