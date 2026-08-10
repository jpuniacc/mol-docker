<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { ChevronDown, ChevronRight, CloudDownload, RefreshCw, Search } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fmtCell,
  fmtFecha,
  fmtMontoClp,
} from '@/services/fetchTpMnpCaeArancelReferencia'
import { useCaeArancelReferenciaErpStore } from '@/stores/caeArancelReferenciaErp'
import type { TpMnpCaeArancelReferenciaRow } from '@/types/supabase'

const store = useCaeArancelReferenciaErpStore()
const {
  rows,
  loading,
  syncing,
  error: loadError,
  ultimaSync,
  rowsFiltradas,
  total,
  totalFiltrado,
  filtros,
  detalleExpandido,
} = storeToRefs(store)

const COLSPAN_CAE = 14
const COLSPAN_DETALLE = 20

async function cargarDatos() {
  await store.fetchAll()
}

async function actualizarDesdeErp() {
  const result = await store.syncFromErp()
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo actualizar desde ERP')
    return
  }
  toast.success(`Actualización completada: ${result.filasCargadas ?? 0} registros`)
}

function rowKey(row: TpMnpCaeArancelReferenciaRow): string {
  return `${row.cod_carrera}-${row.ano}-${row.periodo}`
}

function arancelClass(row: TpMnpCaeArancelReferenciaRow): string {
  return Number(row.arancel_referencia) > 0
    ? 'text-right font-mono text-xs font-semibold text-emerald-700'
    : 'text-right font-mono text-xs text-zinc-500'
}

