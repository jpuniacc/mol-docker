<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ChevronLeft, ChevronRight, LoaderCircle, Play, RefreshCw, Search } from 'lucide-vue-next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  filaFueraCarteraOficial,
  MSG_FUERA_CARTERA_OFICIAL,
  TITULO_FUERA_CARTERA_OFICIAL,
} from '@/constants/carteraOficial'
import { detectarConveniosAlumno } from '@/services/convenioAlumno'
import { useConvenioInstitucionalStore } from '@/stores/convenioInstitucional'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { usePlanPagosMvStore } from '@/stores/planPagosMv'
import type { PlanPagosMvRow } from '@/types/supabase'

const router = useRouter()
const mockCtx = useMockMatriculaContextStore()
const periodoStore = usePeriodoActivoStore()
const convenioStore = useConvenioInstitucionalStore()
const planPagos = usePlanPagosMvStore()
const { label: periodoActivoLabel, anio, semestre } = storeToRefs(periodoStore)
const { rows, loading, error: loadError, estaCargandoPrimeraVez } = storeToRefs(planPagos)

const selectingCodcli = ref<string | null>(null)

const filtroRut = ref('')
const filtroNombre = ref('')
const filtroCodcli = ref('')
const soloConConvenio = ref(false)
const soloFueraCartera = ref(false)
const bloqueoFueraCarteraOpen = ref(false)

function rutNorm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/\./g, '').replace(/-/g, '')
}

function nombreCompleto(r: PlanPagosMvRow): string {
  return [r.nombre_alumno, r.apellido_paterno_alumno, r.apellido_materno_alumno]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .join(' ')
}

function periodoIngresoLabel(r: PlanPagosMvRow): string {
  if (r.ano_ingreso != null && r.periodo_ingreso != null) {
    return `${r.ano_ingreso}-${r.periodo_ingreso}`
  }
  return '—'
}

function conveniosVigentesDeAlumno(r: PlanPagosMvRow) {
  return detectarConveniosAlumno(r, convenioStore.rows).filter((m) => m.esVigente)
}

function tieneConvenioVigente(r: PlanPagosMvRow): boolean {
  return conveniosVigentesDeAlumno(r).length > 0
}

function convenioVigenteLabel(r: PlanPagosMvRow): string {
  const nombres = conveniosVigentesDeAlumno(r).map((m) => m.convenio.institucion)
  return nombres.length > 0 ? nombres.join(', ') : ''
}

const rowsFiltradas = computed(() => {
  const qRut = filtroRut.value.trim()
  const qNombre = filtroNombre.value.trim().toLowerCase()
  const qCodcli = filtroCodcli.value.trim().toLowerCase()

  return rows.value.filter((r) => {
    if (qRut && !rutNorm(r.rut).includes(rutNorm(qRut))) return false
    if (qNombre && !nombreCompleto(r).toLowerCase().includes(qNombre)) return false
    if (qCodcli && !(r.codcli ?? '').toLowerCase().includes(qCodcli)) return false
    if (soloConConvenio.value && !tieneConvenioVigente(r)) return false
    if (soloFueraCartera.value && !filaFueraCarteraOficial(r)) return false
    return true
  })
})

const {
  page,
  totalPages,
  pageItems: rowsPagina,
  rangoDesde,
  rangoHasta,
  resetPage,
  irAPaginaAnterior,
  irAPaginaSiguiente,
} = useTablaPaginada(rowsFiltradas)

watch([filtroRut, filtroNombre, filtroCodcli, soloConConvenio, soloFueraCartera], resetPage)

const totalConConvenio = computed(() => rows.value.filter((r) => tieneConvenioVigente(r)).length)
const totalFueraCartera = computed(() => rows.value.filter((r) => filaFueraCarteraOficial(r)).length)

async function cargarDatos(force = false) {
  if (force) {
    await planPagos.fetchAll(anio.value, semestre.value)
    return
  }
  await planPagos.ensureLoaded(anio.value, semestre.value)
}

async function probarFlujo(row: PlanPagosMvRow) {
  if (filaFueraCarteraOficial(row)) {
    bloqueoFueraCarteraOpen.value = true
    return
  }
  const key = `${row.codcli}-${row.cod_carrera}`
  selectingCodcli.value = key
  try {
    await mockCtx.setAlumno(row)
    await router.push({ name: 'matricula-mock-datos' })
  } finally {
    selectingCodcli.value = null
  }
}

onMounted(() => {
  void (async () => {
    await periodoStore.ensureLoaded()
    await Promise.all([cargarDatos(), convenioStore.ensureLoaded()])
  })()
})
</script>

