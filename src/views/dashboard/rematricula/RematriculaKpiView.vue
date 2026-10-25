<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, GraduationCap, Layers, Users } from 'lucide-vue-next'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  fetchKpiProgresoRematricula,
  listarProgresoRematricula,
  listarTimelineMolAlumno,
  refreshProgresoRematricula,
} from '@/services/progresoRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type {
  EtapaProgresoRematricula,
  KpiDosCarrerasDetalle,
  KpiProgresoRematricula,
  MnpProgresoRematriculaRow,
  VLogMolSesionTimelineRow,
} from '@/types/supabase'
import {
  etiquetaActividadLog,
  etiquetaEtapaProgreso,
  etiquetaPermanenciaEtapa,
  lineasDetalleActividad,
  permanenciaEtapa,
} from '@/utils/etapaProgresoRematricula'
import {
  bucketEsperaFormaPago,
  coincideFiltroEspera,
  etiquetaBucketEsperaFormaPago,
  etiquetaFiltroEsperaFormaPago,
  type BucketEsperaFormaPago,
  type FiltroEsperaFormaPago,
} from '@/utils/esperaFormaPagoKpi'

const FILTROS_ESPERA: FiltroEsperaFormaPago[] = ['todos', 'cae', 'ministerial', 'ambos', 'resto']

const ORDEN_BUCKETS_ESPERA: BucketEsperaFormaPago[] = ['cae', 'ministerial', 'ambos', 'resto']

const KPI_KEY_BUCKET: Record<BucketEsperaFormaPago, keyof KpiProgresoRematricula> = {
  cae: 'forma_pago_espera_cae',
  ministerial: 'forma_pago_espera_ministerial',
  ambos: 'forma_pago_espera_ambos',
  resto: 'forma_pago_resto',
}

const ORDEN_EMBUDO_ASC: EtapaProgresoRematricula[] = [
  'sin_ingreso',
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'firma',
  'matriculado',
]

const periodoActivo = usePeriodoActivoStore()

const FILAS_POR_PAGINA = 40

const loading = ref(false)
const refreshing = ref(false)
const kpi = ref<KpiProgresoRematricula | null>(null)
const etapaAbierta = ref<EtapaProgresoRematricula | null>(null)
const alumnosPorEtapa = ref<Partial<Record<EtapaProgresoRematricula, MnpProgresoRematriculaRow[]>>>({})
const cargandoEtapa = ref<EtapaProgresoRematricula | null>(null)
const errorEtapa = ref<string | null>(null)
const busquedaEtapa = ref('')
const filtroEspera = ref<FiltroEsperaFormaPago>('todos')
const filtroBucketExacto = ref<BucketEsperaFormaPago | null>(null)
const filasVisibles = ref(FILAS_POR_PAGINA)
const timelineOpen = ref(false)
const timelineLoading = ref(false)
const timelineError = ref(false)
const timelineAlumno = ref<MnpProgresoRematriculaRow | null>(null)
const timelineRows = ref<VLogMolSesionTimelineRow[]>([])

const timelineCronologico = computed(() => [...timelineRows.value].reverse())

function marcaPermanencia(fila: MnpProgresoRematriculaRow) {
  return permanenciaEtapa(fila.etapa_actual, fila.etapa_desde)
}

function indiceEtapa(etapa: EtapaProgresoRematricula): number {
  const indice = ORDEN_EMBUDO_ASC.indexOf(etapa)
  return indice < 0 ? 0 : indice
}

const tienePeriodo = computed(() => {
  return periodoActivo.anio != null && periodoActivo.semestre != null
})

const periodoLabel = computed(() => {
  return periodoActivo.label ?? '—'
})