onMounted(() => {
  void store.ensureLoaded()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card class="border-zinc-200 shadow-sm">
      <CardHeader class="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle class="text-xl text-zinc-900">Aranceles referencia CAE</CardTitle>
          <CardDescription class="text-zinc-600">
            Configuración de carrera y arancel de referencia CAE en U+ (MT_CARRER_PAA_PSU, solo lectura).
            Registros:
            <span class="font-semibold text-zinc-900">{{ total }}</span>
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
            Recargar
          </Button>
          <Button
            type="button"
            class="gap-1.5 bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="syncing || loading"
            @click="actualizarDesdeErp"
          >
            <CloudDownload class="h-4 w-4" :class="{ 'animate-pulse': syncing }" />
            {{ syncing ? 'Actualizando…' : 'Actualizar desde ERP' }}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <p
          v-if="total === 0 && !loading"
          class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          No hay registros cargados. Use <strong>Actualizar desde ERP</strong> para traer
          <code class="rounded bg-amber-100 px-1">MT_CARRER_PAA_PSU</code> (ANO &gt;= 2026).
        </p>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap items-end gap-3">
          <div class="relative min-w-[120px] flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtros.codCarrera" class="pl-9" placeholder="Código carrera" />
          </div>
          <div class="relative w-[100px]">
            <Input v-model="filtros.ano" placeholder="Año" />
          </div>
          <div class="relative w-[100px]">
            <Input v-model="filtros.periodo" placeholder="Periodo" />
          </div>
          <div class="flex items-center gap-2 pb-2">
            <Checkbox
              id="solo-arancel"
              :checked="filtros.soloConArancel"
              @update:checked="(v: boolean) => store.setFiltro('soloConArancel', v)"
            />
            <Label for="solo-arancel" class="cursor-pointer text-sm text-zinc-700">
              Solo arancel referencia &gt; 0
            </Label>
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">Código carrera</TableHead>
                <TableHead class="whitespace-nowrap">Año</TableHead>
                <TableHead class="whitespace-nowrap">Periodo</TableHead>
                <TableHead class="whitespace-nowrap text-right">Arancel referencia</TableHead>
                <TableHead class="whitespace-nowrap">Postulable</TableHead>
                <TableHead class="whitespace-nowrap">Vacantes</TableHead>
                <TableHead class="whitespace-nowrap">Min. curso</TableHead>
                <TableHead class="whitespace-nowrap">Apr. manual</TableHead>
                <TableHead class="whitespace-nowrap">Visar AA</TableHead>
                <TableHead class="whitespace-nowrap">Plan cuotas</TableHead>
                <TableHead class="whitespace-nowrap">Oculta MNPAN</TableHead>
                <TableHead class="whitespace-nowrap">Examina post.</TableHead>
                <TableHead class="whitespace-nowrap">COD ERP</TableHead>
                <TableHead class="whitespace-nowrap">Synced at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell :colspan="COLSPAN_CAE" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell :colspan="COLSPAN_CAE" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow v-for="row in rowsFiltradas" :key="rowKey(row)">
                <TableCell class="font-mono text-xs">{{ row.cod_carrera }}</TableCell>
                <TableCell>{{ row.ano }}</TableCell>
                <TableCell>{{ row.periodo }}</TableCell>
                <TableCell :class="arancelClass(row)">{{ fmtMontoClp(row.arancel_referencia) }}</TableCell>
                <TableCell>{{ fmtCell(row.postulable) }}</TableCell>
                <TableCell>{{ fmtCell(row.vacantes) }}</TableCell>
                <TableCell>{{ fmtCell(row.min_curso) }}</TableCell>
                <TableCell>{{ fmtCell(row.aprobacion_manual) }}</TableCell>
                <TableCell>{{ fmtCell(row.visar_aa) }}</TableCell>
                <TableCell>{{ fmtCell(row.usa_plan_cuotas) }}</TableCell>
                <TableCell>{{ fmtCell(row.oculta_mnpan) }}</TableCell>
                <TableCell>{{ fmtCell(row.examina_postulantes) }}</TableCell>
                <TableCell class="font-mono text-xs">{{ fmtCell(row.cod_erp) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.synced_at) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div class="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="gap-1.5 text-zinc-600"
            @click="store.toggleDetalleExpandido()"
          >
            <ChevronDown v-if="detalleExpandido" class="h-4 w-4" />
            <ChevronRight v-else class="h-4 w-4" />
            {{ detalleExpandido ? 'Ocultar' : 'Mostrar' }} columnas PAA/PSU y cupos
          </Button>

          <div v-if="detalleExpandido" class="overflow-x-auto rounded-md border border-zinc-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="whitespace-nowrap">Código carrera</TableHead>
                  <TableHead class="whitespace-nowrap">Año</TableHead>
                  <TableHead class="whitespace-nowrap">Periodo</TableHead>
                  <TableHead class="whitespace-nowrap">Postulantes</TableHead>
                  <TableHead class="whitespace-nowrap">Paga inscripción</TableHead>
                  <TableHead class="whitespace-nowrap">Arancel x asig.</TableHead>
                  <TableHead class="whitespace-nowrap">Bloquea vac.</TableHead>
                  <TableHead class="whitespace-nowrap">Cupos reg.</TableHead>
                  <TableHead class="whitespace-nowrap">Cupos esp.</TableHead>
                  <TableHead class="whitespace-nowrap">Sobrecupos</TableHead>
                  <TableHead class="whitespace-nowrap">Corte PAA</TableHead>
                  <TableHead class="whitespace-nowrap">Corte PSU</TableHead>
                  <TableHead class="whitespace-nowrap">PND NOTEM</TableHead>
                  <TableHead class="whitespace-nowrap">PSU prom reg</TableHead>
                  <TableHead class="whitespace-nowrap">PSU reg ranking</TableHead>
                  <TableHead class="whitespace-nowrap">PSU esp ranking</TableHead>
                  <TableHead class="whitespace-nowrap">Supernumerarios</TableHead>
                  <TableHead class="whitespace-nowrap">PND verbal</TableHead>
                  <TableHead class="whitespace-nowrap">PND mat</TableHead>
                  <TableHead class="whitespace-nowrap">PND hist</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="rowsFiltradas.length === 0">
                  <TableCell :colspan="COLSPAN_DETALLE" class="text-center text-zinc-500">
                    Sin registros.
                  </TableCell>
                </TableRow>
                <TableRow v-for="row in rowsFiltradas" :key="`det-${rowKey(row)}`">
                  <TableCell class="font-mono text-xs">{{ row.cod_carrera }}</TableCell>
                  <TableCell>{{ row.ano }}</TableCell>
                  <TableCell>{{ row.periodo }}</TableCell>
                  <TableCell>{{ fmtCell(row.postulantes) }}</TableCell>
                  <TableCell>{{ fmtCell(row.paga_inscripcion) }}</TableCell>
                  <TableCell>{{ fmtCell(row.arancel_x_asignatura) }}</TableCell>
                  <TableCell>{{ fmtCell(row.bloquea_vacantes) }}</TableCell>
                  <TableCell>{{ fmtCell(row.cupos_regulares) }}</TableCell>
                  <TableCell>{{ fmtCell(row.cupos_especiales) }}</TableCell>
                  <TableCell>{{ fmtCell(row.cupos_sobrecupos) }}</TableCell>
                  <TableCell>{{ fmtCell(row.corte_paa) }}</TableCell>
                  <TableCell>{{ fmtCell(row.corte_psu) }}</TableCell>
                  <TableCell>{{ fmtCell(row.pnd_notem) }}</TableCell>
                  <TableCell>{{ fmtCell(row.psu_prom_reg) }}</TableCell>
                  <TableCell>{{ fmtCell(row.psureg_ranking) }}</TableCell>
                  <TableCell>{{ fmtCell(row.psuesp_ranking) }}</TableCell>
                  <TableCell>{{ fmtCell(row.supernumerarios) }}</TableCell>
                  <TableCell>{{ fmtCell(row.pnd_verbal) }}</TableCell>
                  <TableCell>{{ fmtCell(row.pnd_matemat) }}</TableCell>
                  <TableCell>{{ fmtCell(row.pnd_hisgeo) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ totalFiltrado }} de {{ total }} registros (MT_CARRER_PAA_PSU, ANO &gt;= 2026).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