<template>
  <div class="space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle class="text-xl text-zinc-900">Seleccionar alumno de prueba</CardTitle>
        <CardDescription class="text-zinc-600">
          Elija un alumno del periodo activo
          <span class="font-semibold text-zinc-900">{{ periodoActivoLabel ?? '—' }}</span>
          para simular el flujo de rematrícula. Cada fila corresponde a un
          <code class="rounded bg-zinc-100 px-1">codcli</code> (carrera/modalidad).
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert
          v-if="loading"
          class="border-amber-300 bg-amber-50 text-amber-950"
        >
          <LoaderCircle class="h-4 w-4 animate-spin" />
          <AlertTitle>Cargando alumnos del periodo</AlertTitle>
          <AlertDescription>
            Consultando
            <span class="font-semibold">{{ periodoActivoLabel ?? 'el periodo activo' }}</span>
            en el consolidado. La tabla muestra 20 filas; el buscador recorre todos los registros.
          </AlertDescription>
        </Alert>

        <p
          v-if="rows.length === 0 && !loading"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          No hay alumnos cargados para el periodo activo. Sincronice desde
          <RouterLink
            :to="{ name: 'dashboard-mantenedor-alumnos-matricular' }"
            class="font-semibold underline"
          >
            Mantenedores → Alumnos a matricular
          </RouterLink>.
        </p>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap gap-3">
          <div class="relative min-w-[140px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtroRut" class="pl-9" placeholder="Filtrar RUT" :disabled="estaCargandoPrimeraVez" />
          </div>
          <div class="relative min-w-[140px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtroNombre" class="pl-9" placeholder="Filtrar nombre" :disabled="estaCargandoPrimeraVez" />
          </div>
          <div class="relative min-w-[140px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtroCodcli" class="pl-9" placeholder="Filtrar codcli" :disabled="estaCargandoPrimeraVez" />
          </div>
          <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="cargarDatos(true)">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </Button>
        </div>

        <div class="flex flex-wrap gap-4">
          <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input v-model="soloConConvenio" type="checkbox" class="h-4 w-4 accent-amber-500" />
            Solo con convenio vigente
            <Badge class="bg-amber-500 hover:bg-amber-500/90">{{ totalConConvenio }}</Badge>
          </label>
          <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input v-model="soloFueraCartera" type="checkbox" class="h-4 w-4 accent-red-600" />
            Solo fuera de cartera
            <Badge class="bg-red-600 hover:bg-red-600/90">{{ totalFueraCartera }}</Badge>
          </label>
        </div>

        <div class="rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>codcli</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Carrera</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Cat.</TableHead>
                <TableHead>Beneficios</TableHead>
                <TableHead>Convenio</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead class="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="estaCargandoPrimeraVez">
                <TableCell colspan="10" class="py-10 text-center text-zinc-500">
                  <LoaderCircle class="mx-auto mb-2 h-6 w-6 animate-spin text-uniacc-orange" />
                  Cargando alumnos…
                </TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell colspan="10" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow
                v-for="row in rowsPagina"
                :key="`${row.codcli}-${row.cod_carrera}`"
                :class="{ 'bg-amber-50 hover:bg-amber-100': tieneConvenioVigente(row) }"
              >
                <TableCell class="font-mono text-xs">{{ row.codcli ?? '—' }}</TableCell>
                <TableCell>
                  <div class="flex flex-col gap-1">
                    <span>{{ row.rut ?? '—' }}</span>
                    <Badge
                      v-if="filaFueraCarteraOficial(row)"
                      class="w-fit bg-red-600 hover:bg-red-600/90"
                    >
                      Fuera de cartera
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>{{ nombreCompleto(row) || '—' }}</TableCell>
                <TableCell class="max-w-[200px] truncate" :title="row.carrera ?? undefined">
                  {{ row.carrera ?? '—' }}
                </TableCell>
                <TableCell>{{ periodoIngresoLabel(row) }}</TableCell>
                <TableCell>{{ row.categoria_alumno ?? '—' }}</TableCell>
                <TableCell>
                  <Badge :variant="row.tiene_beneficio === 'Si' ? 'default' : 'secondary'">
                    {{ row.tiene_beneficio ?? 'No' }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    v-if="tieneConvenioVigente(row)"
                    class="bg-amber-500 hover:bg-amber-500/90"
                    :title="convenioVigenteLabel(row)"
                  >
                    Convenio vigente
                  </Badge>
                  <span v-else class="text-zinc-400">—</span>
                </TableCell>
                <TableCell>
                  <Badge :variant="row.alumno_cae === 'Si' ? 'default' : 'secondary'">
                    {{ row.alumno_cae ?? '—' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    type="button"
                    size="sm"
                    class="gap-1 bg-uniacc-orange hover:bg-uniacc-orange/90"
                    :disabled="selectingCodcli === `${row.codcli}-${row.cod_carrera}`"
                    @click="probarFlujo(row)"
                  >
                    <Play class="h-4 w-4" />
                    Probar flujo
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div
          v-if="rowsFiltradas.length > 0"
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 px-4 py-3"
        >
          <p class="text-xs text-zinc-600">
            Mostrando
            <span class="font-semibold text-zinc-900">{{ rangoDesde }}</span>
            –
            <span class="font-semibold text-zinc-900">{{ rangoHasta }}</span>
            de
            <span class="font-semibold text-zinc-900">{{ rowsFiltradas.length }}</span>
            filtrados
            <span class="text-zinc-500">
              ({{ rows.length }} en total, {{ totalConConvenio }} con convenio,
              {{ totalFueraCartera }} fuera de cartera)
            </span>
          </p>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              :disabled="page === 1"
              @click="irAPaginaAnterior"
            >
              <ChevronLeft class="mr-1 h-4 w-4" />
              Anterior
            </Button>
            <div class="rounded-md border bg-background px-3 py-1.5 text-sm">
              <span class="font-semibold">{{ page }}</span>
              <span class="text-muted-foreground"> / {{ totalPages }}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              :disabled="page >= totalPages"
              @click="irAPaginaSiguiente"
            >
              Siguiente
              <ChevronRight class="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="bloqueoFueraCarteraOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ TITULO_FUERA_CARTERA_OFICIAL }}</DialogTitle>
          <DialogDescription>{{ MSG_FUERA_CARTERA_OFICIAL }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="bloqueoFueraCarteraOpen = false"
          >
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
