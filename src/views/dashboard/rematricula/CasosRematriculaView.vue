<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  GraduationCap,
  Inbox,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { refreshApoderadoFromErp } from '@/services/apoderadoRefreshFromErpApi'
import {
  listContratoFirmas,
  type ContratoFirmaFirmanteEstado,
  type ContratoFirmaListRow,
} from '@/services/contratoFirmaApi'
import { CONVENIO_DOC_BUCKET } from '@/services/convenioDocumento'
import { fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { fetchKpiProgresoRematricula, refreshProgresoRematricula } from '@/services/progresoRematriculaApi'
import { supabase } from '@/services/supabaseClient'
import { useAuthStore } from '@/stores/auth'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type {
  EtapaProgresoRematricula,
  KpiProgresoRematricula,
  MnpCasoRematriculaEstado,
  MnpCasoRematriculaRow,
  MnpCasoRematriculaTipo,
  PlanPagosMvRow,
} from '@/types/supabase'
import {
  mailApoderadoDisplay,
  nombreCompletoApoderado,
  telefonoApoderadoDisplay,
} from '@/utils/apoderadoResponsable'
import { etiquetaEtapaProgreso } from '@/utils/etapaProgresoRematricula'
import { periodoCatalogoLabel, periodosEquivalentes } from '@/utils/periodoCatalogo'

const router = useRouter()
const auth = useAuthStore()
const periodoActivo = usePeriodoActivoStore()

type FiltroCola = 'pendientes' | 'resueltos' | 'todos'
type FiltroFirmaEstado = 'todos' | 'pendiente' | 'finalizada'
type PanelPrincipal = 'casos' | 'firmas'

const ESTADOS_PENDIENTES: MnpCasoRematriculaEstado[] = ['EN_REVISION', 'ABIERTO']
const ESTADOS_RESUELTOS: MnpCasoRematriculaEstado[] = ['APROBADO', 'CERRADO', 'RECHAZADO']

const ORDEN_EMBUDO: EtapaProgresoRematricula[] = [
  'sin_ingreso',
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'firma',
  'matriculado',
]

const rows = ref<MnpCasoRematriculaRow[]>([])
const loading = ref(false)
const panelPrincipal = ref<PanelPrincipal>('casos')
const filtroTipo = ref<string>('todos')
const filtroCola = ref<FiltroCola>('pendientes')
const busqueda = ref('')
const seleccionado = ref<MnpCasoRematriculaRow | null>(null)
const detalleOpen = ref(false)
const motivo = ref('')
const resolviendo = ref(false)
const actualizandoApoderado = ref(false)
const urlArchivo = ref<string | null>(null)
const apoderadoRefrescado = ref<{
  nombre: string
  telefono: string
  email: string
} | null>(null)
const planApoderado = ref<PlanPagosMvRow | null>(null)
const loadingPlanApoderado = ref(false)

const firmas = ref<ContratoFirmaListRow[]>([])
const loadingFirmas = ref(false)
const filtroFirmaEstado = ref<FiltroFirmaEstado>('pendiente')
const busquedaFirmas = ref('')

const kpi = ref<KpiProgresoRematricula | null>(null)
const loadingKpi = ref(false)

const periodoDefault = computed(() => {
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (anio == null || sem == null) return '2027-01'
  return periodoCatalogoLabel(anio, sem)
})

const etiquetasTipo: Record<string, string> = {
  CONVENIO_CERTIFICADO: 'Certificado',
  APODERADO_DATOS: 'Apoderado',
  CAE_RESOLUCION: 'CAE',
  ESTATAL_MINEDUC: 'Ministerial',
  TYC_RECHAZO: 'TyC',
}

const conteosCola = computed(() => {
  const pendientes = rows.value.filter((r) =>
    ESTADOS_PENDIENTES.includes(r.estado),
  ).length
  const resueltos = rows.value.filter((r) => ESTADOS_RESUELTOS.includes(r.estado)).length
  return { pendientes, resueltos, todos: rows.value.length }
})

const filasVisibles = computed(() => {
  let list = rows.value
  if (filtroCola.value === 'pendientes') {
    list = list.filter((r) => ESTADOS_PENDIENTES.includes(r.estado))
  } else if (filtroCola.value === 'resueltos') {
    list = list.filter((r) => ESTADOS_RESUELTOS.includes(r.estado))
  }
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((row) => {
    const rut = (row.rut_alumno ?? '').toLowerCase()
    const nombre = (row.nombre_alumno ?? '').toLowerCase()
    const codcli = (row.codcli ?? '').toLowerCase()
    return rut.includes(q) || nombre.includes(q) || codcli.includes(q)
  })
})

const emptyStateCopy = computed(() => {
  if (filtroCola.value === 'pendientes') {
    return {
      titulo: 'No hay casos pendientes',
      detalle:
        filtroTipo.value === 'todos'
          ? 'La cola está al día para este periodo.'
          : `No hay pendientes de tipo ${etiquetasTipo[filtroTipo.value] ?? filtroTipo.value}.`,
      cta:
        conteosCola.value.resueltos > 0
          ? `Ver resueltos (${conteosCola.value.resueltos})`
          : null,
    }
  }
  if (filtroCola.value === 'resueltos') {
    return {
      titulo: 'Sin casos resueltos',
      detalle: 'Cuando apruebes o cierres un caso, aparecerá aquí.',
      cta: null,
    }
  }
  return {
    titulo: 'Sin casos',
    detalle: 'No hay casos para este filtro en el periodo.',
    cta: null,
  }
})

const embudoEtapas = computed(() => {
  if (!kpi.value) return []
  return ORDEN_EMBUDO.map((etapa) => ({
    etapa,
    label: etiquetaEtapaProgreso(etapa),
    count: kpi.value![etapa] ?? 0,
  }))
})

const firmasVisibles = computed(() => {
  const periodo = periodoDefault.value
  const periodoActivoLabel = periodoActivo.label
  const q = busquedaFirmas.value.trim().toLowerCase()
  return firmas.value.filter((row) => {
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

const firmasPendientesCount = computed(
  () => firmas.value.filter((f) => !f.ready).length,
)

const apoderadoActualNombre = computed(() =>
  planApoderado.value ? nombreCompletoApoderado(planApoderado.value) : null,
)
const apoderadoActualTel = computed(() =>
  planApoderado.value ? telefonoApoderadoDisplay(planApoderado.value) : null,
)
const apoderadoActualMail = computed(() =>
  planApoderado.value ? mailApoderadoDisplay(planApoderado.value) : null,
)

function iconoTipo(tipo: MnpCasoRematriculaTipo | string) {
  switch (tipo) {
    case 'APODERADO_DATOS':
      return UserRound
    case 'CONVENIO_CERTIFICADO':
      return FileCheck
    case 'TYC_RECHAZO':
      return AlertCircle
    case 'CAE_RESOLUCION':
    case 'ESTATAL_MINEDUC':
      return GraduationCap
    default:
      return Inbox
  }
}

function claseBadgeEstado(estado: MnpCasoRematriculaEstado): string {
  if (estado === 'APROBADO' || estado === 'CERRADO') {
    return 'border-emerald-600 bg-emerald-50 text-emerald-800'
  }
  if (estado === 'RECHAZADO') {
    return 'border-red-500 bg-red-50 text-red-800'
  }
  if (estado === 'EN_REVISION' || estado === 'ABIERTO') {
    return 'border-amber-500 bg-amber-50 text-amber-900'
  }
  return ''
}

function etiquetaEstado(estado: MnpCasoRematriculaEstado): string {
  const map: Record<MnpCasoRematriculaEstado, string> = {
    ABIERTO: 'Abierto',
    EN_REVISION: 'En revisión',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    CERRADO: 'Cerrado',
  }
  return map[estado] ?? estado
}

function payloadTexto(row: MnpCasoRematriculaRow, key: string): string | null {
  const v = row.payload[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function nombreApoderadoDesdeErp(apo: {
  nombreApoderado: string | null
  apellidoPaternoApoderado: string | null
  apellidoMaternoApoderado: string | null
}): string {
  return [apo.nombreApoderado, apo.apellidoPaternoApoderado, apo.apellidoMaternoApoderado]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .trim()
}

function quienFaltaFirma(firmantes: ContratoFirmaFirmanteEstado[]): string {
  return firmantes.filter((f) => !f.ready).map((f) => f.rol).join(', ') || '—'
}

function irAKpi() {
  void router.push({ name: 'dashboard-rematricula-kpi' })
}

function irAGestionFirmas() {
  void router.push({ name: 'dashboard-gestion-firmas' })
}

function verResueltos() {
  filtroCola.value = 'resueltos'
}

function onDetalleOpenChange(open: boolean) {
  detalleOpen.value = open
  if (!open) {
    seleccionado.value = null
    urlArchivo.value = null
    apoderadoRefrescado.value = null
    planApoderado.value = null
    motivo.value = ''
  }
}

async function cargarPlanApoderado(codcli: string) {
  loadingPlanApoderado.value = true
  planApoderado.value = null
  try {
    const { data } = await fetchPlanPagosMvByCodcli({
      codcli,
      anioMatricula: periodoActivo.anio,
      periodoMatricula: periodoActivo.semestre,
    })
    planApoderado.value = data
  } finally {
    loadingPlanApoderado.value = false
  }
}

async function abrirDetalle(row: MnpCasoRematriculaRow) {
  seleccionado.value = row
  motivo.value = ''
  urlArchivo.value = null
  apoderadoRefrescado.value = null
  planApoderado.value = null
  detalleOpen.value = true

  const path = payloadTexto(row, 'storage_path')
  if (row.tipo === 'CONVENIO_CERTIFICADO' && path) {
    const { data, error } = await supabase.storage
      .from(CONVENIO_DOC_BUCKET)
      .createSignedUrl(path, 300)
    if (!error) urlArchivo.value = data?.signedUrl ?? null
  }
  if (row.tipo === 'APODERADO_DATOS' && row.codcli) {
    void cargarPlanApoderado(row.codcli)
  }
}

async function cargarKpi() {
  loadingKpi.value = true
  try {
    await periodoActivo.ensureLoaded()
    const anio = periodoActivo.anio
    const sem = periodoActivo.semestre
    if (anio == null || sem == null) {
      kpi.value = null
      return
    }
    const { data, error } = await fetchKpiProgresoRematricula(anio, sem)
    if (error) {
      console.warn('[Casos] KPI:', error)
      kpi.value = null
      return
    }
    kpi.value = data
  } finally {
    loadingKpi.value = false
  }
}

async function cargarCasos() {
  loading.value = true
  try {
    await periodoActivo.ensureLoaded()
    const { data, error } = await listarCasosRematricula({
      periodo: periodoDefault.value,
      tipo: filtroTipo.value === 'todos' ? null : filtroTipo.value,
      estado: null,
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
  await periodoActivo.ensureLoaded()
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (anio != null && sem != null) {
    const { error } = await refreshProgresoRematricula(anio, sem)
    if (error) console.warn('[Casos] refresh progreso:', error)
  }
  await Promise.all([cargarCasos(), cargarFirmas(), cargarKpi()])
}

async function actualizarDatosApoderado(rowOrigen?: MnpCasoRematriculaRow | null) {
  const row = rowOrigen ?? seleccionado.value
  if (!row || row.tipo !== 'APODERADO_DATOS' || row.estado !== 'EN_REVISION') return
  if (!row.codcli?.trim()) {
    toast.error('El caso no tiene codcli.')
    return
  }
  actualizandoApoderado.value = true
  try {
    if (seleccionado.value?.id !== row.id) {
      await abrirDetalle(row)
    }
    const refreshed = await refreshApoderadoFromErp({
      codcli: row.codcli,
      casoId: row.id,
      rutAlumno: row.rut_alumno,
      nombreAlumno: row.nombre_alumno,
      carrera: row.carrera,
      jornada: row.jornada,
    })
    if (!refreshed.ok || !refreshed.apoderado) {
      toast.error(refreshed.error || 'No se pudo actualizar desde el ERP.')
      return
    }
    const apo = refreshed.apoderado
    const nombre = nombreApoderadoDesdeErp(apo) || '—'
    const telefono = apo.telefonoApoder || apo.telefonoApoderado || '—'
    const email = apo.mailApoder || '—'
    apoderadoRefrescado.value = { nombre, telefono, email }

    const quien = auth.email?.trim() || auth.displayNombreCompleto?.trim() || 'consejero'
    const { error } = await resolverCasoRematricula({
      id: row.id,
      estado: 'APROBADO',
      resueltoPor: quien,
      motivo: 'Datos de apoderado actualizados desde ERP',
    })
    if (error) {
      toast.error(`Datos actualizados en MOL, pero no se pudo cerrar el caso: ${error}`)
      return
    }
    toast.success(`Datos actualizados: ${nombre}. Queda en Resueltos.`)
    onDetalleOpenChange(false)
    await cargarCasos()
  } finally {
    actualizandoApoderado.value = false
  }
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
    toast.success(
      estado === 'APROBADO' ? 'Caso aprobado. Disponible en Resueltos.' : 'Caso rechazado.',
    )
    onDetalleOpenChange(false)
    await cargarCasos()
  } finally {
    resolviendo.value = false
  }
}

watch(filtroTipo, () => {
  void cargarCasos()
})

onMounted(() => {
  void cargar()
})
</script>

<template>
  <div class="mx-auto max-w-[1200px] space-y-4 pb-8">
    <!-- Sticky toolbar -->
    <div
      class="sticky top-0 z-20 -mx-1 space-y-3 border-b border-border/60 bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold tracking-tight text-foreground">Casos rematrícula</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Periodo {{ periodoDefault }} · cola e historial de bloqueos
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" @click="irAKpi">
            Ver KPI
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            class="cursor-pointer gap-1.5"
            :disabled="loading || loadingFirmas || loadingKpi"
            @click="cargar"
          >
            <RefreshCw
              class="h-3.5 w-3.5"
              :class="loading || loadingKpi ? 'animate-spin' : ''"
              aria-hidden="true"
            />
            Actualizar
          </Button>
        </div>
      </div>

      <!-- Embudo compacto -->
      <div
        v-if="embudoEtapas.length > 0 || loadingKpi"
        class="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          v-for="item in embudoEtapas"
          :key="item.etapa"
          class="flex shrink-0 items-baseline gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5"
        >
          <span class="text-[11px] text-muted-foreground">{{ item.label }}</span>
          <span class="text-sm font-semibold tabular-nums">{{ item.count }}</span>
        </div>
        <p v-if="loadingKpi && !kpi" class="text-xs text-muted-foreground self-center">
          Cargando embudo…
        </p>
      </div>

      <Tabs v-model="panelPrincipal">
        <TabsList class="h-9">
          <TabsTrigger value="casos" class="cursor-pointer gap-1.5">
            Cola
            <Badge
              v-if="conteosCola.pendientes > 0"
              variant="secondary"
              class="ml-0.5 h-5 min-w-5 px-1.5 tabular-nums"
            >
              {{ conteosCola.pendientes }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="firmas" class="cursor-pointer gap-1.5">
            Firmas
            <Badge
              v-if="firmasPendientesCount > 0"
              variant="secondary"
              class="ml-0.5 h-5 min-w-5 px-1.5 tabular-nums"
            >
              {{ firmasPendientesCount }}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- Panel casos -->
    <template v-if="panelPrincipal === 'casos'">
      <Card class="border-border/80 shadow-sm">
        <CardContent class="space-y-4 pt-4">
          <Tabs v-model="filtroTipo">
            <TabsList class="flex h-auto flex-wrap">
              <TabsTrigger value="todos" class="cursor-pointer">Todos</TabsTrigger>
              <TabsTrigger value="CONVENIO_CERTIFICADO" class="cursor-pointer">
                Certificado
              </TabsTrigger>
              <TabsTrigger value="CAE_RESOLUCION" class="cursor-pointer">CAE</TabsTrigger>
              <TabsTrigger value="ESTATAL_MINEDUC" class="cursor-pointer">Ministerial</TabsTrigger>
              <TabsTrigger value="APODERADO_DATOS" class="cursor-pointer">Apoderado</TabsTrigger>
              <TabsTrigger value="TYC_RECHAZO" class="cursor-pointer">TyC</TabsTrigger>
            </TabsList>
          </Tabs>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              class="cursor-pointer"
              :variant="filtroCola === 'pendientes' ? 'default' : 'outline'"
              @click="filtroCola = 'pendientes'"
            >
              Pendientes
              <span class="ml-1.5 tabular-nums opacity-80">{{ conteosCola.pendientes }}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              class="cursor-pointer"
              :variant="filtroCola === 'resueltos' ? 'default' : 'outline'"
              @click="filtroCola = 'resueltos'"
            >
              Resueltos
              <span class="ml-1.5 tabular-nums opacity-80">{{ conteosCola.resueltos }}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              class="cursor-pointer"
              :variant="filtroCola === 'todos' ? 'default' : 'outline'"
              @click="filtroCola = 'todos'"
            >
              Todos
              <span class="ml-1.5 tabular-nums opacity-80">{{ conteosCola.todos }}</span>
            </Button>
            <div class="relative ml-auto w-full sm:w-64">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                v-model="busqueda"
                class="pl-8"
                placeholder="RUT, nombre o codcli"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="border-border/80 shadow-sm">
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-10"></TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead class="hidden md:table-cell">Carrera</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead class="hidden lg:table-cell">Título</TableHead>
                <TableHead class="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in filasVisibles"
                :key="row.id"
                class="cursor-pointer transition-colors duration-200 hover:bg-muted/50"
                @click="abrirDetalle(row)"
              >
                <TableCell class="pr-0">
                  <component
                    :is="iconoTipo(row.tipo)"
                    class="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </TableCell>
                <TableCell>
                  <div class="font-medium leading-tight">
                    {{ row.nombre_alumno ?? row.codcli }}
                  </div>
                  <div class="font-mono text-xs text-muted-foreground">
                    {{ row.rut_alumno ?? '—' }}
                  </div>
                </TableCell>
                <TableCell class="hidden max-w-[14rem] truncate md:table-cell" :title="row.carrera ?? undefined">
                  {{ row.carrera ?? '—' }}
                </TableCell>
                <TableCell>{{ etiquetasTipo[row.tipo] ?? row.tipo }}</TableCell>
                <TableCell>
                  <Badge variant="outline" :class="claseBadgeEstado(row.estado)">
                    {{ etiquetaEstado(row.estado) }}
                  </Badge>
                </TableCell>
                <TableCell class="hidden max-w-[12rem] truncate lg:table-cell" :title="row.titulo">
                  {{ row.titulo }}
                </TableCell>
                <TableCell class="text-right" @click.stop>
                  <Button
                    v-if="row.tipo === 'APODERADO_DATOS' && row.estado === 'EN_REVISION'"
                    type="button"
                    size="sm"
                    class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
                    :disabled="actualizandoApoderado"
                    @click="actualizarDatosApoderado(row)"
                  >
                    {{ actualizandoApoderado ? '…' : 'Datos actualizados' }}
                  </Button>
                  <Button
                    v-else
                    type="button"
                    size="sm"
                    variant="ghost"
                    class="cursor-pointer"
                    @click="abrirDetalle(row)"
                  >
                    Ver
                  </Button>
                </TableCell>
              </TableRow>

              <TableRow v-if="loading">
                <TableCell colspan="7" class="py-10 text-center text-sm text-muted-foreground">
                  Cargando casos…
                </TableCell>
              </TableRow>

              <TableRow v-else-if="filasVisibles.length === 0">
                <TableCell colspan="7" class="py-12">
                  <div class="flex flex-col items-center gap-3 text-center">
                    <div
                      class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      <CheckCircle2
                        v-if="filtroCola === 'pendientes'"
                        class="h-6 w-6"
                        aria-hidden="true"
                      />
                      <Inbox v-else class="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                      <p class="font-medium">{{ emptyStateCopy.titulo }}</p>
                      <p class="mt-1 text-sm text-muted-foreground">
                        {{ emptyStateCopy.detalle }}
                      </p>
                    </div>
                    <Button
                      v-if="emptyStateCopy.cta"
                      type="button"
                      size="sm"
                      variant="outline"
                      class="cursor-pointer"
                      @click="verResueltos"
                    >
                      {{ emptyStateCopy.cta }}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- Panel firmas -->
    <template v-else>
      <Card class="border-border/80 shadow-sm">
        <CardHeader class="space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle class="text-base">Firmas de contrato</CardTitle>
              <CardDescription>
                Periodo {{ periodoDefault }}. Pendiente = enviada sin cerrar; finalizada = todas
                listas.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              class="cursor-pointer"
              @click="irAGestionFirmas"
            >
              Abrir gestión de firmas
            </Button>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <Tabs v-model="filtroFirmaEstado">
              <TabsList class="flex h-auto flex-wrap">
                <TabsTrigger value="pendiente" class="cursor-pointer">Pendiente</TabsTrigger>
                <TabsTrigger value="finalizada" class="cursor-pointer">Finalizada</TabsTrigger>
                <TabsTrigger value="todos" class="cursor-pointer">Todas</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input
              v-model="busquedaFirmas"
              class="w-64"
              placeholder="Buscar RUT, nombre o codcli"
            />
          </div>
        </CardHeader>
        <CardContent class="p-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alumno</TableHead>
                <TableHead class="hidden md:table-cell">Carrera</TableHead>
                <TableHead>N° operación</TableHead>
                <TableHead>Quién falta</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in firmasVisibles" :key="row.num_operacion">
                <TableCell>
                  <div class="font-medium leading-tight">
                    {{ row.nombre ?? row.codcli ?? '—' }}
                  </div>
                  <div class="font-mono text-xs text-muted-foreground">
                    {{ row.rut ?? '—' }}
                  </div>
                </TableCell>
                <TableCell class="hidden md:table-cell">{{ row.carrera ?? '—' }}</TableCell>
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
                <TableCell colspan="5" class="py-10 text-center text-muted-foreground">
                  Sin firmas en este filtro.
                </TableCell>
              </TableRow>
              <TableRow v-if="loadingFirmas">
                <TableCell colspan="5" class="py-10 text-center text-muted-foreground">
                  Cargando firmas…
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>

    <!-- Drawer detalle -->
    <Sheet :open="detalleOpen" @update:open="onDetalleOpenChange">
      <SheetContent side="right" class="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader class="space-y-2 text-left">
          <div class="flex items-center gap-2">
            <component
              :is="seleccionado ? iconoTipo(seleccionado.tipo) : Inbox"
              class="h-5 w-5 shrink-0 text-uniacc-orange"
              aria-hidden="true"
            />
            <SheetTitle class="leading-snug">
              {{ seleccionado?.titulo ?? 'Detalle del caso' }}
            </SheetTitle>
          </div>
          <SheetDescription v-if="seleccionado">
            <span class="font-mono">{{ seleccionado.rut_alumno }}</span>
            · {{ seleccionado.nombre_alumno ?? seleccionado.codcli }}
            <span class="block truncate" :title="seleccionado.carrera ?? undefined">
              {{ seleccionado.carrera ?? '—' }} · {{ seleccionado.jornada ?? '—' }}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div v-if="seleccionado" class="mt-6 flex flex-1 flex-col gap-4 px-1 pb-4">
          <Badge
            variant="outline"
            class="w-fit"
            :class="claseBadgeEstado(seleccionado.estado)"
          >
            {{ etiquetaEstado(seleccionado.estado) }}
          </Badge>

          <p class="text-sm leading-relaxed text-foreground/90">
            {{ seleccionado.detalle }}
          </p>
          <p v-if="seleccionado.motivo" class="text-sm text-red-700">
            Motivo: {{ seleccionado.motivo }}
          </p>

          <!-- Apoderado: al abrir vs actual MOL -->
          <div
            v-if="seleccionado.tipo === 'APODERADO_DATOS'"
            class="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Al abrir el caso
            </p>
            <dl class="space-y-2">
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Nombre</dt>
                <dd class="text-right font-medium">
                  {{ payloadTexto(seleccionado, 'apoderadoNombre') || '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Teléfono</dt>
                <dd class="text-right font-medium">
                  {{ payloadTexto(seleccionado, 'apoderadoTelefono') || '—' }}
                </dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted-foreground">Email</dt>
                <dd class="text-right font-medium">
                  {{ payloadTexto(seleccionado, 'apoderadoEmail') || '—' }}
                </dd>
              </div>
            </dl>

            <div class="border-t border-border/60 pt-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actual en MOL
              </p>
              <p v-if="loadingPlanApoderado" class="mt-2 text-muted-foreground">Cargando…</p>
              <dl v-else-if="planApoderado" class="mt-2 space-y-2">
                <div class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Nombre</dt>
                  <dd class="text-right font-medium">{{ apoderadoActualNombre }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Teléfono</dt>
                  <dd class="text-right font-medium">{{ apoderadoActualTel }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Email</dt>
                  <dd class="text-right font-medium">{{ apoderadoActualMail }}</dd>
                </div>
              </dl>
              <p v-else class="mt-2 text-muted-foreground">
                Sin fila en plan de pagos para este codcli.
              </p>
            </div>

            <div
              v-if="apoderadoRefrescado"
              class="rounded-md border border-emerald-200 bg-emerald-50/80 p-2 text-emerald-800"
            >
              <p class="font-medium">Última lectura ERP</p>
              <p>{{ apoderadoRefrescado.nombre }}</p>
              <p class="text-xs">
                {{ apoderadoRefrescado.telefono }} · {{ apoderadoRefrescado.email }}
              </p>
            </div>
          </div>

          <a
            v-if="urlArchivo"
            :href="urlArchivo"
            target="_blank"
            rel="noreferrer"
            class="text-sm font-medium text-uniacc-orange underline underline-offset-2"
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
          </template>

          <p
            v-else-if="
              seleccionado.tipo !== 'APODERADO_DATOS' &&
              seleccionado.tipo !== 'CONVENIO_CERTIFICADO' &&
              ESTADOS_PENDIENTES.includes(seleccionado.estado)
            "
            class="text-sm text-muted-foreground"
          >
            Este tipo se lista para seguimiento. La resolución detallada se suma en una siguiente
            iteración.
          </p>

          <p
            v-else-if="ESTADOS_RESUELTOS.includes(seleccionado.estado)"
            class="text-sm text-muted-foreground"
          >
            Caso ya resuelto. Queda en el historial para consulta.
          </p>
        </div>

        <SheetFooter
          v-if="seleccionado"
          class="mt-auto flex-row flex-wrap gap-2 border-t pt-4 sm:justify-start"
        >
          <template
            v-if="
              seleccionado.tipo === 'APODERADO_DATOS' && seleccionado.estado === 'EN_REVISION'
            "
          >
            <Button
              type="button"
              class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
              :disabled="actualizandoApoderado || resolviendo"
              @click="actualizarDatosApoderado()"
            >
              {{ actualizandoApoderado ? 'Actualizando…' : 'Datos actualizados' }}
            </Button>
          </template>
          <template
            v-else-if="
              seleccionado.tipo === 'CONVENIO_CERTIFICADO' &&
              seleccionado.estado === 'EN_REVISION'
            "
          >
            <Button
              type="button"
              class="cursor-pointer"
              :disabled="resolviendo"
              @click="resolver('APROBADO')"
            >
              Aprobar
            </Button>
            <Button
              type="button"
              variant="outline"
              class="cursor-pointer"
              :disabled="resolviendo"
              @click="resolver('RECHAZADO')"
            >
              Rechazar
            </Button>
          </template>
          <Button
            type="button"
            variant="ghost"
            class="cursor-pointer"
            @click="onDetalleOpenChange(false)"
          >
            Cerrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
