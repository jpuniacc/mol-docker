<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'
import { useTablaPaginada } from '@/composables/useTablaPaginada'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  downloadContratoFirmaPdf,
  getContratoFirmaEstado,
  listContratoFirmas,
  type ContratoFirmaFirmanteEstado,
  type ContratoFirmaListRow,
  type MedioFirmaArancel,
  type MedioFirmaMatricula,
} from '@/services/contratoFirmaApi'

type FiltroEstado = 'todos' | 'pendiente' | 'firmado'

const PAGE_SIZE = 10

const rows = ref<ContratoFirmaListRow[]>([])
const loading = ref(false)
const filtroEstado = ref<FiltroEstado>('todos')
const busqueda = ref('')
const dialogOpen = ref(false)
const seleccionado = ref<ContratoFirmaListRow | null>(null)
const pdfUrl = ref<string | null>(null)
const pdfLoading = ref(false)
const pdfError = ref<string | null>(null)
const pdfFetchGeneration = ref(0)
let pdfAbortController: AbortController | null = null

const filasVisibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (filtroEstado.value === 'pendiente' && row.ready) return false
    if (filtroEstado.value === 'firmado' && !row.ready) return false
    if (!q) return true
    const rut = (row.rut ?? '').toLowerCase()
    const nombre = (row.nombre ?? '').toLowerCase()
    const codcli = (row.codcli ?? '').toLowerCase()
    return rut.includes(q) || nombre.includes(q) || codcli.includes(q)
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

watch([filtroEstado, busqueda], resetPage)

function quienFalta(firmantes: ContratoFirmaFirmanteEstado[]): string {
  return firmantes.filter((f) => !f.ready).map((f) => f.rol).join(', ') || '—'
}

function formatoGenerado(iso: string | null | undefined): string {
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

function etiquetaMedio(medio: MedioFirmaMatricula | MedioFirmaArancel | undefined): string {
  if (medio === 'webpay') return 'Webpay'
  if (medio === 'pagare') return 'Pagaré'
  if (medio === 'cubierto') return 'Cubierto'
  return '—'
}

function revokePdfUrl(): void {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }
}

function invalidatePdfFetch(): void {
  pdfAbortController?.abort()
  pdfAbortController = null
  pdfFetchGeneration.value += 1
}

function isPdfFetchStale(generation: number, numOperacion: string): boolean {
  return (
    generation !== pdfFetchGeneration.value ||
    !dialogOpen.value ||
    seleccionado.value?.num_operacion !== numOperacion
  )
}

async function cargar(): Promise<void> {
  loading.value = true
  try {
    const res = await listContratoFirmas()
    if (!res.ok) {
      mostrarErrorRematricula(res.error ?? 'No se pudo cargar el listado de firmas.')
      rows.value = []
      return
    }
    rows.value = res.data
  } finally {
    loading.value = false
  }
}

async function abrirDetalle(row: ContratoFirmaListRow): Promise<void> {
  invalidatePdfFetch()
  revokePdfUrl()

  const numOperacion = row.num_operacion
  const generation = pdfFetchGeneration.value
  const controller = new AbortController()
  pdfAbortController = controller

  seleccionado.value = row
  pdfError.value = null
  dialogOpen.value = true
  pdfLoading.value = true

  try {
    const [res, estado] = await Promise.all([
      downloadContratoFirmaPdf(numOperacion),
      getContratoFirmaEstado(numOperacion),
    ])
    if (isPdfFetchStale(generation, numOperacion) || controller.signal.aborted) return

    if (estado.ok) {
      const actualizado: ContratoFirmaListRow = {
        ...row,
        ready: estado.ready,
        firmantes: estado.firmantes,
      }
      seleccionado.value = actualizado
      const indice = rows.value.findIndex((item) => item.num_operacion === numOperacion)
      if (indice >= 0) rows.value[indice] = { ...rows.value[indice], ...actualizado }
    }

    if (!res.ok) {
      pdfError.value = `No pudimos traer el contrato de la operación ${numOperacion}. El registro sigue aquí.`
      mostrarErrorRematricula(res.error, {
        numOperacion: String(numOperacion),
        reintentar: () => {
          void abrirDetalle(row)
        },
      })
      return
    }
    pdfUrl.value = URL.createObjectURL(res.blob)
  } finally {
    if (!isPdfFetchStale(generation, numOperacion)) {
      pdfLoading.value = false
    }
    if (pdfAbortController === controller) {
      pdfAbortController = null
    }
  }
}

