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
} from '@/services/fetchMtBeneficio'
import { useBeneficiosErpStore } from '@/stores/beneficiosErp'

const store = useBeneficiosErpStore()
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

/** 47 columnas ERP + synced_at */
const COLSPAN = 48

async function cargarDatos() {
  await store.fetchAll()
}

async function actualizarDesdeErp() {
  const result = await store.syncFromErp()
  if (!result.ok) {
    toast.error(result.error ?? 'No se pudo actualizar desde ERP')
    return
  }
  toast.success(`Actualización completada: ${result.filasCargadas ?? 0} beneficios`)
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
          <CardTitle class="text-xl text-zinc-900">Beneficios ERP</CardTitle>
          <CardDescription class="text-zinc-600">
            Consulta del catálogo vigente en U+ (solo lectura, Vigencia = Si).
            Sync automático diario a las 04:00; también puede forzar con el botón.
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
          No hay beneficios cargados. Use <strong>Actualizar desde ERP</strong> para traer
          <code class="rounded bg-amber-100 px-1">MT_BENEFICIO</code> (Vigencia = Si).
        </p>

        <p v-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

        <div class="flex flex-wrap gap-3">
          <div class="relative w-[120px]">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input v-model="filtros.codBeneficio" class="pl-9" placeholder="Código" />
          </div>
          <div class="relative min-w-[180px] flex-1">
            <Input v-model="filtros.descripcion" placeholder="Descripción" />
          </div>
          <div class="relative w-[140px]">
            <Input v-model="filtros.tipo" placeholder="Tipo" />
          </div>
          <div class="relative w-[140px]">
            <Input v-model="filtros.origen" placeholder="Origen" />
          </div>
        </div>

        <div class="overflow-x-auto rounded-md border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">codben</TableHead>
                <TableHead class="whitespace-nowrap">descripcion</TableHead>
                <TableHead class="whitespace-nowrap text-right">porcmax</TableHead>
                <TableHead class="whitespace-nowrap text-right">montomax</TableHead>
                <TableHead class="whitespace-nowrap">tipo</TableHead>
                <TableHead class="whitespace-nowrap">aplicable</TableHead>
                <TableHead class="whitespace-nowrap">usuario</TableHead>
                <TableHead class="whitespace-nowrap">fecmod</TableHead>
                <TableHead class="whitespace-nowrap">apliconcepto</TableHead>
                <TableHead class="whitespace-nowrap">automatico</TableHead>
                <TableHead class="whitespace-nowrap">matricula</TableHead>
                <TableHead class="whitespace-nowrap">benpaa</TableHead>
                <TableHead class="whitespace-nowrap">formapago</TableHead>
                <TableHead class="whitespace-nowrap">aplical</TableHead>
                <TableHead class="whitespace-nowrap">ano</TableHead>
                <TableHead class="whitespace-nowrap">exclusivo</TableHead>
                <TableHead class="whitespace-nowrap">prioridad</TableHead>
                <TableHead class="whitespace-nowrap">codsede</TableHead>
                <TableHead class="whitespace-nowrap">tipocarr</TableHead>
                <TableHead class="whitespace-nowrap">variable</TableHead>
                <TableHead class="whitespace-nowrap">benpromo</TableHead>
                <TableHead class="whitespace-nowrap">bencarrera</TableHead>
                <TableHead class="whitespace-nowrap text-right">anos_duracion</TableHead>
                <TableHead class="whitespace-nowrap">categoria</TableHead>
                <TableHead class="whitespace-nowrap">cupos</TableHead>
                <TableHead class="whitespace-nowrap">ano_egreso_desde</TableHead>
                <TableHead class="whitespace-nowrap">ano_egreso_hasta</TableHead>
                <TableHead class="whitespace-nowrap">pagoasociado</TableHead>
                <TableHead class="whitespace-nowrap">origen_beneficio</TableHead>
                <TableHead class="whitespace-nowrap">requisito</TableHead>
                <TableHead class="whitespace-nowrap">fpagogenerada</TableHead>
                <TableHead class="whitespace-nowrap">jornada</TableHead>
                <TableHead class="whitespace-nowrap">clase</TableHead>
                <TableHead class="whitespace-nowrap">vigencia</TableHead>
                <TableHead class="whitespace-nowrap">codigo_mineduc</TableHead>
                <TableHead class="whitespace-nowrap text-right">montocorreccion</TableHead>
                <TableHead class="whitespace-nowrap">omitetopebeneficios</TableHead>
                <TableHead class="whitespace-nowrap">tipoweb</TableHead>
                <TableHead class="whitespace-nowrap">escala</TableHead>
                <TableHead class="whitespace-nowrap">exclusion</TableHead>
                <TableHead class="whitespace-nowrap">personal</TableHead>
                <TableHead class="whitespace-nowrap">ano_beneficio</TableHead>
                <TableHead class="whitespace-nowrap">periodo_beneficio</TableHead>
                <TableHead class="whitespace-nowrap">fecha_inicial</TableHead>
                <TableHead class="whitespace-nowrap">fecha_final</TableHead>
                <TableHead class="whitespace-nowrap text-right">monto_tope</TableHead>
                <TableHead class="whitespace-nowrap">benexcluyente</TableHead>
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
                :key="`${row.cod_beneficio}-${row.fec_mod}-${idx}`"
              >
                <TableCell class="font-mono text-xs">{{ fmtCell(row.cod_beneficio) }}</TableCell>
                <TableCell class="max-w-[280px] truncate text-xs" :title="row.descripcion ?? ''">
                  {{ fmtCell(row.descripcion) }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtPorcentaje(row.porcmax) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.montomax) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtCell(row.tipo) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.aplicable) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.usuario) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fec_mod) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.apliconcepto) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.automatico) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.matricula) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.benpaa) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.formapago) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.aplical) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.ano) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.exclusivo) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.prioridad) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.codsede) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.tipocarr) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.variable) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.benpromo) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.bencarrera) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtCell(row.anos_duracion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.categoria) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.cupos) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.ano_egreso_desde) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.ano_egreso_hasta) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.pagoasociado) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtCell(row.origen_beneficio) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.requisito) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.fpagogenerada) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.jornada) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.clase) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.vigencia) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.codigo_mineduc) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtCell(row.montocorreccion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.omitetopebeneficios) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.tipoweb) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.escala) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.exclusion) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.personal) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.ano_beneficio) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.periodo_beneficio) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fecha_inicial) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.fecha_final) }}</TableCell>
                <TableCell class="text-right font-mono text-xs">{{ fmtMontoClp(row.monto_tope) }}</TableCell>
                <TableCell class="text-xs">{{ fmtCell(row.benexcluyente) }}</TableCell>
                <TableCell class="whitespace-nowrap text-xs">{{ fmtFecha(row.synced_at) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <p class="text-xs text-zinc-500">
          Mostrando {{ totalFiltrado }} de {{ total }} registros (MT_BENEFICIO, Vigencia = Si).
        </p>
      </CardContent>
    </Card>
  </div>
</template>
