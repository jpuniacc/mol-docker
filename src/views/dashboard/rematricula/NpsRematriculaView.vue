<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  BarChart3,
  CheckCircle2,
  MessageSquareWarning,
  Percent,
  RefreshCw,
  Star,
  Users,
} from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
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
  return filas.value.map((fila) => fila.calificacion).filter(esCalificacionNps)
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

const etiquetaNota: Record<CalificacionNps, string> = {
  1: 'Muy difícil',
  2: 'Difícil',
  3: 'Regular',
  4: 'Fácil',
  5: 'Muy fácil',
}

function claseBarraNota(nota: CalificacionNps): string {
  switch (nota) {
    case 1:
      return 'bg-rose-500'
    case 2:
      return 'bg-uniacc-orange'
    case 3:
      return 'bg-amber-400'
    case 4:
      return 'bg-uniacc-celeste'
    case 5:
      return 'bg-emerald-500'
  }
}

function claseBadgeNota(nota: number): string {
  if (nota === 1) return 'border-rose-200 bg-rose-50 text-rose-800'
  if (nota === 2) return 'border-orange-200 bg-orange-50 text-uniacc-orange'
  if (nota === 3) return 'border-amber-200 bg-amber-50 text-amber-800'
  return 'border-zinc-200 bg-zinc-50 text-zinc-700'
}

function claseChipNota(nota: CalificacionNps): string {
  switch (nota) {
    case 1:
      return 'border-rose-200 bg-rose-50 text-rose-800'
    case 2:
      return 'border-orange-200 bg-orange-50 text-uniacc-orange'
    case 3:
      return 'border-amber-200 bg-amber-50 text-amber-800'
    case 4:
      return 'border-sky-200 bg-sky-50 text-uniacc-celeste'
    case 5:
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }
}

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

