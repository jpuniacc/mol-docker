<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Download } from 'lucide-vue-next'
import * as XLSX from 'xlsx'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { useTablaPaginada } from '@/composables/useTablaPaginada'
import { listarGestionPagos } from '@/services/gestionPagosApi'
import {
  filasGestionPagosACsv,
  filasGestionPagosAMatriz,
  type FilaGestionPagos,
} from '@/utils/gestionPagos'

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

const PAGE_SIZE = 10

const periodoActivo = usePeriodoActivoStore()
const rows = ref<FilaGestionPagos[]>([])
const loading = ref(false)
const busqueda = ref('')

const tienePeriodo = computed(
  () => periodoActivo.anio != null && periodoActivo.semestre != null,
)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

const filasVisibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    return (
      row.rut.toLowerCase().includes(q) ||
      row.nombre.toLowerCase().includes(q) ||
      row.codcli.toLowerCase().includes(q)
    )
  })
})

const {
  page,
  totalPages,
  pageItems: filasPagina,
  rangoDesde,
  rangoHasta,
  resetPage,
  irAPaginaAnterior,
  irAPaginaSiguiente,
} = useTablaPaginada(filasVisibles, PAGE_SIZE)

watch(busqueda, resetPage)

function formatoFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

function celda(v: string): string {
  return v.trim() ? v : '—'
}

async function cargar(): Promise<void> {
  if (!tienePeriodo.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const res = await listarGestionPagos(periodoActivo.anio!, periodoActivo.semestre!)
    if (res.error) {
      mostrarErrorRematricula(res.error)
      rows.value = []
      return
    }
    rows.value = res.data
    resetPage()
  } finally {
    loading.value = false
  }
}

function nombreArchivo(): string {
  return `gestion-pagos-${periodoActivo.anio}-${periodoActivo.semestre}`
}

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function exportarCsv(): void {
  descargar(
    new Blob(['\ufeff' + filasGestionPagosACsv(filasVisibles.value)], {
      type: 'text/csv;charset=utf-8',
    }),
    `${nombreArchivo()}.csv`,
  )
}

function exportarExcel(): void {
  const ws = XLSX.utils.aoa_to_sheet(filasGestionPagosAMatriz(filasVisibles.value))
  ws['!cols'] = [14, 32, 12, 28, 14, 28, 20].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Gestión Pagos')
  XLSX.writeFile(wb, `${nombreArchivo()}.xlsx`)
}

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  await cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Gestión Pagos</CardTitle>
        <CardDescription>
          Alumnos con matrícula Webpay autorizada en
          <span class="font-medium text-foreground">{{ periodoLabel }}</span>
          que aún no cerraron arancel (Webpay autorizada o contrato enviado a TuFirma).
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-wrap gap-3">
          <Input
            v-model="busqueda"
            class="w-64"
            placeholder="Buscar RUT, nombre o codcli"
          />
          <Button type="button" variant="outline" :disabled="loading || !tienePeriodo" @click="cargar">
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            :disabled="filasVisibles.length === 0"
            @click="exportarCsv"
          >
            <Download class="mr-1.5 h-4 w-4" />
            CSV
          </Button>
          <Button
            type="button"
            size="default"
            :disabled="filasVisibles.length === 0"
            @click="exportarExcel"
          >
            <Download class="mr-1.5 h-4 w-4" />
            Excel
          </Button>
        </div>
        <p v-if="!tienePeriodo" class="text-sm text-muted-foreground">
          No hay periodo académico activo configurado.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="space-y-4 pt-6">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RUT</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Codcli</TableHead>
                <TableHead>Carrera</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Fecha pago matrícula</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in filasPagina" :key="row.codcli">
                <TableCell>{{ celda(row.rut) }}</TableCell>
                <TableCell>{{ celda(row.nombre) }}</TableCell>
                <TableCell>{{ row.codcli }}</TableCell>
                <TableCell>{{ celda(row.carrera) }}</TableCell>
                <TableCell>{{ celda(row.telefono) }}</TableCell>
                <TableCell>{{ celda(row.email) }}</TableCell>
                <TableCell class="whitespace-nowrap text-sm">
                  {{ formatoFecha(row.fechaPagoMatricula) }}
                </TableCell>
              </TableRow>
              <TableRow v-if="!loading && filasVisibles.length === 0">
                <TableCell colspan="7" class="text-muted-foreground">
                  Sin alumnos pendientes de arancel.
                </TableCell>
              </TableRow>
              <TableRow v-if="loading">
                <TableCell colspan="7" class="text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div
          v-if="filasVisibles.length > 0"
          class="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p class="text-xs text-muted-foreground">
            Mostrando
            <span class="font-semibold text-foreground">{{ rangoDesde }}</span>
            –
            <span class="font-semibold text-foreground">{{ rangoHasta }}</span>
            de
            <span class="font-semibold text-foreground">{{ filasVisibles.length }}</span>
          </p>
          <div class="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="page <= 1"
              @click="irAPaginaAnterior"
            >
              <ChevronLeft class="h-4 w-4" />
              Anterior
            </Button>
            <span class="text-xs text-muted-foreground">{{ page }} / {{ totalPages }}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="page >= totalPages"
              @click="irAPaginaSiguiente"
            >
              Siguiente
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
