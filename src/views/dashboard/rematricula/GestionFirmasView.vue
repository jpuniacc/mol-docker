<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

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
  listContratoFirmas,
  type ContratoFirmaFirmanteEstado,
  type ContratoFirmaListRow,
} from '@/services/contratoFirmaApi'

type FiltroEstado = 'todos' | 'pendiente' | 'firmado'

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

function quienFalta(firmantes: ContratoFirmaFirmanteEstado[]): string {
  return firmantes.filter((f) => !f.ready).map((f) => f.rol).join(', ') || '—'
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
      toast.error(res.error ?? 'No se pudo cargar el listado de firmas.')
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
    const res = await downloadContratoFirmaPdf(numOperacion)
    if (isPdfFetchStale(generation, numOperacion) || controller.signal.aborted) return

    if (!res.ok) {
      pdfError.value = res.error
      toast.error(res.error)
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
  <div class="mx-auto max-w-[1200px] space-y-6">
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
      <CardContent class="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>N° operación</TableHead>
              <TableHead>Quién falta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in filasVisibles" :key="row.num_operacion">
              <TableCell>{{ row.rut ?? '—' }}</TableCell>
              <TableCell>{{ row.nombre ?? row.codcli ?? '—' }}</TableCell>
              <TableCell>{{ row.carrera ?? '—' }}</TableCell>
              <TableCell>{{ row.num_operacion }}</TableCell>
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
              <TableCell colspan="7" class="text-muted-foreground">Sin firmas.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
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
