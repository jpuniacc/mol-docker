<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listarCasosRematricula, resolverCasoRematricula } from '@/services/casoRematriculaApi'
import {
  listContratoFirmas,
  type ContratoFirmaFirmanteEstado,
  type ContratoFirmaListRow,
} from '@/services/contratoFirmaApi'
import { CONVENIO_DOC_BUCKET } from '@/services/convenioDocumento'
import { supabase } from '@/services/supabaseClient'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type { MnpCasoRematriculaRow } from '@/types/supabase'
import { periodoCatalogoLabel, periodosEquivalentes } from '@/utils/periodoCatalogo'

const router = useRouter()
const auth = useAuthStore()
const periodoActivo = usePeriodoActivoStore()

const rows = ref<MnpCasoRematriculaRow[]>([])
const loading = ref(false)
const filtroTipo = ref<string>('todos')
const filtroEstado = ref<string>('EN_REVISION')
const busqueda = ref('')
const seleccionado = ref<MnpCasoRematriculaRow | null>(null)
const motivo = ref('')
const resolviendo = ref(false)
const urlArchivo = ref<string | null>(null)

type FiltroFirmaEstado = 'todos' | 'pendiente' | 'finalizada'
const firmas = ref<ContratoFirmaListRow[]>([])
const loadingFirmas = ref(false)
const filtroFirmaEstado = ref<FiltroFirmaEstado>('pendiente')
const busquedaFirmas = ref('')

const periodoDefault = computed(() => {
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (anio == null || sem == null) return '2027-01'
  return periodoCatalogoLabel(anio, sem)
})

const etiquetasTipo: Record<string, string> = {
  CONVENIO_CERTIFICADO: 'Certificado convenio',
  APODERADO_DATOS: 'Apoderado',
  CAE_RESOLUCION: 'CAE',
  ESTATAL_MINEDUC: 'Beca ministerial',
  TYC_RECHAZO: 'TyC no aceptados',
}

const filasVisibles = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((row) => {
    const rut = (row.rut_alumno ?? '').toLowerCase()
    const nombre = (row.nombre_alumno ?? '').toLowerCase()
    const codcli = (row.codcli ?? '').toLowerCase()
    return rut.includes(q) || nombre.includes(q) || codcli.includes(q)
  })
})

const firmasVisibles = computed(() => {
  const periodo = periodoDefault.value
  const periodoActivoLabel = periodoActivo.label
  const q = busquedaFirmas.value.trim().toLowerCase()
  return firmas.value.filter((row) => {
    // TuFirma guarda `periodoActivo.label` (2027-1); casos usan catálogo (2027-01).
    if (
      row.periodo &&
      !periodosEquivalentes(row.periodo, periodo) &&
      !periodosEquivalentes(row.periodo, periodoActivoLabel)
    ) {
      return false
    }
    if (filtroFirmaEstado.value === 'pendiente' && row.ready) return false
    if (filtroFirmaEstado.value === 'finalizada' && !row.ready) return false
    if (!q) return true
    const rut = (row.rut ?? '').toLowerCase()
    const nombre = (row.nombre ?? '').toLowerCase()
    const codcli = (row.codcli ?? '').toLowerCase()
    return rut.includes(q) || nombre.includes(q) || codcli.includes(q)
  })
})

