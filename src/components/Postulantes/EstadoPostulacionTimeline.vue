<script setup lang="ts">
import { computed } from 'vue'
import { Check, Circle, X } from 'lucide-vue-next'
import type { EstadoPostulacion } from '@/types/postulante'
import { formatearFecha } from '@/types/postulante'
import { cn } from '@/composables/utils'
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  estadoActual: EstadoPostulacion | null
  esAlumnoVigente?: boolean
  esDesistido?: boolean
}>()

// Determinar qué pasos mostrar según el estado
const pasosVisibles = computed(() => {
  const estadoEfectivo = props.estadoActual?.ESTADO === 'U' ? null : props.estadoActual?.ESTADO
  
  // Si está desistido, mostrar solo: Pendiente -> Desistido
  if (props.esDesistido) {
    return [
      {
        step: 1,
        title: 'Pendiente actualización datos U+',
        description: '',
        color: 'orange',
        estado: 'completed',
      },
      {
        step: 2,
        title: 'Desistido',
        description: props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
        color: 'gray',
        estado: 'active',
      },
    ]
  }
  
  // Si está rechazado, mostrar solo: Pendiente -> Rechazado
  if (estadoEfectivo === 'R') {
    return [
      {
        step: 1,
        title: 'Pendiente actualización datos U+',
        description: '',
        color: 'orange',
        estado: 'completed',
      },
      {
        step: 2,
        title: 'Rechazado',
        description: props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
        color: 'red',
        estado: 'active',
      },
    ]
  }
  
  // Si es alumno vigente o está en la rama de aprobación
  const pasosAprobacion = [
    {
      step: 1,
      title: 'Pendiente actualización datos U+',
      description: '',
      color: 'orange',
      estado: estadoEfectivo === 'E' || estadoEfectivo === 'A' || estadoEfectivo === 'M' || props.esAlumnoVigente ? 'completed' : estadoEfectivo === null ? 'active' : 'inactive',
    },
    {
      step: 2,
      title: 'En espera de aprobación de postulación',
      description: estadoEfectivo === 'E' && props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
      color: 'yellow',
      estado: estadoEfectivo === 'E' ? 'active' : estadoEfectivo === 'A' || estadoEfectivo === 'M' || props.esAlumnoVigente ? 'completed' : 'inactive',
    },
    {
      step: 3,
      title: 'Postulación aprobada',
      description: estadoEfectivo === 'A' && props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
      color: 'green',
      estado: estadoEfectivo === 'A' ? 'active' : estadoEfectivo === 'M' || props.esAlumnoVigente ? 'completed' : 'inactive',
    },
    {
      step: 4,
      title: 'Matriculado',
      description: estadoEfectivo === 'M' && props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
      color: 'blue',
      estado: estadoEfectivo === 'M' ? 'active' : props.esAlumnoVigente ? 'completed' : 'inactive',
    },
    {
      step: 5,
      title: 'Alumno Vigente',
      description: '',
      color: 'cyan',
      estado: props.esAlumnoVigente ? 'active' : 'inactive',
    },
  ]
  
  // Si no hay estado o es null, solo mostrar el paso inicial
  if (!estadoEfectivo && !props.esAlumnoVigente) {
    return [
      {
        step: 1,
        title: 'Pendiente actualización datos U+',
        description: props.estadoActual?.FECREG ? formatearFecha(props.estadoActual.FECREG) : '',
        color: 'orange',
        estado: 'active',
      },
    ]
  }
  
  return pasosAprobacion
})

const pasoActual = computed(() => {
  const estadoEfectivo = props.estadoActual?.ESTADO === 'U' ? null : props.estadoActual?.ESTADO
  
  // Si está desistido, mostrar paso 2 (Desistido)
  if (props.esDesistido) {
    return 2
  }
  
  if (props.esAlumnoVigente) {
    return 5
  }
  
  if (estadoEfectivo === 'R') {
    return 2
  }
  
  if (estadoEfectivo === 'M') {
    return 4
  }
  
  if (estadoEfectivo === 'A') {
    return 3
  }
  
  if (estadoEfectivo === 'E') {
    return 2
  }
  
  return 1
})
</script>

<template>
  <div class="relative py-3 px-2">
    <Stepper v-model="pasoActual" class="flex w-full items-start gap-2">
      <StepperItem
        v-for="step in pasosVisibles"
        :key="step.step"
        class="relative flex w-full flex-col items-center justify-center"
        :step="step.step"
      >
        <StepperSeparator
          v-if="step.step !== pasosVisibles[pasosVisibles.length - 1]?.step"
          :class="cn(
            'absolute left-[calc(50%+20px)] right-[calc(-50%+10px)] top-5 block h-0.5 shrink-0 rounded-full',
            step.estado === 'completed' ? 'bg-primary' : 'bg-muted'
          )"
        />

        <StepperTrigger as-child>
          <Button
            :variant="step.estado === 'completed' || step.estado === 'active' ? 'default' : 'outline'"
            size="icon"
            :class="cn(
              'z-10 rounded-full shrink-0',
              step.estado === 'active' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
              step.color === 'orange' && step.estado === 'active' && 'bg-orange-500 hover:bg-orange-600',
              step.color === 'yellow' && step.estado === 'active' && 'bg-yellow-500 hover:bg-yellow-600',
              step.color === 'green' && step.estado === 'active' && 'bg-green-500 hover:bg-green-600',
              step.color === 'blue' && step.estado === 'active' && 'bg-blue-600 hover:bg-blue-700',
              step.color === 'cyan' && step.estado === 'active' && 'bg-cyan-600 hover:bg-cyan-700',
              step.color === 'red' && step.estado === 'active' && 'bg-red-500 hover:bg-red-600',
              step.color === 'gray' && step.estado === 'active' && 'bg-gray-500 hover:bg-gray-600',
              step.color === 'orange' && step.estado === 'completed' && 'bg-orange-500 hover:bg-orange-600',
              step.color === 'yellow' && step.estado === 'completed' && 'bg-yellow-500 hover:bg-yellow-600',
              step.color === 'green' && step.estado === 'completed' && 'bg-green-500 hover:bg-green-600',
              step.color === 'blue' && step.estado === 'completed' && 'bg-blue-600 hover:bg-blue-700'
            )"
            :disabled="true"
          >
            <Check v-if="step.estado === 'completed'" class="size-4" />
            <X v-else-if="(step.color === 'red' || step.color === 'gray') && step.estado === 'active'" class="size-4" />
            <Circle v-else-if="step.estado === 'active'" class="size-4" />
            <Circle v-else class="size-4 opacity-50" />
          </Button>
        </StepperTrigger>

        <div class="mt-3 flex flex-col items-center text-center">
          <StepperTitle
            :class="cn(
              'text-xs font-semibold transition',
              step.estado === 'active' && 'text-primary'
            )"
          >
            {{ step.title }}
          </StepperTitle>
          <StepperDescription
            v-if="step.description"
            :class="cn(
              'text-[10px] text-muted-foreground transition mt-0.5',
              step.estado === 'active' && 'text-primary'
            )"
          >
            {{ step.description }}
          </StepperDescription>
        </div>
      </StepperItem>
    </Stepper>
  </div>
</template>

