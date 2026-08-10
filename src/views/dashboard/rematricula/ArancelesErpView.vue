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
import { fmtFecha, fmtMontoClp } from '@/services/fetchMtArancel'
import { useArancelesErpStore } from '@/stores/arancelesErp'

const store = useArancelesErpStore()
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
} = storeToRefs(store)

const COLSPAN = 21

async function cargarDatos() {
  await store.fetchAll()
}

async function actualizarDesdeErp() {
  const result = await store.syncFromErp()
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo actualizar desde ERP')
    return
  }
  toast.success(`Actualización completada: ${result.filasCargadas ?? 0} aranceles`)
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
          <CardTitle class="text-xl text-zinc-900">Aranceles ERP</CardTitle>
          <CardDescription class="text-zinc-600">
            Consulta de aranceles vigentes en U+ (solo lectura).
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
          No hay aranceles cargados. Use <strong>Actualizar desde ERP</strong> para traer
          <code class="rounded bg-amber-100 px-1">MT_ARANCEL</code> (ANO &gt;= 2026).
        </p>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap gap-3">
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
          <div class="relative w-[100px]">
            <Input v-model="filtros.categoria" placeholder="Cat." />
          </div>
          <div class="relative w-[100px]">
            <Input v-model="filtros.jornada" placeholder="Jornada" />
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">Código carrera</TableHead>
                <TableHead class="whitespace-nowrap">Año</TableHead>
                <TableHead class="whitespace-nowrap">Año inicio</TableHead>
                <TableHead class="whitespace-nowrap">Año fin</TableHead>
                <TableHead class="whitespace-nowrap text-right">Monto arancel</TableHead>
                <TableHead class="whitespace-nowrap text-right">Monto matrícula</TableHead>
                <TableHead class="whitespace-nowrap">Periodo</TableHead>
                <TableHead class="whitespace-nowrap">Categoría alumno</TableHead>
                <TableHead class="whitespace-nowrap">Combo</TableHead>
                <TableHead class="whitespace-nowrap">Jornada</TableHead>
                <TableHead class="whitespace-nowrap">Documentos</TableHead>
                <TableHead class="whitespace-nowrap">Cuotas</TableHead>
                <TableHead class="whitespace-nowrap">Moneda</TableHead>
                <TableHead class="whitespace-nowrap">Periodo ingreso</TableHead>
                <TableHead class="whitespace-nowrap">Periodo final</TableHead>
                <TableHead class="whitespace-nowrap">Arancel renov.</TableHead>
                <TableHead class="whitespace-nowrap">Matrícula renov.</TableHead>
                <TableHead class="whitespace-nowrap">Fec. modificación</TableHead>
                <TableHead class="whitespace-nowrap">Vigencia desde</TableHead>
                <TableHead class="whitespace-nowrap">Vigencia hasta</TableHead>
                <TableHead class="whitespace-nowrap">Synced at</TableHead>
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
                :key="`${row.cod_carrera}-${row.ano}-${row.anio_ini}-${row.anio_fin}-${row.periodo}-${row.categoria_alumno}-${row.fec_mod}-${idx}`"
              >
                <TableCell class="font-mono text-xs">{{ row.cod_carrera ?? '—' }}</TableCell>
                <TableCell>{{ row.ano ?? '—' }}</TableCell>
                <TableCell>{{ row.anio_ini ?? '—' }}</TableCell>
                <TableCell>{{ row.anio_fin ?? '—' }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.matricula) }}</TableCell>
                <TableCell>{{ row.periodo ?? '—' }}</TableCell>
                <TableCell>{{ row.categoria_alumno ?? '—' }}</TableCell>
                <TableCell>{{ row.combo ?? '—' }}</TableCell>
                <TableCell>{{ row.jornada ?? '—' }}</TableCell>
                <TableCell>{{ row.documentos ?? '—' }}</TableCell>
                <TableCell>{{ row.cuotas ?? '—' }}</TableCell>
                <TableCell>{{ row.moneda ?? '—' }}</TableCell>
                <TableCell>{{ row.periodo_ingreso ?? '—' }}</TableCell>
                <TableCell>{{ row.periodo_final ?? '—' }}</TableCell>
                <TableCell>{{ row.arancel_renov ?? '—' }}</TableCell>
                <TableCell>{{ row.matricula_renov ?? '—' }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_mod) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_ini_vig) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_ter_vig) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.synced_at) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ totalFiltrado }} de {{ total }} registros (MT_ARANCEL, ANO &gt;= 2026).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