async function cargar(): Promise<void> {
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
    filas.value = []
    totalRespuestas.value = 0
    totalFinalizados.value = 0
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
    <Card class="overflow-hidden border-uniacc-magenta/25 shadow-sm">
      <div
        class="bg-gradient-to-r from-uniacc-blue via-uniacc-celeste to-uniacc-magenta px-6 py-5 text-white"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30"
            >
              <Star class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0 space-y-1">
              <h1 class="text-xl font-semibold tracking-tight md:text-2xl">NPS rematrícula</h1>
              <p class="max-w-2xl text-sm text-white/90">
                Facilidad del proceso (1 = muy difícil · 5 = muy fácil) en el periodo
                <span class="font-semibold text-white">{{ periodoLabel }}</span>.
              </p>
            </div>
          </div>
          <Button
            type="button"
            class="cursor-pointer gap-1.5 border-white/40 bg-white/15 text-white hover:bg-white/25"
            :disabled="loading || !tienePeriodo"
            @click="cargar"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" aria-hidden="true" />
            Recargar
          </Button>
        </div>
      </div>

      <CardContent class="space-y-4 pt-5">
        <div v-if="!tienePeriodo" class="text-sm text-zinc-600">
          No hay periodo activo configurado.
          <router-link
            to="/dashboard/mantenedor-periodo-activo"
            class="cursor-pointer text-uniacc-celeste underline"
          >
            Ir al mantenedor de periodo
          </router-link>
        </div>

        <div
          v-if="error"
          class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {{ error }}
        </div>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card class="overflow-hidden border-uniacc-magenta/30 shadow-sm">
        <div class="h-1.5 bg-uniacc-magenta" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4 space-y-0 pb-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-magenta/10 text-uniacc-magenta"
          >
            <Star class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Promedio</p>
            <p class="text-3xl font-semibold tabular-nums text-zinc-900">{{ promedioTexto }}</p>
            <p class="text-xs text-zinc-500">Escala 1–5</p>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-uniacc-celeste/40 shadow-sm">
        <div class="h-1.5 bg-uniacc-celeste" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4 space-y-0 pb-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-celeste/15 text-uniacc-celeste"
          >
            <Users class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Respuestas</p>
            <p class="text-3xl font-semibold tabular-nums text-zinc-900">{{ totalRespuestas }}</p>
            <p class="text-xs text-zinc-500">Encuestas enviadas</p>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-uniacc-blue/30 shadow-sm">
        <div class="h-1.5 bg-uniacc-blue" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4 space-y-0 pb-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-blue/10 text-uniacc-blue"
          >
            <CheckCircle2 class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Finalizados</p>
            <p class="text-3xl font-semibold tabular-nums text-zinc-900">{{ totalFinalizados }}</p>
            <p class="text-xs text-zinc-500">Firma / matriculado</p>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-uniacc-orange/35 shadow-sm">
        <div class="h-1.5 bg-uniacc-orange" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4 space-y-0 pb-4">
          <div
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-orange/10 text-uniacc-orange"
          >
            <Percent class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Tasa respuesta</p>
            <p class="text-3xl font-semibold tabular-nums text-zinc-900">{{ tasaTexto }}</p>
            <p class="text-xs text-zinc-500">Sobre finalizados</p>
          </div>
        </CardHeader>
      </Card>
    </div>

    <Card v-if="tienePeriodo" class="overflow-hidden border-uniacc-blue/20 shadow-sm">
      <CardHeader class="border-b border-zinc-100 bg-gradient-to-r from-uniacc-blue/[0.04] to-transparent">
        <div class="flex items-center gap-2">
          <BarChart3 class="h-5 w-5 text-uniacc-blue" aria-hidden="true" />
          <CardTitle class="text-lg text-zinc-900">Distribución 1–5</CardTitle>
        </div>
        <CardDescription>
          Cantidad de respuestas por calificación. El color refuerza la etiqueta, no la reemplaza.
        </CardDescription>
      </CardHeader>
      <CardContent class="pt-5">
        <p v-if="loading" class="py-6 text-center text-sm text-zinc-500">Cargando NPS…</p>
        <div v-else class="space-y-4">
          <div
            v-for="nota in notasDistribucion"
            :key="nota"
            class="grid grid-cols-1 items-center gap-2 sm:grid-cols-[7.5rem_1fr_3rem] sm:gap-3"
          >
            <div
              class="inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
              :class="claseChipNota(nota)"
            >
              <span class="tabular-nums">{{ nota }}</span>
              <span>{{ etiquetaNota[nota] }}</span>
            </div>
            <div
              class="h-4 overflow-hidden rounded-full bg-zinc-100 ring-1 ring-zinc-200/80"
              role="img"
              :aria-label="`${etiquetaNota[nota]}: ${distribucion[nota]} respuestas`"
            >
              <div
                class="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300"
                :class="claseBarraNota(nota)"
                :style="{ width: `${(distribucion[nota] / maxDistribucion) * 100}%` }"
              />
            </div>
            <span class="text-right text-sm font-semibold tabular-nums text-zinc-900">
              {{ distribucion[nota] }}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="tienePeriodo" class="overflow-hidden border-rose-200/70 shadow-sm">
      <CardHeader class="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-transparent">
        <div class="flex flex-wrap items-center gap-2">
          <MessageSquareWarning class="h-5 w-5 text-rose-600" aria-hidden="true" />
          <CardTitle class="text-lg text-zinc-900">Comentarios (notas 1–3)</CardTitle>
          <Badge
            variant="outline"
            class="border-rose-200 bg-white text-rose-700"
          >
            {{ comentariosBajos.length }}
          </Badge>
        </div>
        <CardDescription>
          Solo respuestas con calificación baja y comentario escrito.
        </CardDescription>
      </CardHeader>
      <CardContent class="pt-4">
        <p v-if="loading" class="py-8 text-center text-sm text-zinc-500">Cargando comentarios…</p>
        <div
          v-else-if="comentariosBajos.length === 0"
          class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-12 text-center"
        >
          <MessageSquareWarning class="h-8 w-8 text-zinc-300" aria-hidden="true" />
          <p class="text-sm font-medium text-zinc-700">Sin comentarios de notas bajas</p>
          <p class="max-w-md text-sm text-zinc-500">
            Cuando alguien marque 1–3 y deje un comentario, aparecerá aquí para seguimiento.
          </p>
        </div>
        <div v-else class="overflow-x-auto rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow class="bg-zinc-50/80 hover:bg-zinc-50/80">
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
              <TableRow
                v-for="fila in comentariosBajos"
                :key="fila.id"
                class="hover:bg-rose-50/40"
              >
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
                <TableCell class="align-top">
                  <Badge
                    variant="outline"
                    class="tabular-nums"
                    :class="claseBadgeNota(fila.calificacion)"
                  >
                    {{ fila.calificacion }}
                    <span class="sr-only">
                      {{
                        esCalificacionNps(fila.calificacion)
                          ? etiquetaNota[fila.calificacion]
                          : ''
                      }}
                    </span>
                  </Badge>
                </TableCell>
                <TableCell class="max-w-md align-top whitespace-pre-wrap text-sm text-zinc-800">
                  {{ fila.comentario }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