function payloadTexto(row: MnpCasoRematriculaRow, key: string): string | null {
  const v = row.payload[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function quienFaltaFirma(firmantes: ContratoFirmaFirmanteEstado[]): string {
  return firmantes.filter((f) => !f.ready).map((f) => f.rol).join(', ') || '—'
}

async function cargarCasos() {
  loading.value = true
  try {
    await periodoActivo.ensureLoaded()
    const { data, error } = await listarCasosRematricula({
      periodo: periodoDefault.value,
      tipo: filtroTipo.value === 'todos' ? null : filtroTipo.value,
      estado: filtroEstado.value === 'todos' ? null : filtroEstado.value,
    })
    if (error) {
      toast.error(error)
      rows.value = []
      return
    }
    rows.value = data
  } finally {
    loading.value = false
  }
}

async function cargarFirmas() {
  loadingFirmas.value = true
  try {
    const res = await listContratoFirmas()
    if (!res.ok) {
      toast.error(res.error ?? 'No se pudo cargar firmas de contrato.')
      firmas.value = []
      return
    }
    firmas.value = res.data
  } finally {
    loadingFirmas.value = false
  }
}

async function cargar() {
  await Promise.all([cargarCasos(), cargarFirmas()])
}

async function abrirDetalle(row: MnpCasoRematriculaRow) {
  seleccionado.value = row
  motivo.value = ''
  urlArchivo.value = null
  const path = payloadTexto(row, 'storage_path')
  if (row.tipo === 'CONVENIO_CERTIFICADO' && path) {
    const { data, error } = await supabase.storage
      .from(CONVENIO_DOC_BUCKET)
      .createSignedUrl(path, 300)
    if (!error) urlArchivo.value = data?.signedUrl ?? null
  }
}

function irAGestionFirmas() {
  void router.push({ name: 'dashboard-gestion-firmas' })
}

async function resolver(estado: 'APROBADO' | 'RECHAZADO') {
  const row = seleccionado.value
  if (!row) return
  if (estado === 'RECHAZADO' && !motivo.value.trim()) {
    toast.error('Indica el motivo del rechazo.')
    return
  }
  resolviendo.value = true
  try {
    const quien = auth.email?.trim() || auth.displayNombreCompleto?.trim() || 'consejero'
    const { error } = await resolverCasoRematricula({
      id: row.id,
      estado,
      resueltoPor: quien,
      motivo: motivo.value.trim() || null,
    })
    if (error) {
      toast.error(error)
      return
    }
    toast.success(estado === 'APROBADO' ? 'Caso aprobado.' : 'Caso rechazado.')
    seleccionado.value = null
    await cargarCasos()
  } finally {
    resolviendo.value = false
  }
}

watch([filtroTipo, filtroEstado], () => {
  void cargarCasos()
})

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Casos rematrícula</CardTitle>
        <CardDescription>
          Periodo {{ periodoDefault }}. Cola de alumnos detenidos: certificado, CAE, ministerial,
          apoderado y TyC no aceptados. Abajo, firmas de contrato del periodo.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <Tabs v-model="filtroTipo">
          <TabsList class="flex h-auto flex-wrap">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="CONVENIO_CERTIFICADO">Certificado</TabsTrigger>
            <TabsTrigger value="CAE_RESOLUCION">CAE</TabsTrigger>
            <TabsTrigger value="ESTATAL_MINEDUC">Ministerial</TabsTrigger>
            <TabsTrigger value="APODERADO_DATOS">Apoderado</TabsTrigger>
            <TabsTrigger value="TYC_RECHAZO">TyC no aceptados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div class="flex flex-wrap gap-3">
          <Select v-model="filtroEstado">
            <SelectTrigger class="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EN_REVISION">En revisión</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="APROBADO">Aprobado</SelectItem>
              <SelectItem value="RECHAZADO">Rechazado</SelectItem>
              <SelectItem value="CERRADO">Cerrado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="busqueda"
            class="w-64"
            placeholder="Buscar RUT, nombre o codcli"
          />
          <Button
            type="button"
            variant="outline"
            :disabled="loading || loadingFirmas"
            @click="cargar"
          >
            Actualizar
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="text-base">Casos en cola</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Título</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in filasVisibles" :key="row.id">
              <TableCell>{{ row.rut_alumno ?? '—' }}</TableCell>
              <TableCell>{{ row.nombre_alumno ?? row.codcli }}</TableCell>
              <TableCell>{{ row.carrera ?? '—' }}</TableCell>
              <TableCell>{{ etiquetasTipo[row.tipo] ?? row.tipo }}</TableCell>
              <TableCell>
                <Badge variant="outline">{{ row.estado }}</Badge>
              </TableCell>
              <TableCell>{{ row.titulo }}</TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="outline" @click="abrirDetalle(row)">
                  Ver
                </Button>
              </TableCell>
            </TableRow>
            <TableRow v-if="!loading && filasVisibles.length === 0">
              <TableCell colspan="7" class="text-muted-foreground">Sin casos.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle class="text-base">Firmas de contrato</CardTitle>
            <CardDescription>
              Periodo {{ periodoDefault }}. Pendiente = enviada a TuFirma sin cerrar; finalizada =
              todas las firmas listas.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" @click="irAGestionFirmas">
            Abrir gestión de firmas
          </Button>
        </div>
        <Tabs v-model="filtroFirmaEstado">
          <TabsList class="flex h-auto flex-wrap">
            <TabsTrigger value="pendiente">Pendiente</TabsTrigger>
            <TabsTrigger value="finalizada">Finalizada</TabsTrigger>
            <TabsTrigger value="todos">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          v-model="busquedaFirmas"
          class="w-64"
          placeholder="Buscar RUT, nombre o codcli"
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RUT</TableHead>
              <TableHead>Alumno</TableHead>
              <TableHead>Carrera</TableHead>
              <TableHead>N° operación</TableHead>
              <TableHead>Quién falta</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in firmasVisibles" :key="row.num_operacion">
              <TableCell>{{ row.rut ?? '—' }}</TableCell>
              <TableCell>{{ row.nombre ?? row.codcli ?? '—' }}</TableCell>
              <TableCell>{{ row.carrera ?? '—' }}</TableCell>
              <TableCell class="font-mono text-xs">{{ row.num_operacion }}</TableCell>
              <TableCell>{{ quienFaltaFirma(row.firmantes ?? []) }}</TableCell>
              <TableCell>
                <Badge
                  :variant="row.ready ? 'default' : 'outline'"
                  :class="row.ready ? 'bg-emerald-600 hover:bg-emerald-600' : ''"
                >
                  {{ row.ready ? 'Finalizada' : 'Pendiente' }}
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow v-if="!loadingFirmas && firmasVisibles.length === 0">
              <TableCell colspan="6" class="text-muted-foreground">
                Sin firmas en este filtro.
              </TableCell>
            </TableRow>
            <TableRow v-if="loadingFirmas">
              <TableCell colspan="6" class="text-muted-foreground">Cargando firmas…</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Card v-if="seleccionado">
      <CardHeader>
        <CardTitle>{{ seleccionado.titulo }}</CardTitle>
        <CardDescription>
          {{ seleccionado.rut_alumno }} · {{ seleccionado.carrera }} · {{ seleccionado.jornada }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm">{{ seleccionado.detalle }}</p>
        <p v-if="seleccionado.motivo" class="text-sm text-red-700">Motivo: {{ seleccionado.motivo }}</p>
        <a
          v-if="urlArchivo"
          :href="urlArchivo"
          target="_blank"
          rel="noreferrer"
          class="text-sm text-uniacc-orange underline"
        >
          Ver documento
        </a>
        <template
          v-if="
            seleccionado.tipo === 'CONVENIO_CERTIFICADO' &&
            seleccionado.estado === 'EN_REVISION'
          "
        >
          <div class="space-y-2">
            <Label for="motivo-rechazo">Motivo (obligatorio al rechazar)</Label>
            <Input id="motivo-rechazo" v-model="motivo" />
          </div>
          <div class="flex gap-2">
            <Button type="button" :disabled="resolviendo" @click="resolver('APROBADO')">
              Aprobar
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="resolviendo"
              @click="resolver('RECHAZADO')"
            >
              Rechazar
            </Button>
          </div>
        </template>
        <p v-else class="text-sm text-muted-foreground">
          Este tipo se lista para seguimiento. La resolución detallada se suma en una siguiente
          iteración.
        </p>
        <Button type="button" variant="ghost" @click="seleccionado = null">Cerrar</Button>
      </CardContent>
    </Card>
  </div>
</template>
