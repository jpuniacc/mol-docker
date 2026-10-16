<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listarProgresoRematricula,
  listarTimelineMolAlumno,
  refreshProgresoRematricula,
} from '@/services/progresoRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { EtapaProgresoRematricula, MnpProgresoRematriculaRow, VLogMolSesionTimelineRow } from '@/types/supabase'
import { etiquetaEtapaProgreso, etiquetaActividadLog, lineasDetalleActividad } from '@/utils/etapaProgresoRematricula'

const ETAPAS: EtapaProgresoRematricula[] = [
  'sin_ingreso',
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'firma',
  'matriculado',
]

const periodoActivo = usePeriodoActivoStore()

const loading = ref(false)
const rows = ref<MnpProgresoRematriculaRow[]>([])
const filtroEtapa = ref<string>('todas')
const busqueda = ref('')

const timelineOpen = ref(false)
const timelineLoading = ref(false)
const timelineError = ref(false)
const timelineAlumno = ref<MnpProgresoRematriculaRow | null>(null)
const timelineRows = ref<VLogMolSesionTimelineRow[]>([])

const tienePeriodo = computed(() => {
  return periodoActivo.anio != null && periodoActivo.semestre != null
})

const timelineCronologico = computed(() => [...timelineRows.value].reverse())

function indiceEtapa(etapa: EtapaProgresoRematricula): number {
  const indice = ETAPAS.indexOf(etapa)
  return indice < 0 ? 0 : indice
}

const periodoLabel = computed(() => {
  return periodoActivo.label ?? '—'
})

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—'
  try {
    const date = new Date(fecha)
    return date.toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return fecha
  }
}

async function cargar(refrescar = false) {
  if (!tienePeriodo.value) return

  loading.value = true
  try {
    if (refrescar && periodoActivo.anio != null && periodoActivo.semestre != null) {
      const { error: refreshError } = await refreshProgresoRematricula(
        periodoActivo.anio,
        periodoActivo.semestre,
      )
      if (refreshError) mostrarErrorRematricula(`Error al actualizar progreso: ${refreshError}`)
    }
    const etapa = filtroEtapa.value === 'todas' ? null : (filtroEtapa.value as EtapaProgresoRematricula)
    const q = busqueda.value.trim() || null

    const { data, error } = await listarProgresoRematricula(
      periodoActivo.anio!,
      periodoActivo.semestre!,
      {
        etapa,
        q,
      }
    )

    if (error) {
      mostrarErrorRematricula(`Error al cargar seguimiento: ${error}`)
      rows.value = []
      return
    }

    rows.value = data
  } finally {
    loading.value = false
  }
}

async function abrirTimeline(row: MnpProgresoRematriculaRow) {
  timelineAlumno.value = row
  timelineRows.value = []
  timelineError.value = false
  timelineOpen.value = true
  timelineLoading.value = true

  try {
    const { data, error } = await listarTimelineMolAlumno(
      row.codcli,
      periodoActivo.anio!,
      periodoActivo.semestre!
    )

    if (error) {
      mostrarErrorRematricula(`Error al cargar timeline: ${error}`)
      timelineError.value = true
      return
    }

    timelineRows.value = data
  } finally {
    timelineLoading.value = false
  }
}

function cerrarTimeline() {
  timelineOpen.value = false
  timelineAlumno.value = null
  timelineRows.value = []
  timelineError.value = false
}

