<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Play, RefreshCw, Search } from 'lucide-vue-next'

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
import { detectarConveniosAlumno } from '@/services/convenioAlumno'
import { fetchPlanPagosMv } from '@/services/fetchPlanPagosMv'
import { useConvenioInstitucionalStore } from '@/stores/convenioInstitucional'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { PlanPagosMvRow } from '@/types/supabase'

const router = useRouter()
const mockCtx = useMockMatriculaContextStore()
const periodoStore = usePeriodoActivoStore()
const convenioStore = useConvenioInstitucionalStore()
const { label: periodoActivoLabel, anio, semestre } = storeToRefs(periodoStore)

const rows = ref<PlanPagosMvRow[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const selectingCodcli = ref<string | null>(null)

const filtroRut = ref('')
const filtroNombre = ref('')
const filtroCodcli = ref('')
const soloConConvenio = ref(false)

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
    return true
  })
})

const totalConConvenio = computed(() => rows.value.filter((r) => tieneConvenioVigente(r)).length)

async function cargarDatos() {
  loading.value = true
  loadError.value = null
  try {
    const { data, error } = await fetchPlanPagosMv({
      anioMatricula: anio.value ?? undefined,
      periodoMatricula: semestre.value ?? undefined,
    })
    if (error) {
      loadError.value = error
      rows.value = []
      return
    }
    rows.value = data
  } finally {
    loading.value = false
  }
}

async function probarFlujo(row: PlanPagosMvRow) {
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
  void Promise.all([cargarDatos(), convenioStore.ensureLoaded()])
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
            <Input v-model="filtroRut" class="pl-9" placeholder="Filtrar RUT" />
          </div>
          <div class="relative min-w-[140px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtroNombre" class="pl-9" placeholder="Filtrar nombre" />
          </div>
          <div class="relative min-w-[140px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtroCodcli" class="pl-9" placeholder="Filtrar codcli" />
          </div>
          <Button type="button" variant="outline" class="gap-1.5" :disabled="loading" @click="cargarDatos">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </Button>
        </div>

        <label class="flex w-fit cursor-pointer items-center gap-2 text-sm text-zinc-700">
          <input v-model="soloConConvenio" type="checkbox" class="h-4 w-4 accent-amber-500" />
          Solo con convenio vigente
          <Badge class="bg-amber-500 hover:bg-amber-500/90">{{ totalConConvenio }}</Badge>
        </label>

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
              <TableRow v-if="loading && rows.length === 0">
                <TableCell colspan="10" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell colspan="10" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow
                v-for="row in rowsFiltradas"
                :key="`${row.codcli}-${row.cod_carrera}`"
                :class="{ 'bg-amber-50 hover:bg-amber-100': tieneConvenioVigente(row) }"
              >
                <TableCell class="font-mono text-xs">{{ row.codcli ?? '—' }}</TableCell>
                <TableCell>{{ row.rut ?? '—' }}</TableCell>
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

        <p class="text-xs text-zinc-500">
          Mostrando {{ rowsFiltradas.length }} de {{ rows.length }} registros
          ({{ totalConConvenio }} con convenio vigente).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
