<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Download, GraduationCap, Wallet } from 'lucide-vue-next'

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
  fetchKpiReportePagosRematricula,
  listarReportePagosRematricula,
} from '@/services/reportesPagosRematriculaApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import {
  filasReportePagosACsv,
  type FilaReportePagosRematricula,
  type KpiReportePagosRematricula,
} from '@/utils/reportePagosRematricula'

type FiltroCanal = 'todos' | 'MOL' | 'BO'

const periodoActivo = usePeriodoActivoStore()
const loading = ref(false)
const kpi = ref<KpiReportePagosRematricula | null>(null)
const filas = ref<FilaReportePagosRematricula[]>([])
const canal = ref<FiltroCanal>('todos')
const busqueda = ref('')

const tienePeriodo = computed(
  () => periodoActivo.anio != null && periodoActivo.semestre != null,
)
const periodoLabel = computed(() => periodoActivo.label ?? '—')

function fmtMoney(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' })
}

function canalRpc(): string | null {
  return canal.value === 'todos' ? null : canal.value
}

async function cargar() {
  if (!tienePeriodo.value) return
  loading.value = true
  try {
    const anio = periodoActivo.anio!
    const semestre = periodoActivo.semestre!
    const q = busqueda.value.trim() || null
    const c = canalRpc()
    const [k, list] = await Promise.all([
      fetchKpiReportePagosRematricula(anio, semestre, c),
      listarReportePagosRematricula(anio, semestre, c, q),
    ])
    if (k.error) {
      mostrarErrorRematricula(`Error al cargar totales: ${k.error}`)
      return
    }
    if (list.error) {
      mostrarErrorRematricula(`Error al cargar listado: ${list.error}`)
      return
    }
    kpi.value = k.data
    filas.value = list.data
  } finally {
    loading.value = false
  }
}

function exportarCsv() {
  const csv = filasReportePagosACsv(filas.value)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `reporte-pagos-rematricula-${periodoActivo.anio}-${periodoActivo.semestre}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

let busquedaTimer: ReturnType<typeof setTimeout> | null = null
watch(busqueda, () => {
  if (busquedaTimer) clearTimeout(busquedaTimer)
  busquedaTimer = setTimeout(() => {
    void cargar()
  }, 300)
})

watch(canal, () => {
  void cargar()
})

onMounted(async () => {
  await periodoActivo.ensureLoaded()
  if (tienePeriodo.value) await cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Pagos rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoLabel }}. Matriculados (embudo MOL + BO diario) cruzados con Webpay
          autorizada.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap items-end gap-3">
        <div v-if="!tienePeriodo" class="text-sm text-muted-foreground">
          No hay periodo activo configurado.
        </div>
        <template v-else>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground">Canal</p>
            <select
              v-model="canal"
              class="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="MOL">MOL</option>
              <option value="BO">BO</option>
            </select>
          </div>
          <div class="min-w-[220px] flex-1 space-y-1">
            <p class="text-xs text-muted-foreground">Buscar RUT / nombre / codcli</p>
            <Input v-model="busqueda" placeholder="Ej. 21055227" />
          </div>
          <Button type="button" :disabled="loading" @click="cargar">
            {{ loading ? 'Cargando…' : 'Actualizar' }}
          </Button>
          <Button
            type="button"
            variant="outline"
            :disabled="loading || filas.length === 0"
            @click="exportarCsv"
          >
            <Download class="mr-2 h-4 w-4" aria-hidden="true" />
            CSV
          </Button>
        </template>
      </CardContent>
    </Card>

    <div v-if="tienePeriodo && kpi" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card class="overflow-hidden border-uniacc-blue/30">
        <div class="h-1.5 bg-uniacc-blue" aria-hidden="true" />
        <CardHeader class="space-y-2">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-uniacc-blue/10 text-uniacc-blue"
            >
              <GraduationCap class="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle class="text-2xl tabular-nums">{{ kpi.matriculados_total }}</CardTitle>
              <CardDescription>Matriculados</CardDescription>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-md border px-2 py-1">
              <p class="text-xs text-muted-foreground">MOL</p>
              <p class="font-semibold tabular-nums">{{ kpi.matriculados_mol }}</p>
            </div>
            <div class="rounded-md border px-2 py-1">
              <p class="text-xs text-muted-foreground">BO</p>
              <p class="font-semibold tabular-nums">{{ kpi.matriculados_bo }}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-emerald-600/30">
        <div class="h-1.5 bg-emerald-600" aria-hidden="true" />
        <CardHeader>
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700"
            >
              <Wallet class="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle class="text-2xl tabular-nums">{{ kpi.webpay_matricula_alumnos }}</CardTitle>
              <CardDescription>Webpay matrícula</CardDescription>
            </div>
          </div>
          <p class="text-sm font-medium tabular-nums text-emerald-800">
            {{ fmtMoney(kpi.webpay_matricula_monto) }}
          </p>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-amber-600/30">
        <div class="h-1.5 bg-amber-600" aria-hidden="true" />
        <CardHeader>
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-800"
            >
              <Wallet class="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle class="text-2xl tabular-nums">{{ kpi.webpay_arancel_alumnos }}</CardTitle>
              <CardDescription>Webpay arancel</CardDescription>
            </div>
          </div>
          <p class="text-sm font-medium tabular-nums text-amber-900">
            {{ fmtMoney(kpi.webpay_arancel_monto) }}
          </p>
        </CardHeader>
      </Card>

      <Card class="overflow-hidden border-uniacc-magenta/30">
        <div class="h-1.5 bg-uniacc-magenta" aria-hidden="true" />
        <CardHeader>
          <CardTitle class="text-2xl tabular-nums">{{ kpi.mol_sin_webpay_matricula }}</CardTitle>
          <CardDescription>MOL sin Webpay matrícula</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <Card v-if="tienePeriodo">
      <CardHeader>
        <CardTitle>Detalle</CardTitle>
        <CardDescription>{{ filas.length }} filas</CardDescription>
      </CardHeader>
      <CardContent class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Mat. Webpay</TableHead>
              <TableHead>Monto mat.</TableHead>
              <TableHead>Arancel Webpay</TableHead>
              <TableHead>Monto arancel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading && filas.length === 0">
              <TableCell colspan="8" class="text-muted-foreground">Cargando…</TableCell>
            </TableRow>
            <TableRow v-else-if="filas.length === 0">
              <TableCell colspan="8" class="text-muted-foreground">Sin resultados</TableCell>
            </TableRow>
            <TableRow v-for="f in filas" :key="f.codcli">
              <TableCell class="whitespace-nowrap font-mono text-xs">{{ f.rut || f.rut_norm }}</TableCell>
              <TableCell>{{ f.nombre_alumno }}</TableCell>
              <TableCell class="max-w-[200px] truncate" :title="f.nombre_carrera ?? ''">
                {{ f.nombre_carrera }}
              </TableCell>
              <TableCell>{{ f.canal }}</TableCell>
              <TableCell>{{ f.pago_matricula ? 'Sí' : 'No' }}</TableCell>
              <TableCell class="tabular-nums">
                <span v-if="f.pago_matricula">{{ fmtMoney(f.monto_matricula) }}</span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
              <TableCell>{{ f.pago_arancel ? 'Sí' : 'No' }}</TableCell>
              <TableCell class="tabular-nums">
                <span v-if="f.pago_arancel" :title="fmtFecha(f.fecha_arancel)">
                  {{ fmtMoney(f.monto_arancel) }}
                </span>
                <span v-else class="text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
