<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { CloudDownload, Eye, RefreshCw, Search } from 'lucide-vue-next'

import PlanPagosAlumnoDetalleDialog from '@/components/rematricula/PlanPagosAlumnoDetalleDialog.vue'
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
import { syncAlumnosPeriodoFromErp } from '@/services/alumnosPeriodoSyncApi'
import { fetchPlanPagosMv } from '@/services/fetchPlanPagosMv'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { PlanPagosMvRow } from '@/types/supabase'

const periodoStore = usePeriodoActivoStore()
const { label: periodoActivoLabel, anio, semestre } = storeToRefs(periodoStore)

const rows = ref<PlanPagosMvRow[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const syncing = ref(false)

const filtroRut = ref('')
const filtroNombre = ref('')
const filtroCodcli = ref('')

const detalleOpen = ref(false)
const detalleRow = ref<PlanPagosMvRow | null>(null)

function verDetalle(row: PlanPagosMvRow) {
  detalleRow.value = row
  detalleOpen.value = true
}

const ultimaSync = computed(() => {
  const ts = rows.value[0]?.synced_at
  if (!ts) return null
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts))
  } catch {
    return ts
  }
})

const periodoDatosLabel = computed(() => {
  const p = rows.value[0]?.periodo_rematricula ?? rows.value[0]?.periodo
  return p ?? null
})

const datosDesactualizados = computed(() => {
  const activo = periodoActivoLabel.value
  if (!activo) return false
  if (rows.value.length === 0) return true
  const enDatos = periodoDatosLabel.value
  return enDatos != null && enDatos !== activo
})

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

const rowsFiltradas = computed(() => {
  const qRut = filtroRut.value.trim()
  const qNombre = filtroNombre.value.trim().toLowerCase()
  const qCodcli = filtroCodcli.value.trim().toLowerCase()

  return rows.value.filter((r) => {
    if (qRut && !rutNorm(r.rut).includes(rutNorm(qRut))) return false
    if (qNombre && !nombreCompleto(r).toLowerCase().includes(qNombre)) return false
    if (qCodcli && !(r.codcli ?? '').toLowerCase().includes(qCodcli)) return false
    return true
  })
})

async function cargarDatos() {
  loading.value = true
  loadError.value = null
  try {
    const anioVal = anio.value ?? undefined
    const semVal = semestre.value ?? undefined
    const { data, error } = await fetchPlanPagosMv({
      anioMatricula: anioVal,
      periodoMatricula: semVal,
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

async function sincronizarDesdeErp() {
  syncing.value = true
  try {
    const result = await syncAlumnosPeriodoFromErp()
    if (!result.ok) {
      toast.error(result.error ?? 'No se pudo sincronizar desde ERP')
      return
    }
    toast.success(
      `Sync completada: ${result.filasCargadas ?? 0} alumnos (${result.periodo ?? periodoActivoLabel.value ?? '—'})`,
    )
    await cargarDatos()
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  void cargarDatos()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Alumnos a matricular</CardTitle>
          <CardDescription class="text-zinc-600">
            Periodo activo:
            <span class="font-semibold text-zinc-900">{{ periodoActivoLabel ?? '—' }}</span>
            · Registros cargados:
            <span class="font-semibold text-zinc-900">{{ rows.length }}</span>
            <span v-if="ultimaSync"> · Última sync: {{ ultimaSync }}</span>
          </CardDescription>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            class="gap-1.5"
            :disabled="loading || syncing"
            @click="cargarDatos"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            Actualizar
          </Button>
          <Button
            type="button"
            class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="syncing || loading"
            @click="sincronizarDesdeErp"
          >
            <CloudDownload class="h-4 w-4" :class="{ 'animate-pulse': syncing }" />
            {{ syncing ? 'Sincronizando…' : 'Sincronizar desde ERP' }}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <p
          v-if="datosDesactualizados"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Los datos en Supabase no corresponden al periodo activo
          <strong>{{ periodoActivoLabel }}</strong>
          <span v-if="periodoDatosLabel"> (actualmente: {{ periodoDatosLabel }})</span>.
          Ejecute <strong>Sincronizar desde ERP</strong> para cargar la vista
          <code class="rounded bg-amber-100 px-1">VW_ALUMNOS_PARA_MAT_{{ periodoActivoLabel?.replace('-', '_') }}</code>.
        </p>

        <p
          v-else-if="rows.length === 0 && !loading"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          No hay alumnos cargados para el periodo activo. Use
          <strong>Sincronizar desde ERP</strong> para ejecutar el extract contra U+.
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
                <TableHead>Últ. matrícula</TableHead>
                <TableHead>Últ. situación</TableHead>
                <TableHead>CAE</TableHead>
                <TableHead>Beneficios</TableHead>
                <TableHead class="w-[80px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell colspan="11" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell colspan="11" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in rowsFiltradas" :key="`${row.codcli}-${row.cod_carrera}`">
                <TableCell class="font-mono text-xs">{{ row.codcli ?? '—' }}</TableCell>
                <TableCell>{{ row.rut ?? '—' }}</TableCell>
                <TableCell>{{ nombreCompleto(row) || '—' }}</TableCell>
                <TableCell class="max-w-[200px] truncate" :title="row.carrera ?? undefined">
                  {{ row.carrera ?? '—' }}
                </TableCell>
                <TableCell>{{ periodoIngresoLabel(row) }}</TableCell>
                <TableCell>{{ row.categoria_alumno ?? '—' }}</TableCell>
                <TableCell>{{ row.ult_matricula ?? '—' }}</TableCell>
                <TableCell>{{ row.ultima_situacion ?? '—' }}</TableCell>
                <TableCell>
                  <Badge :variant="row.alumno_cae === 'Si' ? 'default' : 'secondary'">
                    {{ row.alumno_cae ?? '—' }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge :variant="row.tiene_beneficio === 'Si' ? 'default' : 'secondary'">
                    {{ row.tiene_beneficio ?? '—' }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="gap-1"
                    @click="verDetalle(row)"
                  >
                    <Eye class="h-4 w-4" />
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ rowsFiltradas.length }} de {{ rows.length }} registros.
        </p>
      </CardContent>
    </Card>

    <PlanPagosAlumnoDetalleDialog
      v-model:open="detalleOpen"
      :row="detalleRow"
      @update:open="(v) => { if (!v) detalleRow = null }"
    />
  </div>
</template>
