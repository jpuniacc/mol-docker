<script setup lang="ts">
import { Search, Filter, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { FiltrosPostulante } from '@/types/postulante'

const props = defineProps<{
  filtros: FiltrosPostulante
  carreras?: Array<{ codigo: string; nombre: string | null }>
}>()

const emit = defineEmits<{
  update: [filtros: Partial<FiltrosPostulante>]
  limpiar: []
  buscar: []
}>()

const filtrosLocales = ref({ ...props.filtros })

watch(
  () => props.filtros,
  (newVal) => {
    filtrosLocales.value = { ...newVal }
  },
  { deep: true },
)

function handleUpdate(campo: keyof FiltrosPostulante, valor: string) {
  emit('update', { [campo]: valor })
}

function handleBuscar() {
  emit('buscar')
}

function handleLimpiar() {
  emit('limpiar')
}

const tieneFiltrosActivos = computed(() => {
  return !!(
    filtrosLocales.value.search ||
    filtrosLocales.value.carrera ||
    filtrosLocales.value.estado ||
    filtrosLocales.value.estado_seguimiento ||
    filtrosLocales.value.comuna ||
    filtrosLocales.value.sexo ||
    filtrosLocales.value.ano
  )
})
</script>

<template>
  <Card class="relative overflow-visible z-20">
    <CardContent class="pt-4 pb-4 relative overflow-visible">
      <div class="space-y-3">
        <!-- Búsqueda principal -->
        <div class="flex flex-col gap-2 sm:flex-row">
          <div class="flex-1">
            <div class="relative">
              <Search class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                :model-value="filtrosLocales.search"
                placeholder="Buscar por RUT (Sin puntos, guión ni DV), nombre..."
                class="pl-8 h-9 text-sm"
                @update:model-value="handleUpdate('search', $event as string)"
                @keyup.enter="handleBuscar"
              />
            </div>
          </div>
          <div class="flex gap-2">
            <Button size="sm" @click="handleBuscar" class="flex-1 sm:flex-initial">
              <Search class="mr-1.5 h-3.5 w-3.5" />
              Buscar
            </Button>
            <Button v-if="tieneFiltrosActivos" variant="outline" size="sm" @click="handleLimpiar" class="flex-1 sm:flex-initial">
              <X class="mr-1.5 h-3.5 w-3.5" />
              Limpiar
            </Button>
          </div>
        </div>

        <!-- Filtros adicionales -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div class="relative z-10">
            <label class="mb-1.5 block text-xs font-medium">Carrera</label>
            <select
              :value="filtrosLocales.carrera"
              @change="handleUpdate('carrera', ($event.target as HTMLSelectElement).value)"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer"
            >
              <option value="">Todas</option>
              <option
                v-for="carrera in props.carreras"
                :key="carrera.codigo"
                :value="carrera.codigo"
              >
                {{ carrera.codigo }}{{ carrera.nombre ? ` - ${carrera.nombre}` : '' }}
              </option>
            </select>
          </div>

          <div class="relative z-30" style="isolation: isolate;">
            <label class="mb-1.5 block text-xs font-medium">Estado</label>
            <select
              :value="filtrosLocales.estado"
              @change="handleUpdate('estado', ($event.target as HTMLSelectElement).value)"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer relative z-30"
              style="z-index: 9999; position: relative;"
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente actualización datos U+</option>
              <option value="en_espera">En espera de aprobación de postulación</option>
              <option value="aprobado">Postulación aprobada</option>
              <option value="rechazado">Rechazado (R)</option>
              <option value="matriculado">Matriculado</option>
              <option value="desistido">Desistido</option>
            </select>
          </div>

          <div class="relative z-30" style="isolation: isolate;">
            <label class="mb-1.5 block text-xs font-medium">Estado de Seguimiento</label>
            <select
              :value="filtrosLocales.estado_seguimiento"
              @change="handleUpdate('estado_seguimiento', ($event.target as HTMLSelectElement).value)"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer relative z-30"
              style="z-index: 9999; position: relative;"
            >
              <option value="">Todos</option>
              <option value="no_contesta">No Contesta</option>
              <option value="pendiente_documentacion">Pendiente envío documentación</option>
              <option value="evaluando">Evaluando</option>
              <option value="alumno_vigente">Alumno Vigente</option>
            </select>
          </div>

          <div class="relative z-10">
            <label class="mb-1.5 block text-xs font-medium">Año de Postulación</label>
            <select
              :value="filtrosLocales.ano"
              @change="handleUpdate('ano', ($event.target as HTMLSelectElement).value)"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none cursor-pointer"
            >
              <option value="">Todos</option>
              <option value="2026">2026</option>
            </select>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

