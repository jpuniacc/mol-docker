<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download, RefreshCw } from 'lucide-vue-next'

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
  listarWebpayConciliacion,
  type WebpayConciliacionFila,
} from '@/services/webpayConciliacionApi'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'

const periodoActivo = usePeriodoActivoStore()

const filas = ref<WebpayConciliacionFila[]>([])
const convertidos = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const busqueda = ref('')

const tienePeriodo = computed(
  () => periodoActivo.anio != null && periodoActivo.semestre != null,
)

const periodoLabel = computed(() => periodoActivo.label ?? '—')

const filasVisibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return filas.value
  return filas.value.filter((fila) => {
    const hay = [
      fila.rut,
      fila.nombre,
      fila.codcli,
      fila.authorizationCode,
      fila.folioUPlus,
      ...(fila.foliosUPlus ?? []),
      fila.buyOrder,
      fila.numOperacion,
      fila.paymentTypeCode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

function fmtMonto(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-CL', { timeZone: 'America/Santiago' })
}

function etiquetaCuotas(fila: WebpayConciliacionFila): string {
  const tipo = (fila.paymentTypeCode ?? '—').toUpperCase()
  const n = fila.installmentsNumber
  if (n == null || n < 2) return `${tipo} · 1 cuota`
  return `${tipo} · ${n} cuotas`
}

function csvEscape(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

function exportarCsv(): void {
  const encabezado = [
    'rut',
    'nombre',
    'codcli',
    'concepto',
    'auth_transbank',
    'folios_u_plus',
    'convertido',
    'payment_type',
    'cuotas',
    'monto',
    'buy_order',
    'num_operacion',
    'fecha',
  ]
  const lineas = [encabezado.join(',')]
  for (const fila of filasVisibles.value) {
    lineas.push(
      [
        fila.rut ?? '',
        fila.nombre ?? '',
        fila.codcli,
        fila.concepto,
        fila.authorizationCode,
        (fila.foliosUPlus ?? [fila.folioUPlus]).join('|'),
        fila.requiereConversion ? 'si' : 'no',
        fila.paymentTypeCode ?? '',
        fila.installmentsNumber != null ? String(fila.installmentsNumber) : '',
        String(fila.monto),
        fila.buyOrder,
        fila.numOperacion ?? '',
        fila.transactionDate ?? '',
      ]
        .map((c) => csvEscape(String(c)))
        .join(','),
    )
  }
  const blob = new Blob([lineas.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `conciliacion-transbank-${periodoLabel.value || 'periodo'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function cargar(): Promise<void> {
  if (!tienePeriodo.value || periodoActivo.anio == null || periodoActivo.semestre == null) {
    error.value = 'No hay periodo académico activo'
    filas.value = []
    convertidos.value = 0
    return
  }
  loading.value = true
  error.value = null
  try {
    const res = await listarWebpayConciliacion(periodoActivo.anio, periodoActivo.semestre)
    if (!res.ok) {
      error.value = res.error
      filas.value = []
      convertidos.value = 0
      return
    }
    filas.value = res.filas
    convertidos.value = res.convertidos
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="space-y-4 p-4 md:p-6">
    <Card class="border-border/80 shadow-sm">
      <CardHeader class="space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Conciliación Transbank</CardTitle>
            <CardDescription>
              Periodo {{ periodoLabel }}. Transacciones Webpay autorizadas: código del voucher y
              folios guardados en U+ (débito = base; crédito = base+01…NN). Badge «convertido» si la
              auth tenía letras (base36).
            </CardDescription>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              class="cursor-pointer"
              :disabled="loading || filasVisibles.length === 0"
              @click="exportarCsv"
            >
              <Download class="mr-1.5 h-4 w-4" aria-hidden="true" />
              CSV
            </Button>
            <Button
              type="button"
              size="sm"
              class="cursor-pointer"
              :disabled="loading"
              @click="cargar"
            >
              <RefreshCw
                class="mr-1.5 h-4 w-4"
                :class="loading ? 'animate-spin' : ''"
                aria-hidden="true"
              />
              Actualizar
            </Button>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" class="tabular-nums">{{ filas.length }} transacción(es)</Badge>
          <Badge
            v-if="convertidos > 0"
            class="border-amber-300 bg-amber-50 text-amber-900 tabular-nums"
          >
            {{ convertidos }} convertida(s)
          </Badge>
          <Input
            v-model="busqueda"
            class="w-full max-w-sm"
            placeholder="Buscar RUT, auth, folio U+, buy order…"
          />
        </div>
      </CardHeader>
      <CardContent class="p-0 pt-0">
        <p v-if="error" class="px-6 pb-4 text-sm text-destructive">{{ error }}</p>
        <Table :aria-busy="loading">
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Auth Transbank</TableHead>
              <TableHead>Folios U+</TableHead>
              <TableHead class="hidden md:table-cell">Tipo</TableHead>
              <TableHead class="text-right">Monto</TableHead>
              <TableHead class="hidden lg:table-cell">Buy order</TableHead>
              <TableHead class="hidden xl:table-cell">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="!loading && filasVisibles.length === 0">
              <TableCell colspan="8" class="py-10 text-center text-muted-foreground">
                No hay transacciones Webpay autorizadas en este periodo.
              </TableCell>
            </TableRow>
            <TableRow v-for="fila in filasVisibles" :key="`${fila.buyOrder}-${fila.concepto}`">
              <TableCell>
                <div class="font-medium leading-tight">{{ fila.nombre ?? fila.codcli }}</div>
                <div class="font-mono text-xs text-muted-foreground">{{ fila.rut ?? '—' }}</div>
              </TableCell>
              <TableCell class="capitalize">{{ fila.concepto }}</TableCell>
              <TableCell>
                <div class="flex flex-wrap items-center gap-1.5">
                  <code
                    class="rounded bg-amber-50 px-1.5 py-0.5 text-sm font-semibold text-amber-900"
                  >
                    {{ fila.authorizationCode }}
                  </code>
                  <Badge
                    v-if="fila.requiereConversion"
                    variant="outline"
                    class="border-amber-400 text-[10px] text-amber-800"
                  >
                    convertido
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <code
                    v-for="folio in fila.foliosUPlus?.length ? fila.foliosUPlus : [fila.folioUPlus]"
                    :key="folio"
                    class="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-xs text-sky-900"
                  >
                    {{ folio }}
                  </code>
                </div>
              </TableCell>
              <TableCell class="hidden text-xs md:table-cell">{{ etiquetaCuotas(fila) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ fmtMonto(fila.monto) }}</TableCell>
              <TableCell class="hidden font-mono text-xs lg:table-cell">{{ fila.buyOrder }}</TableCell>
              <TableCell class="hidden text-xs text-muted-foreground xl:table-cell">
                {{ fmtFecha(fila.transactionDate) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