watch([filtroEtapa, busqueda], () => {
  void cargar()
})

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) {
    await cargar(true)
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Seguimiento rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoLabel }}. Etapa actual de cada alumno y los pasos que ya registró en MOL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div v-if="!tienePeriodo" class="text-sm text-muted-foreground">
          No hay periodo activo configurado.
          <router-link
            to="/dashboard/mantenedor-periodo-activo"
            class="text-uniacc-celeste underline"
          >
            Ir al mantenedor de periodo
          </router-link>
        </div>
        <div v-else class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <Select v-model="filtroEtapa">
              <SelectTrigger class="w-52">
                <SelectValue placeholder="Filtrar por etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las etapas</SelectItem>
                <SelectItem v-for="etapa in ETAPAS" :key="etapa" :value="etapa">
                  {{ etiquetaEtapaProgreso(etapa) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-model="busqueda"
              class="w-64"
              placeholder="Buscar RUT, nombre o codcli"
            />
            <Button type="button" variant="outline" :disabled="loading" @click="cargar(true)">
              Actualizar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="tienePeriodo">
      <CardContent class="pt-6">
        <div v-if="loading" class="text-center text-sm text-muted-foreground py-8">
          Cargando seguimiento...
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>CODCLI</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Última actividad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in rows" :key="row.codcli">
              <TableCell>{{ row.rut ?? '—' }}</TableCell>
              <TableCell>{{ row.nombre_alumno ?? '—' }}</TableCell>
              <TableCell>{{ row.codcli }}</TableCell>
              <TableCell>{{ row.nombre_carrera ?? '—' }}</TableCell>
              <TableCell>
                <div
                  class="flex items-center gap-1.5"
                  :title="etiquetaEtapaProgreso(row.etapa_actual)"
                >
                  <span class="flex items-center" aria-hidden="true">
                    <span
                      v-for="(etapa, indice) in ETAPAS"
                      :key="etapa"
                      class="h-2 w-2 rounded-full"
                      :class="[
                        indice > 0 ? 'ml-1' : '',
                        indice < indiceEtapa(row.etapa_actual)
                          ? 'bg-uniacc-blue'
                          : indice === indiceEtapa(row.etapa_actual)
                            ? 'bg-uniacc-magenta ring-2 ring-uniacc-magenta/30'
                            : 'bg-muted-foreground/25',
                      ]"
                    />
                  </span>
                  <span class="text-xs text-foreground">
                    {{ etiquetaEtapaProgreso(row.etapa_actual) }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-col gap-1">
                  <span class="text-sm">{{ formatearFecha(row.ultima_actividad_en) }}</span>
                  <span v-if="row.ultima_actividad_label" class="text-xs text-muted-foreground">
                    {{ row.ultima_actividad_label }}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-if="row.excluido_mol" variant="secondary" class="text-xs">
                    Excluido
                  </Badge>
                  <Badge v-if="row.sin_match_mol" variant="secondary" class="text-xs">
                    Sin match
                  </Badge>
                  <Badge v-if="row.es_mock" variant="secondary" class="text-xs">
                    Mock
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  @click="abrirTimeline(row)"
                >
                  Ver timeline
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="rows.length === 0">
              <TableCell colspan="8" class="text-center text-muted-foreground py-8">
                Sin alumnos en seguimiento.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Sheet :open="timelineOpen" @update:open="(v) => { if (!v) cerrarTimeline() }">
      <SheetContent class="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Timeline de actividad</SheetTitle>
          <SheetDescription v-if="timelineAlumno">
            {{ timelineAlumno.nombre_alumno ?? timelineAlumno.codcli }} · 
            {{ timelineAlumno.rut ?? '—' }} · 
            {{ timelineAlumno.nombre_carrera ?? '—' }}
          </SheetDescription>
        </SheetHeader>

        <div class="mt-6 space-y-6">
          <ol
            v-if="timelineAlumno"
            class="flex items-start overflow-x-auto pb-1"
            :aria-label="`Etapa actual: ${etiquetaEtapaProgreso(timelineAlumno.etapa_actual)}`"
          >
            <li
              v-for="(etapa, indice) in ETAPAS"
              :key="etapa"
              class="flex min-w-[4.5rem] flex-1 flex-col items-center"
            >
              <div class="flex w-full items-center">
                <span
                  class="h-0.5 flex-1"
                  :class="indice === 0
                    ? 'bg-transparent'
                    : indice <= indiceEtapa(timelineAlumno.etapa_actual)
                      ? 'bg-uniacc-blue'
                      : 'bg-border'"
                />
                <span
                  class="h-3 w-3 shrink-0 rounded-full border-2"
                  :class="indice < indiceEtapa(timelineAlumno.etapa_actual)
                    ? 'border-uniacc-blue bg-uniacc-blue'
                    : indice === indiceEtapa(timelineAlumno.etapa_actual)
                      ? 'border-uniacc-magenta bg-uniacc-magenta'
                      : 'border-border bg-background'"
                />
                <span
                  class="h-0.5 flex-1"
                  :class="indice === ETAPAS.length - 1
                    ? 'bg-transparent'
                    : indice < indiceEtapa(timelineAlumno.etapa_actual)
                      ? 'bg-uniacc-blue'
                      : 'bg-border'"
                />
              </div>
              <span
                class="mt-2 px-1 text-center text-[10px] leading-tight"
                :class="indice === indiceEtapa(timelineAlumno.etapa_actual)
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'"
              >
                {{ etiquetaEtapaProgreso(etapa) }}
              </span>
            </li>
          </ol>

          <div v-if="timelineLoading" class="text-center text-sm text-muted-foreground py-8">
            Cargando timeline...
          </div>
          <div v-else-if="timelineError" class="text-center text-sm text-destructive py-8">
            Error al cargar el timeline. Intenta nuevamente.
          </div>
          <div v-else-if="timelineRows.length === 0" class="text-center text-sm text-muted-foreground py-8">
            Sin actividad en MOL
          </div>
          <ol v-else class="ml-2 border-l border-border">
            <li
              v-for="(event, indice) in timelineCronologico"
              :key="event.id"
              class="relative pb-6 pl-6 last:pb-0"
            >
              <span
                class="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background"
                :class="indice === timelineCronologico.length - 1
                  ? 'bg-uniacc-magenta'
                  : 'bg-uniacc-blue'"
              />
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-sm font-medium">
                    {{ etiquetaActividadLog(event.categoria, event.accion) }}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    {{ event.creado_en_chile_txt }}
                  </div>
                </div>
                <Badge v-if="event.es_mock" variant="secondary" class="text-xs">
                  Mock
                </Badge>
              </div>
              <dl
                v-if="lineasDetalleActividad(event.payload).length > 0"
                class="mt-2 space-y-0.5 text-xs"
              >
                <div
                  v-for="linea in lineasDetalleActividad(event.payload)"
                  :key="linea.etiqueta"
                  class="flex gap-2"
                >
                  <dt class="shrink-0 text-muted-foreground">{{ linea.etiqueta }}</dt>
                  <dd class="text-foreground">{{ linea.valor }}</dd>
                </div>
              </dl>
            </li>
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
