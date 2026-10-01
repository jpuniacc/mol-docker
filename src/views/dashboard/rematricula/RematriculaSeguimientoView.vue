<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

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
import { etiquetaEtapaProgreso, etiquetaActividadLog } from '@/utils/etapaProgresoRematricula'

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
      if (refreshError) toast.error(`Error al actualizar progreso: ${refreshError}`)
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
      toast.error(`Error al cargar seguimiento: ${error}`)
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
      toast.error(`Error al cargar timeline: ${error}`)
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
                <Badge variant="outline">{{ etiquetaEtapaProgreso(row.etapa_actual) }}</Badge>
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

        <div class="mt-6">
          <div v-if="timelineLoading" class="text-center text-sm text-muted-foreground py-8">
            Cargando timeline...
          </div>
          <div v-else-if="timelineError" class="text-center text-sm text-destructive py-8">
            Error al cargar el timeline. Intenta nuevamente.
          </div>
          <div v-else-if="timelineRows.length === 0" class="text-center text-sm text-muted-foreground py-8">
            Sin actividad en MOL
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="event in timelineRows"
              :key="event.id"
              class="rounded-lg border p-4 space-y-2"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="font-medium text-sm">
                    {{ etiquetaActividadLog(event.categoria, event.accion) }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1">
                    {{ event.creado_en_chile_txt }}
                  </div>
                </div>
                <Badge v-if="event.es_mock" variant="secondary" class="text-xs ml-2">
                  Mock
                </Badge>
              </div>
              <div v-if="event.payload && Object.keys(event.payload).length > 0" class="text-xs text-muted-foreground">
                <details>
                  <summary class="cursor-pointer hover:text-foreground">Ver detalles</summary>
                  <pre class="mt-2 rounded bg-muted p-2 text-xs overflow-x-auto">{{ JSON.stringify(event.payload, null, 2) }}</pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