function formatearRut(rut: string): string {
  const limpio = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase()
  const match = limpio.match(/^(\d+)-?([0-9K])$/)
  if (!match) return rut
  const cuerpo = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${match[2]}`
}

const rutDosCarreras = computed(() => {
  const raw = kpi.value?.rut_dos_carreras
  if (!raw) return ''
  return raw.split(',').map(parte => formatearRut(parte.trim())).join(', ')
})

const carrerasDobles = computed((): KpiDosCarrerasDetalle[] => {
  const raw = kpi.value?.detalle_dos_carreras
  if (!Array.isArray(raw)) return []
  return raw.filter(item => Boolean(item?.codcli))
})

const alumnosFiltrados = computed(() => {
  const etapa = etapaAbierta.value
  if (!etapa) return []
  const filas = alumnosPorEtapa.value[etapa] ?? []
  const q = busquedaEtapa.value.trim().toLowerCase()
  const porTexto = !q
    ? filas
    : filas.filter(fila => {
        const rut = formatearRut(fila.rut ?? '').toLowerCase()
        const texto = [fila.rut, rut, fila.nombre_alumno, fila.codcli, fila.nombre_carrera]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return texto.includes(q)
      })
  if (etapa !== 'forma_pago') return porTexto
  const exacto = filtroBucketExacto.value
  return porTexto.filter(fila => {
    const bucket = bucketEsperaFormaPago(fila.espera_cae, fila.espera_ministerial)
    return exacto ? bucket === exacto : coincideFiltroEspera(bucket, filtroEspera.value)
  })
})

const desgloseFormaPago = computed(() => {
  if (!kpi.value) return []
  const datos = kpi.value
  return ORDEN_BUCKETS_ESPERA.map(bucket => ({
    bucket,
    label: etiquetaBucketEsperaFormaPago(bucket),
    count: Number(datos[KPI_KEY_BUCKET[bucket]] ?? 0),
  }))
})

const alumnosVisibles = computed(() => alumnosFiltrados.value.slice(0, filasVisibles.value))

const embudoEtapas = computed(() => {
  if (!kpi.value) return []

  return ORDEN_EMBUDO_ASC.map(etapa => ({
    etapa,
    label: etiquetaEtapaProgreso(etapa),
    count: kpi.value![etapa] ?? 0,
  }))
})

async function abrirDetalle(fila: MnpProgresoRematriculaRow) {
  if (!tienePeriodo.value) return
  timelineAlumno.value = fila
  timelineRows.value = []
  timelineError.value = false
  timelineOpen.value = true
  timelineLoading.value = true
  try {
    const { data, error } = await listarTimelineMolAlumno(
      fila.codcli,
      periodoActivo.anio!,
      periodoActivo.semestre!,
    )
    if (error) {
      mostrarErrorRematricula(`Error al cargar el detalle: ${error}`)
      timelineError.value = true
      return
    }
    timelineRows.value = data
  } finally {
    timelineLoading.value = false
  }
}

function cerrarDetalle() {
  timelineOpen.value = false
  timelineAlumno.value = null
  timelineRows.value = []
  timelineError.value = false
}

async function cargarEtapa(etapa: EtapaProgresoRematricula) {
  if (!tienePeriodo.value) return
  cargandoEtapa.value = etapa
  errorEtapa.value = null
  const { data, error } = await listarProgresoRematricula(
    periodoActivo.anio!,
    periodoActivo.semestre!,
    { etapa },
  )
  cargandoEtapa.value = null
  if (error) {
    errorEtapa.value = error
    mostrarErrorRematricula(`Error al cargar alumnos: ${error}`)
    return
  }
  // Sin ingreso incluye excluido_mol (SUBDERE / fuera MOL) para cuadrar con la cartera.
  // En el resto de etapas se ocultan excluidos y sin match.
  alumnosPorEtapa.value = {
    ...alumnosPorEtapa.value,
    [etapa]:
      etapa === 'sin_ingreso'
        ? data.filter(fila => !fila.sin_match_mol)
        : data.filter(fila => !fila.excluido_mol && !fila.sin_match_mol),
  }
}

async function toggleEtapa(etapa: EtapaProgresoRematricula) {
  if (etapaAbierta.value === etapa) {
    etapaAbierta.value = null
    return
  }
  etapaAbierta.value = etapa
  busquedaEtapa.value = ''
  filtroEspera.value = 'todos'
  filtroBucketExacto.value = null
  filasVisibles.value = FILAS_POR_PAGINA
  if (!alumnosPorEtapa.value[etapa]) {
    await cargarEtapa(etapa)
  }
}

function seleccionarFiltroEspera(filtro: FiltroEsperaFormaPago) {
  filtroBucketExacto.value = null
  filtroEspera.value = filtro
  filasVisibles.value = FILAS_POR_PAGINA
}

async function abrirFormaPagoConFiltro(bucket: BucketEsperaFormaPago) {
  seleccionarFiltroEspera(bucket)
  // Modo exacto: el listado coincide con el conteo exclusivo del desglose.
  filtroBucketExacto.value = bucket
  if (etapaAbierta.value === 'forma_pago') return
  etapaAbierta.value = 'forma_pago'
  busquedaEtapa.value = ''
  if (!alumnosPorEtapa.value.forma_pago) {
    await cargarEtapa('forma_pago')
  }
}

async function cargarKpi() {
  if (!tienePeriodo.value) return
  
  loading.value = true
  try {
    const { data, error } = await fetchKpiProgresoRematricula(
      periodoActivo.anio!,
      periodoActivo.semestre!
    )
    if (error) {
      mostrarErrorRematricula(`Error al cargar KPI: ${error}`)
      return
    }
    kpi.value = data
  } finally {
    loading.value = false
  }
}

async function actualizarProgreso() {
  if (!tienePeriodo.value) return
  
  refreshing.value = true
  try {
    const { error } = await refreshProgresoRematricula(
      periodoActivo.anio!,
      periodoActivo.semestre!
    )
    if (error) {
      mostrarErrorRematricula(`Error al actualizar progreso: ${error}`)
      return
    }
    
    alumnosPorEtapa.value = {}
    const etapa = etapaAbierta.value
    await cargarKpi()
    if (etapa) await cargarEtapa(etapa)
  } finally {
    refreshing.value = false
  }
}

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) {
    await actualizarProgreso()
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>KPI Rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoLabel }}. Vista general del progreso de rematrícula.
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
          <Button 
            type="button" 
            :disabled="loading || refreshing" 
            @click="actualizarProgreso"
          >
            {{ refreshing ? 'Actualizando...' : 'Actualizar progreso' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && kpi" class="grid gap-6 md:grid-cols-3">
      <Card class="overflow-hidden border-uniacc-blue/30">
        <div class="h-1.5 bg-uniacc-blue" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-blue/10 text-uniacc-blue">
            <Users class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <CardTitle class="text-3xl tabular-nums text-zinc-900">{{ kpi.total_cartera ?? 0 }}</CardTitle>
            <CardDescription>Cantidad de alumnos en cartera</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-emerald-600/30">
        <div class="h-1.5 bg-emerald-600" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <GraduationCap class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <CardTitle class="text-3xl tabular-nums text-zinc-900">{{ kpi.matriculado ?? 0 }}</CardTitle>
            <CardDescription>Cantidad de alumnos matriculados</CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-uniacc-magenta/30">
        <div class="h-1.5 bg-uniacc-magenta" aria-hidden="true" />
        <CardHeader class="flex-row items-center gap-4">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-uniacc-magenta/10 text-uniacc-magenta">
            <Layers class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <CardTitle class="text-2xl tabular-nums text-zinc-900">{{ rutDosCarreras || 'Ninguno' }}</CardTitle>
            <CardDescription>Dos carreras vigentes</CardDescription>
          </div>
        </CardHeader>
        <CardContent v-if="carrerasDobles.length" class="space-y-3 text-sm">
          <div v-for="carrera in carrerasDobles" :key="carrera.codcli">
            <p class="font-medium text-foreground">{{ carrera.nombre_carrera }}</p>
            <p class="text-muted-foreground">{{ carrera.codcli }}</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card v-if="tienePeriodo && kpi && embudoEtapas.length > 0">
      <CardHeader>
        <CardTitle>Embudo de etapas</CardTitle>
        <CardDescription>
          Abre una etapa para ver los alumnos que están en ella.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="space-y-3">
          <div
            v-for="item in embudoEtapas"
            :key="item.etapa"
            class="rounded-lg border"
          >
            <button
              type="button"
              class="flex w-full cursor-pointer items-center justify-between p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :aria-expanded="etapaAbierta === item.etapa"
              @click="toggleEtapa(item.etapa)"
            >
              <span class="flex items-center gap-3">
                <ChevronRight
                  class="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform"
                  :class="etapaAbierta === item.etapa ? 'rotate-90' : ''"
                  aria-hidden="true"
                />
                <Badge variant="outline">{{ item.label }}</Badge>
              </span>
              <span class="text-lg font-semibold">{{ item.count }}</span>
            </button>
            <div
              v-if="item.etapa === 'forma_pago' && desgloseFormaPago.length"
              class="space-y-1 border-t px-3 py-2"
            >
              <button
                v-for="linea in desgloseFormaPago"
                :key="linea.bucket"
                type="button"
                class="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click.stop="abrirFormaPagoConFiltro(linea.bucket)"
              >
                <span class="pl-7">{{ linea.label }}</span>
                <span class="tabular-nums font-medium text-foreground">{{ linea.count }}</span>
              </button>
            </div>
            <div v-if="etapaAbierta === item.etapa" class="space-y-3 border-t px-3 py-3">
              <p v-if="cargandoEtapa === item.etapa" class="text-sm text-muted-foreground">
                Cargando alumnos...
              </p>
              <p v-else-if="errorEtapa" class="text-sm text-destructive">
                No se pudo cargar el detalle.
              </p>
              <template v-else>
                <Input
                  v-model="busquedaEtapa"
                  type="search"
                  placeholder="Buscar por RUT, nombre, código o carrera"
                  :aria-label="`Buscar alumnos en ${item.label}`"
                  @click.stop
                />
                <div v-if="item.etapa === 'forma_pago'" class="flex flex-wrap gap-2">
                  <Button
                    v-for="f in FILTROS_ESPERA"
                    :key="f"
                    type="button"
                    size="sm"
                    :variant="filtroEspera === f ? 'default' : 'outline'"
                    class="cursor-pointer"
                    :aria-pressed="filtroEspera === f"
                    @click="seleccionarFiltroEspera(f)"
                  >
                    {{ etiquetaFiltroEsperaFormaPago(f) }}
                  </Button>
                </div>
                <p v-if="alumnosFiltrados.length === 0" class="text-sm text-muted-foreground">
                  No hay alumnos en esta etapa.
                </p>
                <div v-else class="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>RUT</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Carrera</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow
                        v-for="fila in alumnosVisibles"
                        :key="fila.codcli"
                        :class="marcaPermanencia(fila).marcada ? 'bg-destructive/10 hover:bg-destructive/15' : ''"
                      >
                        <TableCell>{{ formatearRut(fila.rut ?? '') || '—' }}</TableCell>
                        <TableCell>
                          <div class="flex flex-wrap items-center gap-2">
                            <span>{{ fila.nombre_alumno || '—' }}</span>
                            <Badge
                              v-if="marcaPermanencia(fila).marcada"
                              variant="destructive"
                            >
                              {{ etiquetaPermanenciaEtapa(marcaPermanencia(fila).horas ?? 0) }}
                            </Badge>
                            <Badge v-if="fila.excluido_mol" variant="secondary">Fuera MOL</Badge>
                            <Badge v-if="fila.espera_cae" variant="outline">CAE</Badge>
                            <Badge v-if="fila.espera_ministerial" variant="outline">Ministerial</Badge>
                          </div>
                        </TableCell>
                        <TableCell>{{ fila.nombre_carrera || '—' }}</TableCell>
                        <TableCell>{{ fila.codcli }}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            @click="abrirDetalle(fila)"
                          >
                            Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div
                    v-if="alumnosFiltrados.length > alumnosVisibles.length"
                    class="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span>{{ alumnosVisibles.length }} de {{ alumnosFiltrados.length }}</span>
                    <Button type="button" variant="outline" @click="filasVisibles += FILAS_POR_PAGINA">
                      Ver más
                    </Button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <div v-if="loading && !kpi" class="text-center text-sm text-muted-foreground">
      Cargando KPI...
    </div>

    <Sheet :open="timelineOpen" @update:open="(abierto) => { if (!abierto) cerrarDetalle() }">
      <SheetContent class="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Detalle del alumno</SheetTitle>
          <SheetDescription v-if="timelineAlumno">
            {{ timelineAlumno.nombre_alumno ?? timelineAlumno.codcli }} ·
            {{ formatearRut(timelineAlumno.rut ?? '') || '—' }} ·
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
              v-for="(etapa, indice) in ORDEN_EMBUDO_ASC"
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
                  :class="indice === ORDEN_EMBUDO_ASC.length - 1
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

          <div v-if="timelineLoading" class="py-8 text-center text-sm text-muted-foreground">
            Cargando detalle...
          </div>
          <div v-else-if="timelineError" class="py-8 text-center text-sm text-destructive">
            No se pudo cargar el detalle.
          </div>
          <div v-else-if="timelineRows.length === 0" class="py-8 text-center text-sm text-muted-foreground">
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