function onDialogOpenChange(open: boolean): void {
  dialogOpen.value = open
  if (!open) {
    invalidatePdfFetch()
    revokePdfUrl()
    seleccionado.value = null
    pdfError.value = null
    pdfLoading.value = false
  }
}

onMounted(() => {
  void cargar()
})

onUnmounted(() => {
  invalidatePdfFetch()
  revokePdfUrl()
})
</script>

<template>
  <div class="mx-auto max-w-[1400px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Gestión de firmas</CardTitle>
        <CardDescription>
          Contratos enviados a TuFirma. Ver el PDF en pantalla (original o estampado) y quién falta
          por firmar.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Tabs v-model="filtroEstado">
          <TabsList class="flex h-auto flex-wrap">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
            <TabsTrigger value="firmado">Firmado</TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex flex-wrap gap-3">
          <Input
            v-model="busqueda"
            class="w-64"
            placeholder="Buscar RUT, nombre o codcli"
          />
          <Button type="button" variant="outline" :disabled="loading" @click="cargar">
            Actualizar
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="space-y-4 pt-6">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RUT</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>Carrera</TableHead>
                <TableHead>N° operación</TableHead>
                <TableHead>Generado</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Arancel</TableHead>
                <TableHead>Quién falta</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in filasPagina" :key="row.num_operacion">
                <TableCell>{{ row.rut ?? '—' }}</TableCell>
                <TableCell>{{ row.nombre ?? row.codcli ?? '—' }}</TableCell>
                <TableCell>{{ row.carrera ?? '—' }}</TableCell>
                <TableCell>{{ row.num_operacion }}</TableCell>
                <TableCell class="whitespace-nowrap text-sm">
                  {{ formatoGenerado(row.created_at) }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ etiquetaMedio(row.medio_matricula) }}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{{ etiquetaMedio(row.medio_arancel) }}</Badge>
                </TableCell>
                <TableCell>{{ quienFalta(row.firmantes ?? []) }}</TableCell>
                <TableCell>
                  <Badge variant="outline">{{ row.ready ? 'Firmado' : 'Pendiente' }}</Badge>
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="outline" @click="abrirDetalle(row)">
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="!loading && filasVisibles.length === 0">
                <TableCell colspan="10" class="text-muted-foreground">Sin firmas.</TableCell>
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

    <Dialog :open="dialogOpen" @update:open="onDialogOpenChange">
      <DialogContent class="max-h-[90vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Contrato {{ seleccionado?.num_operacion }}</DialogTitle>
          <DialogDescription>
            {{ seleccionado?.rut ?? '—' }} · {{ seleccionado?.nombre ?? seleccionado?.codcli ?? '—' }}
            · {{ seleccionado?.carrera ?? '—' }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <ul class="space-y-1 text-sm">
            <li
              v-for="firmante in seleccionado?.firmantes ?? []"
              :key="`${firmante.email}-${firmante.rol}`"
              class="flex flex-wrap items-center gap-2"
            >
              <span class="font-medium">{{ firmante.nombre }}</span>
              <span class="text-muted-foreground">({{ firmante.rol }} · {{ firmante.email }})</span>
              <Badge variant="outline">{{ firmante.ready ? 'Firmado' : 'Pendiente' }}</Badge>
            </li>
          </ul>
          <p v-if="pdfLoading" class="text-sm text-muted-foreground">Cargando PDF…</p>
          <p v-else-if="pdfError" class="text-sm text-red-700">{{ pdfError }}</p>
          <iframe
            v-else-if="pdfUrl"
            :src="pdfUrl"
            title="Contrato PDF"
            class="h-[65vh] w-full rounded border"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
