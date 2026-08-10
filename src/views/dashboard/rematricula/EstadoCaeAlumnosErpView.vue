<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { CloudDownload, RefreshCw, Search } from 'lucide-vue-next'

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
  fmtCell,
  fmtFecha,
  fmtMontoClp,
  fmtPorcentaje,
} from '@/services/fetchMnpEstadoCaeAlumnos'
import { useEstadoCaeAlumnosErpStore } from '@/stores/estadoCaeAlumnosErp'

const store = useEstadoCaeAlumnosErpStore()
const {
  rows,
  loading,
  syncing,
  error: loadError,
  ultimaSync,
  periodoLabel,
  rowsFiltradas,
  total,
  totalFiltrado,
  filtros,
} = storeToRefs(store)

const COLSPAN = 34

async function cargarDatos() {
  await store.fetchAll()
}

async function actualizarDesdeErp() {
  const result = await store.syncFromErp()
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo actualizar desde ERP')
    return
  }
  const periodo = result.periodo ? ` (${result.periodo})` : ''
  toast.success(`Actualización completada: ${result.filasCargadas ?? 0} registros${periodo}`)
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
          <CardTitle class="text-xl text-zinc-900">Estado CAE alumnos</CardTitle>
          <CardDescription class="text-zinc-600">
            Resoluciones y beneficios asignados en U+ para el periodo activo
            <span v-if="periodoLabel" class="font-semibold text-zinc-900"> ({{ periodoLabel }})</span>.
            Sync automático semanal (lunes 04:00); también puede forzar con el botón.
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
          No hay datos cargados para el periodo activo. Use
          <strong>Actualizar desde ERP</strong> para traer
          <code class="rounded bg-amber-100 px-1">MT_POSBEN</code>.
        </p>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap gap-3">
          <div class="relative w-[140px]">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtros.codcli" class="pl-9" placeholder="CODCLI" />
          </div>
          <div class="relative w-[120px]">
            <Input v-model="filtros.codBeneficio" placeholder="Cód. beneficio" />
          </div>
          <div class="relative min-w-[160px] flex-1">
            <Input v-model="filtros.descripcion" placeholder="Descripción beneficio" />
          </div>
          <div class="relative min-w-[140px] flex-1">
            <Input v-model="filtros.nombreEstado" placeholder="Estado beneficio" />
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">codben_cargado</TableHead>
                <TableHead class="whitespace-nowrap">orden</TableHead>
                <TableHead class="whitespace-nowrap">codcli</TableHead>
                <TableHead class="whitespace-nowrap">carrera</TableHead>
                <TableHead class="whitespace-nowrap">año</TableHead>
                <TableHead class="whitespace-nowrap">periodo</TableHead>
                <TableHead class="whitespace-nowrap text-right">porcentaje solicitado</TableHead>
                <TableHead class="whitespace-nowrap text-right">porc_aprobado</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto_solicitado</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto_aprobado</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto</TableHead>
                <TableHead class="whitespace-nowrap">aprobado</TableHead>
                <TableHead class="whitespace-nowrap">aplicable</TableHead>
                <TableHead class="whitespace-nowrap">fecha modificación</TableHead>
                <TableHead class="whitespace-nowrap">fecha aprobación</TableHead>
                <TableHead class="whitespace-nowrap">fecha asignación</TableHead>
                <TableHead class="whitespace-nowrap text-right">total_sol</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto_interes</TableHead>
                <TableHead class="whitespace-nowrap text-right">porcentaje_interes</TableHead>
                <TableHead class="whitespace-nowrap">fecanulacion</TableHead>
                <TableHead class="whitespace-nowrap">estado</TableHead>
                <TableHead class="whitespace-nowrap text-right">porc_par</TableHead>
                <TableHead class="whitespace-nowrap">num_operacion</TableHead>
                <TableHead class="whitespace-nowrap">tipo asignacion</TableHead>
                <TableHead class="whitespace-nowrap">confima monto</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto cae aprobado</TableHead>
                <TableHead class="whitespace-nowrap text-right">porcentaje original</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto original</TableHead>
                <TableHead class="whitespace-nowrap">codben beneficio</TableHead>
                <TableHead class="whitespace-nowrap">descripcion</TableHead>
                <TableHead class="whitespace-nowrap">nombre estado beneficio</TableHead>
                <TableHead class="whitespace-nowrap">anio matricula</TableHead>
                <TableHead class="whitespace-nowrap">periodo matricula</TableHead>
                <TableHead class="whitespace-nowrap">synced_at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading && rows.length === 0">
                <TableCell :colspan="COLSPAN" class="text-center text-zinc-500">Cargando…</TableCell>
              </TableRow>
              <TableRow v-else-if="rowsFiltradas.length === 0">
                <TableCell :colspan="COLSPAN" class="text-center text-zinc-500">
                  Sin registros para mostrar.
                </TableCell>
              </TableRow>
              <TableRow
                v-for="(row, idx) in rowsFiltradas"
                :key="`${row.codcli}-${row.cod_beneficio_cargado}-${row.orden}-${row.fec_mod}-${idx}`"
              >
                <TableCell class="font-mono text-xs">{{ fmtCell(row.cod_beneficio_cargado) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.orden) }}</TableCell>
                <TableCell class="font-mono text-xs">{{ fmtCell(row.codcli) }}</TableCell>
                <TableCell class="font-mono text-xs">{{ fmtCell(row.cod_carrera) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.ano) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.periodo) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porc_sol) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porc_apr) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_sol) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_apr) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.aprobado) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.aplicable) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_mod) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_aprob) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_asig) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.total_sol) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_int) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porc_int) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_anulacion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.estado) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porc_par) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.num_operacion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.tipo_asignacion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.confirma_monto) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_cae_aprobado) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porc_original) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_original) }}</TableCell>
                <TableCell class="font-mono text-xs">{{ fmtCell(row.cod_beneficio) }}</TableCell>
                <TableCell class="max-w-[220px] truncate text-xs" :title="row.descripcion ?? ''">
                  {{ fmtCell(row.descripcion) }}
                </TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtCell(row.nombre_estado_beneficio) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.anio_matricula) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.periodo_matricula) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.synced_at) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ totalFiltrado }} de {{ total }} registros (MT_POSBEN, periodo activo).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
