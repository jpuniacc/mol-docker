<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listarNpsRematriculaAdmin,
  type NpsRematriculaAdminFila,
} from '@/services/npsRematriculaAdminApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  distribucionNps,
  esCalificacionNps,
  promedioNps,
  tasaRespuestaNps,
  type CalificacionNps,
} from '@/utils/npsRematricula'

const periodoActivo = usePeriodoActivoStore()

const filas = ref<NpsRematriculaAdminFila[]>([])
const totalRespuestas = ref(0)
const totalFinalizados = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)

const tienePeriodo = computed(() => {
  return periodoActivo.anio != null && periodoActivo.semestre != null
})

const periodoLabel = computed(() => periodoActivo.label ?? '—')

const calificaciones = computed((): CalificacionNps[] => {
  return filas.value
    .map((fila) => fila.calificacion)
    .filter(esCalificacionNps)
})

const promedio = computed(() => promedioNps(calificaciones.value))

const promedioTexto = computed(() => {
  if (promedio.value == null) return '—'
  return promedio.value.toFixed(1)
})

const distribucion = computed(() => distribucionNps(calificaciones.value))

const tasa = computed(() => tasaRespuestaNps(totalRespuestas.value, totalFinalizados.value))

const tasaTexto = computed(() => {
  if (tasa.value == null) return '—'
  return `${(tasa.value * 100).toFixed(1)}%`
})

const maxDistribucion = computed(() => {
  const vals = Object.values(distribucion.value)
  return Math.max(1, ...vals)
})

const comentariosBajos = computed(() => {
  return filas.value.filter((fila) => {
    if (!esCalificacionNps(fila.calificacion) || fila.calificacion > 3) return false
    const texto = fila.comentario?.trim() ?? ''
    return texto.length > 0
  })
})

const notasDistribucion: CalificacionNps[] = [1, 2, 3, 4, 5]

function formatearFecha(fecha: string): string {
  const date = new Date(fecha)
  if (Number.isNaN(date.getTime())) return fecha
  return date.toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function cargar() {
  if (!tienePeriodo.value) {
    error.value = 'No hay periodo activo configurado'
    filas.value = []
    totalRespuestas.value = 0
    totalFinalizados.value = 0
    return
  }
  loading.value = true
  error.value = null
  const res = await listarNpsRematriculaAdmin(periodoActivo.anio!, periodoActivo.semestre!)
  loading.value = false
  if (!res.ok) {
    error.value = res.error
    return
  }
  filas.value = res.filas
  totalRespuestas.value = res.totalRespuestas
  totalFinalizados.value = res.totalFinalizados
}

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  await cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div class="space-y-1">
          <CardTitle class="text-xl text-zinc-900">NPS rematrícula</CardTitle>
          <CardDescription class="max-w-3xl text-zinc-600">
            Facilidad del proceso (1–5) en el periodo {{ periodoLabel }}. Promedio, distribución,
            tasa de respuesta sobre finalizados (firma/matriculado) y comentarios de notas bajas.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          class="cursor-pointer gap-1.5"
          :disabled="loading || !tienePeriodo"
          @click="cargar"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
          Recargar
        </Button>
      </CardHeader>
      <CardContent class="space-y-4">
        <div v-if="!tienePeriodo" class="text-sm text-zinc-500">
          No hay periodo activo configurado.
          <router-link
            to="/dashboard/mantenedor-periodo-activo"
            class="text-uniacc-celeste underline"
          >
            Ir al mantenedor de periodo
          </router-link>
        </div>

        <p v-if="error" class="text-sm text-red-700">{{ error }}</p>

        <div v-if="tienePeriodo" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Promedio</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{{ promedioTexto }}</p>
          </div>
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Respuestas</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{{ totalRespuestas }}</p>
          </div>
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Finalizados</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{{ totalFinalizados }}</p>
          </div>
          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Tasa respuesta</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{{ tasaTexto }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="tienePeriodo" class="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle class="text-lg text-zinc-900">Distribución 1–5</CardTitle>
        <CardDescription>Cantidad de respuestas por calificación.</CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="loading" class="py-4 text-center text-sm text-zinc-500">Cargando NPS…</p>
        <div v-else class="space-y-3">
          <div
            v-for="nota in notasDistribucion"
            :key="nota"
            class="grid grid-cols-[2.5rem_1fr_3rem] items-center gap-3"
          >
            <span class="text-sm font-medium tabular-nums text-zinc-700">{{ nota }}</span>
            <div class="h-3 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
              <div
                class="h-full rounded-full bg-uniacc-celeste transition-[width] duration-200"
                :style="{ width: `${(distribucion[nota] / maxDistribucion) * 100}%` }"
              />
            </div>
            <span class="text-right text-sm tabular-nums text-zinc-800">{{ distribucion[nota] }}</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="tienePeriodo" class="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle class="text-lg text-zinc-900">Comentarios (notas 1–3)</CardTitle>
        <CardDescription>
          Solo respuestas con calificación baja y comentario escrito.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="loading" class="py-8 text-center text-sm text-zinc-500">Cargando comentarios…</p>
        <div v-else class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Codcli</TableHead>
                <TableHead>Carrera</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Comentario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="fila in comentariosBajos" :key="fila.id">
                <TableCell class="whitespace-nowrap align-top text-sm text-zinc-700">
                  {{ formatearFecha(fila.creadoEn) }}
                </TableCell>
                <TableCell class="align-top font-mono text-xs text-zinc-700">
                  {{ fila.rut ?? '—' }}
                </TableCell>
                <TableCell class="align-top font-mono text-xs text-zinc-700">
                  {{ fila.codcli || '—' }}
                </TableCell>
                <TableCell class="align-top font-mono text-xs text-zinc-700">
                  {{ fila.codigoCarrera || '—' }}
                </TableCell>
                <TableCell class="align-top text-sm text-zinc-700">
                  {{ fila.jornada || '—' }}
                </TableCell>
                <TableCell class="align-top text-sm font-medium tabular-nums text-zinc-900">
                  {{ fila.calificacion }}
                </TableCell>
                <TableCell class="max-w-md align-top whitespace-pre-wrap text-sm text-zinc-800">
                  {{ fila.comentario }}
                </TableCell>
              </TableRow>
              <TableRow v-if="comentariosBajos.length === 0">
                <TableCell colspan="7" class="py-8 text-center text-sm text-zinc-500">
                  No hay comentarios de notas 1–3 en este periodo.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
