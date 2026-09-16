<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from '@/components/ui/dialog'
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
import ConvenioVigenteUpload from '@/components/rematricula/ConvenioVigenteUpload.vue'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { tieneCae } from '@/constants/verificacionCae'
import { abrirCasoRematricula } from '@/services/casoRematriculaApi'
import {
  consultarCarteraBeneficios,
  PERIODO_CARTERA_BENEFICIOS,
} from '@/services/carteraBeneficiosApi'
import { detectarConveniosAlumno } from '@/services/convenioAlumno'
import { fmtMontoClp, fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { ejecutarVerificacionCae } from '@/services/verificacionCae'
import { registrarFormaPagoAudit } from '@/services/formaPagoAuditLog'
import {
  flagsConsolidado,
  itemsBeneficioDesdeCartera,
  type BeneficioExcelUiItem,
  type CarteraBeneficioRow,
} from '@/utils/carteraBeneficiosUi'
import { periodoCatalogoLabel } from '@/utils/periodoCatalogo'
import { rutNorm } from '@/utils/rutNorm'
import { useConvenioInstitucionalStore } from '@/stores/convenioInstitucional'
import { usePa08MtArancelSelMatriculaNetStore } from '@/stores/datos_erp/pa08_MT_ARANCEL_sel_MATRICULA_NET'
import { useSpAlumnoDeudaNetStore } from '@/stores/datos_erp/sp_alumno_deuda_net'
import { useSpListaDocpagMatriculaCajaArancelStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_arancel'
import { useSpListaDocpagMatriculaCajaMatriculaStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_matricula'
import { useErpSpAmbienteStore } from '@/stores/erpSpAmbiente'
import {
  useMockMatriculaContextStore,
  type MockConvenioDocumento,
  type MockPagoMatricula,
  type MockPagoMatriculaMedio,
} from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import MatriculaMockVerificacionCaeStep from '@/views/matricula-mock/MatriculaMockVerificacionCaeStep.vue'
import type { PlanPagosMvRow } from '@/types/supabase'

const router = useRouter()
const mockCtx = useMockMatriculaContextStore()
const periodoActivo = usePeriodoActivoStore()
const erpSpAmbiente = useErpSpAmbienteStore()
const { label: periodoActivoLabel } = storeToRefs(periodoActivo)
const { badgeText: erpSpBadgeText, isTest: erpSpIsTest } = storeToRefs(erpSpAmbiente)
const { pagoMatricula } = storeToRefs(mockCtx)
const fuente = useMockAlumnoFuente()
const { nombreMostrado, codcliMostrado, rutMostrado } = fuente
const convenioStore = useConvenioInstitucionalStore()
const arancelSp = usePa08MtArancelSelMatriculaNetStore()
const docpagMatricula = useSpListaDocpagMatriculaCajaMatriculaStore()
const docpagArancel = useSpListaDocpagMatriculaCajaArancelStore()
const deudaNet = useSpAlumnoDeudaNetStore()
const { loading: cargandoArancelSp, error: errorArancelSp, paramsUsados: paramsUsadosSp } =
  storeToRefs(arancelSp)
const { docs: docsPagoMatricula } = storeToRefs(docpagMatricula)
const { docs: docsPagoArancel } = storeToRefs(docpagArancel)
const { loading: cargandoDeuda, tieneDeuda, deudaValor } = storeToRefs(deudaNet)

const deudaModalOpen = ref(false)
const pagoMatriculaDialogOpen = ref(false)
/** 'selector' | 'pagare' */
const pagoMatriculaPaso = ref<'selector' | 'pagare'>('selector')
const pagareDiaVencimiento = ref<string>('5')
const pagareFechaInicio = ref('')
const abriendoPagoMatricula = ref(false)

function hoyIsoLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Día D (5|15|25) del mes siguiente a `desde` (siempre mes+1).
 */
function proximaFechaDiaVencimiento(dia: 5 | 15 | 25, desde = new Date()): string {
  const candidato = new Date(desde.getFullYear(), desde.getMonth() + 1, dia)
  return hoyIsoLocal(candidato)
}

function diaVencimientoActual(): 5 | 15 | 25 {
  const n = Number(pagareDiaVencimiento.value)
  if (n === 15 || n === 25) return n
  return 5
}

function sincronizarFechaInicioConDiaVencimiento() {
  pagareFechaInicio.value = proximaFechaDiaVencimiento(diaVencimientoActual())
  invalidarCuotasGeneradas()
}

watch(pagareDiaVencimiento, () => {
  sincronizarFechaInicioConDiaVencimiento()
})

watch(pagareFechaInicio, () => {
  invalidarCuotasGeneradas()
})

const pagareFechaInicioMin = computed(() =>
  proximaFechaDiaVencimiento(diaVencimientoActual()),
)

type CuotaPagarePreview = {
  documento: 'PAGARÉ'
  correlativo: string
  vencimiento: string
  monto: number
  totalAcumulado: number
  items: 'MATRICULA'
  cuota: number
  totalCuotas: 10
  idDocumento: 5
  seleccionado: boolean
}

const pagareCuotasPreview = ref<CuotaPagarePreview[]>([])

function invalidarCuotasGeneradas() {
  if (pagareCuotasPreview.value.length > 0) {
    pagareCuotasPreview.value = []
  }
}

function addMonthsSameDay(isoYmd: string, months: number): string {
  const [y, m, d] = isoYmd.split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return hoyIsoLocal(dt)
}

function generarCuotasPagare() {
  const fecha = pagareFechaInicio.value
  const dia = diaVencimientoActual()
  const hoy = hoyIsoLocal()
  if (!fecha || fecha < hoy) {
    toast.error('Fecha de inicio inválida')
    sincronizarFechaInicioConDiaVencimiento()
    return
  }
  if (Number(fecha.slice(8, 10)) !== dia) {
    toast.error(`La fecha de inicio debe caer el día ${dia}`)
    sincronizarFechaInicioConDiaVencimiento()
    return
  }

  const montoTotal = montoNetoMatricula()
  const n = 10
  const baseCuota = Math.floor(montoTotal / n)
  const seed = Date.now()
  const rows: CuotaPagarePreview[] = []
  let acumulado = 0
  for (let i = 1; i <= n; i++) {
    const monto = i === n ? montoTotal - acumulado : baseCuota
    acumulado += monto
    rows.push({
      documento: 'PAGARÉ',
      correlativo: `MOCK${seed}${String(i).padStart(2, '0')}`,
      vencimiento: addMonthsSameDay(fecha, i - 1),
      monto,
      totalAcumulado: acumulado,
      items: 'MATRICULA',
      cuota: i,
      totalCuotas: 10,
      idDocumento: 5,
      seleccionado: true,
    })
  }
  pagareCuotasPreview.value = rows
  console.log('[forma-pago] cuotas pagaré generadas (mock)', rows)
  toast.success('Cuotas generadas (correlativo provisional)')
}

const resumenPagoMatricula = computed(() => {
  const p = pagoMatricula.value
  if (!p) return null
  if (p.medio === 'pagare') {
    return `Pagaré · ${p.cuotas} cuotas · día ${p.diaVencimiento} · desde ${p.fechaInicio}`
  }
  return `${p.nombre} (simulado)`
})

/** Badge ERP SP: prioriza echo del API; si no, flag del mantenedor. */
const erpSpBadge = computed(() => {
  const amb = paramsUsadosSp.value?.ambiente
  if (amb === 'test') return 'ERP SP: TEST'
  if (amb === 'prod') return 'ERP SP: PROD'
  return erpSpBadgeText.value
})
const erpSpBadgeEsTest = computed(() => {
  const amb = paramsUsadosSp.value?.ambiente
  if (amb === 'test') return true
  if (amb === 'prod') return false
  return erpSpIsTest.value
})

/** Params que se envían / se enviaron al SP (para depuración en pantalla). */
const paramsErpPantalla = computed(() => {
  const usados = paramsUsadosSp.value
  if (usados) {
    return [
      { sp: '@CODCARR', valor: usados.codCarr, origen: 'cod_carrera' },
      { sp: '@ANO', valor: String(usados.ano), origen: 'anio_matricula' },
      { sp: '@ANOINI', valor: String(usados.anoIni), origen: 'ano_ingreso' },
      {
        sp: '@FECMOD',
        valor: usados.fecMod ?? '—',
        origen: "servidor (YYYY-MM-DDTHH:mm:ss)",
      },
      { sp: '@PERIODO', valor: String(usados.periodo), origen: 'periodo_matricula' },
      { sp: '@CATALUMNO', valor: usados.catAlumno, origen: 'categoria_alumno' },
      { sp: '@JORNADA', valor: usados.jornada, origen: 'jornada_carrera' },
    ]
  }
  const p = plan.value
  if (!p) return []
  return [
    { sp: '@CODCARR', valor: (p.cod_carrera ?? '—').trim() || '—', origen: 'cod_carrera' },
    {
      sp: '@ANO',
      valor: p.anio_matricula != null ? String(p.anio_matricula) : '—',
      origen: 'anio_matricula',
    },
    {
      sp: '@ANOINI',
      valor: p.ano_ingreso != null ? String(p.ano_ingreso) : '—',
      origen: 'ano_ingreso',
    },
    { sp: '@FECMOD', valor: '(lo define la API)', origen: 'servidor' },
    {
      sp: '@PERIODO',
      valor: p.periodo_matricula != null ? String(p.periodo_matricula) : '—',
      origen: 'periodo_matricula',
    },
    {
      sp: '@CATALUMNO',
      valor: p.categoria_alumno != null ? String(p.categoria_alumno) : '—',
      origen: 'categoria_alumno',
    },
    {
      sp: '@JORNADA',
      valor: (p.jornada_carrera ?? '—').trim().toUpperCase() || '—',
      origen: 'jornada_carrera',
    },
  ]
})

type SubPaso = 'verificacion-cae' | 'becas' | 'pago'
const subPaso = ref<SubPaso>('becas')

const fmt = fmtMontoClp

/** YYYY-MM-DD → DD/MM/YYYY para la grilla. */
function fmtFechaCuota(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}
const plan = computed(() => mockCtx.selectedPlanPagos)

const verificandoCae = ref(false)
const reintentandoCae = ref(false)

const carteraBeneficiosRow = ref<CarteraBeneficioRow | null>(null)
const cargandoCarteraBeneficios = ref(false)
const errorCarteraBeneficios = ref<string | null>(null)

const beneficios = computed((): BeneficioExcelUiItem[] =>
  itemsBeneficioDesdeCartera(carteraBeneficiosRow.value),
)

const flagsConsolidadoUi = computed(() =>
  flagsConsolidado(carteraBeneficiosRow.value?.consolidado ?? null),
)

const periodoBeneficioLabel = computed(
  () => carteraBeneficiosRow.value?.periodo ?? PERIODO_CARTERA_BENEFICIOS,
)

const beneficiosSeleccionados = ref<Record<number, boolean>>({})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

const conveniosDetectados = computed(() =>
  detectarConveniosAlumno(plan.value, convenioStore.rows),
)

const conveniosVigentes = computed(() =>
  conveniosDetectados.value.filter((m) => m.esVigente),
)

const conveniosVigentesPendientes = computed(() =>
  conveniosVigentes.value.filter((m) => !mockCtx.conveniosDocumentos[m.convenio.id]),
)

const contextoConvenio = computed<ContextoMolAuditoriaOpciones>(() => ({
  rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
  codcli: pickCampoAlumno(fuente.codcliMostrado.value),
  nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
  anioPeriodo: periodoActivo.anio,
  semestrePeriodo: periodoActivo.semestre,
  esMock: mockCtx.tieneAlumnoSeleccionado,
}))

async function onConvenioSubido(payload: {
  convenioId: string
  doc: MockConvenioDocumento
  documentoId?: string | null
}) {
  mockCtx.setConvenioDocumento(payload.convenioId, payload.doc)
  const refId = payload.documentoId?.trim() || payload.doc.storagePath?.trim()
  if (!refId) {
    toast.error('No se pudo abrir el caso: el documento no tiene una referencia válida.')
    return
  }
  const ctx = contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli: pickCampoAlumno(fuente.codcliMostrado.value),
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: mockCtx.tieneAlumnoSeleccionado,
  })
  const anio = ctx.anioPeriodo
  const sem = ctx.semestrePeriodo
  if (!ctx.codcli || anio == null || sem == null) return
  const match = conveniosDetectados.value.find((m) => m.convenio.id === payload.convenioId)
  await abrirCasoRematricula({
    periodo: periodoCatalogoLabel(anio, sem),
    tipo: 'CONVENIO_CERTIFICADO',
    estado: 'EN_REVISION',
    codcli: ctx.codcli,
    rutAlumno: ctx.rutAlumno,
    nombreAlumno: ctx.nombreAlumno,
    carrera: (plan.value?.carrera ?? plan.value?.nombre_carrera ?? '').trim() || undefined,
    jornada: (plan.value?.jornada_carrera ?? '').trim() || undefined,
    titulo: 'Certificado de convenio en revisión',
    detalle: 'El alumno subió el documento de vigencia del convenio.',
    refTipo: 'convenio_documento',
    refId,
    esMock: ctx.esMock,
    payload: {
      convenio_id: payload.convenioId,
      storage_path: payload.doc.storagePath,
      codigo_beneficio: match?.convenio.codigo_beneficio ?? null,
    },
  })
}

function onConvenioEliminado(payload: { convenioId: string }) {
  mockCtx.removeConvenioDocumento(payload.convenioId)
}

function initBeneficiosSeleccionados() {
  const sel: Record<number, boolean> = {}
  beneficios.value.forEach((b) => {
    if (!b.sinMapear) sel[b.slot] = true
  })
  beneficiosSeleccionados.value = sel
}

async function cargarCarteraBeneficios() {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const rut = pickCampoAlumno(fuente.rutMostrado.value)
  if (!codcli && !rut) {
    carteraBeneficiosRow.value = null
    errorCarteraBeneficios.value = null
    initBeneficiosSeleccionados()
    return
  }

  cargandoCarteraBeneficios.value = true
  errorCarteraBeneficios.value = null
  try {
    const { data, error } = await consultarCarteraBeneficios({
      periodo: PERIODO_CARTERA_BENEFICIOS,
      codcliExcel: codcli,
      rutNorm: rut ? rutNorm(rut) : null,
    })
    if (error) {
      errorCarteraBeneficios.value = error
      carteraBeneficiosRow.value = null
    } else {
      carteraBeneficiosRow.value = data
    }
  } finally {
    cargandoCarteraBeneficios.value = false
  }
  initBeneficiosSeleccionados()
}

watch([codcliMostrado, rutMostrado], () => {
  void cargarCarteraBeneficios()
})

async function correrVerificacionCae(reintento = false) {
  const p = plan.value
  if (!p || !tieneCae(p)) {
    subPaso.value = 'becas'
    return
  }

  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const semestre = periodoActivo.semestre
  if (!codcli || anio == null || semestre == null) {
    toast.error('No se pudo verificar CAE: faltan codcli o periodo activo.')
    subPaso.value = 'becas'
    return
  }

  if (reintento) {
    reintentandoCae.value = true
  } else {
    verificandoCae.value = true
    subPaso.value = 'verificacion-cae'
  }

  const ctx = contextoMolAuditoria({
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    codcli,
    nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
    anioPeriodo: anio,
    semestrePeriodo: semestre,
    esMock: mockCtx.tieneAlumnoSeleccionado,
  })

  try {
    const { data, error } = await ejecutarVerificacionCae({
      codcli,
      anioPeriodo: anio,
      semestrePeriodo: semestre,
      sesionId: ctx.sesionId,
      rutAlumno: ctx.rutAlumno,
      nombreAlumno: ctx.nombreAlumno,
      periodoLabel: ctx.periodoLabel,
      esMock: ctx.esMock,
      urlOrigen: ctx.urlOrigen,
    })

    if (error || !data) {
      console.warn('[verificacionCae]', error)
      toast.error('No se pudo verificar CAE. Intenta de nuevo.')
      subPaso.value = 'verificacion-cae'
      return
    }

    mockCtx.setVerificacionCae({ resultado: data.resultado })

    if (data.resultado === 'continua') {
      subPaso.value = 'becas'
      return
    }

    subPaso.value = 'verificacion-cae'
  } finally {
    verificandoCae.value = false
    reintentandoCae.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    periodoActivo.ensureLoaded(),
    convenioStore.ensureLoaded(),
    erpSpAmbiente.ensureLoaded(),
    docpagMatricula.ensureLoaded(),
    docpagArancel.ensureLoaded(),
    cargarCarteraBeneficios(),
  ])

  let p = plan.value
  if (!p) return

  p = await refrescarPlanSiFaltanParamsErp(p)

  await Promise.all([cargarArancelDesdeErp(p), precargarDeudaSiHayRut()])

  if (!tieneCae(p)) {
    subPaso.value = 'becas'
    return
  }

  if (mockCtx.verificacionCae?.resultado === 'continua') {
    subPaso.value = 'becas'
    return
  }

  if (mockCtx.verificacionCae?.resultado === 'pendiente_resolucion') {
    subPaso.value = 'verificacion-cae'
    return
  }

  await correrVerificacionCae()
})

function camposFaltantesErp(p: PlanPagosMvRow): string[] {
  const faltan: string[] = []
  if (!(p.cod_carrera ?? '').trim()) faltan.push('cod_carrera')
  if (!(p.jornada_carrera ?? '').trim()) faltan.push('jornada_carrera')
  if (p.anio_matricula == null) faltan.push('anio_matricula')
  if (p.ano_ingreso == null) faltan.push('ano_ingreso')
  if (p.periodo_matricula == null) faltan.push('periodo_matricula')
  if (p.categoria_alumno == null || !Number.isFinite(Number(p.categoria_alumno))) {
    faltan.push('categoria_alumno')
  }
  return faltan
}

/**
 * Si la fila en sessionStorage es anterior al sync de jornada_carrera,
 * la relee desde v_mnp_mv_plan_pagos sin reiniciar el flujo mock.
 */
async function refrescarPlanSiFaltanParamsErp(p: PlanPagosMvRow): Promise<PlanPagosMvRow> {
  const faltan = camposFaltantesErp(p)
  if (faltan.length === 0) return p
  if (!p.codcli?.trim()) return p

  const { data, error } = await fetchPlanPagosMvByCodcli({
    codcli: p.codcli,
    anioMatricula: p.anio_matricula,
    periodoMatricula: p.periodo_matricula,
  })
  if (error || !data) {
    console.warn('[forma-pago] no se pudo refrescar plan:', error)
    return p
  }
  mockCtx.patchSelectedPlanPagos(data)
  return data
}

function paramsDesdePlan(p: PlanPagosMvRow): {
  codCarr: string
  ano: number
  anoIni: number
  periodo: number
  catAlumno: string
  jornada: string
} | null {
  const faltan = camposFaltantesErp(p)
  if (faltan.length > 0) return null

  return {
    codCarr: (p.cod_carrera ?? '').trim(),
    ano: p.anio_matricula as number,
    anoIni: p.ano_ingreso as number,
    periodo: p.periodo_matricula as number,
    catAlumno: String(p.categoria_alumno),
    jornada: (p.jornada_carrera ?? '').trim().toUpperCase(),
  }
}

async function cargarArancelDesdeErp(p: PlanPagosMvRow) {
  const params = paramsDesdePlan(p)
  if (!params) {
    arancelSp.reset()
    const faltan = camposFaltantesErp(p)
    toast.error(
      `Faltan datos para consultar arancel en ERP: ${faltan.join(', ') || 'desconocidos'}.`,
    )
    return
  }

  const ok = await arancelSp.fetchFromErp(params)
  if (!ok) {
    toast.error(arancelSp.error || 'No se pudo obtener matrícula/arancel desde el ERP.')
  }
}

function montoBrutoMatricula(): number {
  return arancelSp.montoMatricula
}

function montoBrutoArancel(): number {
  return arancelSp.montoArancel
}

function montoBecaMatricula(): number {
  return Number(plan.value?.beca_matricula ?? 0)
}

function montoBecaArancel(): number {
  return Number(plan.value?.beca_arancel ?? 0)
}

// Regla de negocio: los beneficios/convenios SIEMPRE se aplican sobre el
// arancel, nunca sobre la matrícula. Por eso consolidamos beca_matricula +
// beca_arancel y los descontamos del arancel; la matrícula queda a valor pleno.
function montoBeneficiosArancel(): number {
  return montoBecaMatricula() + montoBecaArancel()
}

function montoNetoMatricula(): number {
  return Math.max(0, montoBrutoMatricula())
}

function montoNetoArancel(): number {
  return Math.max(0, montoBrutoArancel() - montoBeneficiosArancel())
}

const puedeAbrirPagoMatricula = computed(() => {
  const monto = montoNetoMatricula()
  const rut = rutMostrado.value
  const tieneRut = !!rut && rut !== '—'
  return (
    monto > 0 &&
    tieneRut &&
    !cargandoDeuda.value &&
    !tieneDeuda.value &&
    !abriendoPagoMatricula.value
  )
})

const valorCuotaPagare = computed(() => {
  const monto = montoNetoMatricula()
  return Math.round(monto / 10)
})

async function precargarDeudaSiHayRut() {
  const rut = rutMostrado.value
  if (!rut || rut === '—') return
  if (deudaNet.data != null || deudaNet.error) return
  await deudaNet.fetchFromErp(rut)
}

async function abrirPagoMatricula() {
  abriendoPagoMatricula.value = true
  try {
    const rut = rutMostrado.value
    if (!rut || rut === '—') {
      toast.error('Sin RUT para validar deuda / pagar matrícula')
      return
    }
    if (deudaNet.data == null) {
      await deudaNet.fetchFromErp(rut)
    }
    console.log('[forma-pago] gate deuda antes de pagar matrícula', {
      tieneDeuda: deudaNet.tieneDeuda,
      deuda: deudaNet.deudaValor,
      data: deudaNet.data,
    })
    if (deudaNet.tieneDeuda) {
      deudaModalOpen.value = true
      return
    }
    pagoMatriculaPaso.value = 'selector'
    pagareDiaVencimiento.value = '5'
    sincronizarFechaInicioConDiaVencimiento()
    pagoMatriculaDialogOpen.value = true
  } finally {
    abriendoPagoMatricula.value = false
  }
}

function cerrarPagoMatriculaDialog() {
  pagoMatriculaDialogOpen.value = false
  pagoMatriculaPaso.value = 'selector'
  pagareCuotasPreview.value = []
}

function volverSelectorPagoMatricula() {
  pagoMatriculaPaso.value = 'selector'
  pagareCuotasPreview.value = []
}

function onPagoMatriculaDialogOpenChange(open: boolean) {
  if (!open) cerrarPagoMatriculaDialog()
  else pagoMatriculaDialogOpen.value = true
}

function elegirMedioMatricula(medio: MockPagoMatriculaMedio) {
  if (medio === 'pagare') {
    pagoMatriculaPaso.value = 'pagare'
    pagareCuotasPreview.value = []
    sincronizarFechaInicioConDiaVencimiento()
    return
  }
  simularPagoMatricula(medio)
}

function simularPagoMatricula(medio: 'webpay' | 'toku') {
  const monto = montoNetoMatricula()
  const nombre = medio === 'webpay' ? 'WebPay' : 'TOKU'
  const payload: MockPagoMatricula = {
    medio,
    nombre,
    monto,
    simulado: true,
  }
  console.log('[forma-pago] pagoMatricula simulado', payload)
  mockCtx.setPagoMatricula(payload)
  toast.success(`Pago matrícula simulado vía ${nombre}`)
  cerrarPagoMatriculaDialog()
}

async function confirmarPagareMatricula() {
  const hoy = hoyIsoLocal()
  const fecha = pagareFechaInicio.value
  const dia = Number(pagareDiaVencimiento.value)
  if (dia !== 5 && dia !== 15 && dia !== 25) {
    toast.error('Selecciona día de vencimiento 5, 15 o 25')
    return
  }
  if (!fecha || fecha < hoy) {
    toast.error('La fecha de inicio no puede ser anterior a hoy')
    return
  }
  const diaMes = Number(fecha.slice(8, 10))
  if (diaMes !== dia) {
    toast.error(`La fecha de inicio debe caer el día ${dia} del mes`)
    sincronizarFechaInicioConDiaVencimiento()
    return
  }
  if (pagareCuotasPreview.value.length !== 10) {
    toast.error('Debes generar las cuotas antes de confirmar')
    return
  }
  const monto = montoNetoMatricula()
  const montoMat = arancelSp.montoMatricula
  const montoAra = arancelSp.montoArancel
  const nCuotas = 10
  const cuotasDetalle = pagareCuotasPreview.value.map(
    ({ seleccionado: _sel, ...rest }) => rest,
  )
  const payload: MockPagoMatricula = {
    medio: 'pagare',
    tipodoc: '5',
    nombre: 'PAGARÉ',
    cuotas: nCuotas,
    diaVencimiento: dia,
    fechaInicio: fecha,
    monto,
    valorCuota: cuotasDetalle[0]?.monto ?? Math.floor(monto / 10),
    simulado: false,
    cuotasDetalle,
  }
  console.log('[forma-pago] pagoMatricula pagaré', payload)
  mockCtx.setPagoMatricula(payload)

  // Registrar evento de forma de pago confirmada
  await registrarFormaPagoAudit({
    rutAlumno: rutMostrado.value,
    codcli: codcliMostrado.value,
    nombreAlumno: nombreMostrado.value,
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: mockCtx.tieneAlumnoSeleccionado,
    accion: 'confirmado',
    payload: {
      medio: 'pagare',
      cuotas: nCuotas,
      montoMatricula: montoMat,
      montoArancel: montoAra,
      montoTotal: monto,
      simulado: false,
    },
  })

  toast.success('Pago de matrícula (pagaré) configurado')
  cerrarPagoMatriculaDialog()
}

function calcularBecasMock() {
  const items = beneficios.value.filter(
    (b) => b.cod_beneficio && beneficiosSeleccionados.value[b.slot],
  )
  if (items.length === 0) {
    toast.message('Sin beneficios mapeados seleccionados desde Excel.')
    return
  }
  console.log('[forma-pago] becas mock desde Excel', items)
  const lista = items.map((b) => `${b.cod_beneficio} (${b.pct ?? 0}%)`).join(', ')
  toast.success(`Beneficios aplicados (mock): ${lista}`)
}

watch(
  [docsPagoMatricula, docsPagoArancel],
  ([mat, ara]) => {
    console.log('[forma-pago] sp_lista_docpag_matricula_caja DESPLIEGA=M', {
      count: mat.length,
      docs: mat.map((d) => ({ tipodoc: d.tipodoc, nombre: d.nombre, requiereBen: d.requiereBen })),
      params: docpagMatricula.paramsUsados,
    })
    console.log('[forma-pago] sp_lista_docpag_matricula_caja DESPLIEGA=A', {
      count: ara.length,
      docs: ara.map((d) => ({ tipodoc: d.tipodoc, nombre: d.nombre, requiereBen: d.requiereBen })),
      params: docpagArancel.paramsUsados,
    })
  },
  { deep: true },
)

function simularPago(medio: 'webpay' | 'pagare' | 'toku') {
  console.log('[forma-pago] simularPago mock', {
    medio,
    docsMatriculaErp: docsPagoMatricula.value.map((d) => ({
      tipodoc: d.tipodoc,
      nombre: d.nombre,
    })),
    docsArancelErp: docsPagoArancel.value.map((d) => ({
      tipodoc: d.tipodoc,
      nombre: d.nombre,
    })),
    deudaErp: deudaNet.data,
  })
  mockCtx.setFormaPago(medio)
  const labels = { webpay: 'WebPay', pagare: 'Pagaré', toku: 'TOKU' } as const
  toast.success(`Pago simulado vía ${labels[medio]}.`)
  void router.push({ name: 'matricula-mock-firma' })
}

/** Pasa a forma de pago; consulta deuda ERP y muestra modal si corresponde. */
async function irAFormaPago() {
  const rut = rutMostrado.value
  if (rut && rut !== '—') {
    await deudaNet.fetchFromErp(rut)
    console.log('[forma-pago] sp_alumno_deuda_net', {
      rut,
      tieneDeuda: deudaNet.tieneDeuda,
      deuda: deudaNet.deudaValor,
      data: deudaNet.data,
      params: deudaNet.paramsUsados,
      error: deudaNet.error,
    })
    if (deudaNet.tieneDeuda) {
      deudaModalOpen.value = true
    }
  } else {
    console.warn('[forma-pago] sin RUT para consultar deuda')
  }
  subPaso.value = 'pago'
}

function cerrarModalDeuda() {
  deudaModalOpen.value = false
}

function volverDatosPersonales() {
  void router.push({ name: 'matricula-mock-datos' })
}

function anterior() {
  if (subPaso.value === 'pago') {
    subPaso.value = 'becas'
    return
  }
  if (subPaso.value === 'becas') {
    void router.push({ name: 'matricula-mock-datos' })
  }
}

const estadoVerificacionCae = computed((): 'verificando' | 'pendiente' => {
  if (verificandoCae.value || reintentandoCae.value) return 'verificando'
  return 'pendiente'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Verificación CAE (solo alumno_cae = Si) -->
    <MatriculaMockVerificacionCaeStep
      v-if="subPaso === 'verificacion-cae'"
      :estado="estadoVerificacionCae"
      :reintentando="reintentandoCae"
      :periodo-label="periodoActivoLabel"
      :nombre-alumno="nombreMostrado"
      :codcli="codcliMostrado"
      @reintentar="correrVerificacionCae(true)"
      @volver="volverDatosPersonales"
    />

    <!-- V06 Becas y plan -->
    <template v-else-if="subPaso === 'becas'">
      <div
        class="rounded-lg border border-uniacc-orange/30 bg-uniacc-orange/10 px-4 py-3 text-sm text-zinc-800"
      >
        <strong class="text-uniacc-orange">Plan de pagos.</strong>
        Montos de matrícula/arancel desde el SP
        <code class="text-xs">pa08_MT_ARANCEL_sel_MATRICULA_NET</code>
        (on-demand ERP).
      </div>

      <div
        v-if="paramsErpPantalla.length > 0"
        class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800"
      >
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <p class="font-medium text-zinc-700">Parámetros enviados al SP</p>
          <Badge
            :class="
              erpSpBadgeEsTest
                ? 'bg-amber-600 hover:bg-amber-600'
                : 'bg-emerald-700 hover:bg-emerald-700'
            "
          >
            {{ erpSpBadge }}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[140px]">Param SP</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead class="hidden sm:table-cell">Origen consolidado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in paramsErpPantalla" :key="row.sp">
              <TableCell class="font-mono text-xs">{{ row.sp }}</TableCell>
              <TableCell class="font-mono text-xs font-semibold">{{ row.valor }}</TableCell>
              <TableCell class="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                {{ row.origen }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div
        v-if="cargandoArancelSp"
        class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
      >
        Consultando matrícula y arancel en el ERP…
      </div>
      <div
        v-else-if="errorArancelSp"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p>{{ errorArancelSp }}</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3"
          type="button"
          :disabled="!plan"
          @click="plan && cargarArancelDesdeErp(plan)"
        >
          Reintentar
        </Button>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <Card class="shadow-md">
          <CardHeader>
            <CardTitle class="text-lg text-uniacc-orange">Beneficios del alumno</CardTitle>
            <CardDescription>Periodo beneficio: {{ periodoBeneficioLabel }}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <p v-if="cargandoCarteraBeneficios" class="text-sm text-muted-foreground">
              Consultando cartera de beneficios (Excel)…
            </p>
            <p v-else-if="errorCarteraBeneficios" class="text-sm text-red-700">
              {{ errorCarteraBeneficios }}
            </p>
            <Table v-else-if="beneficios.length > 0">
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead class="hidden sm:table-cell">Código</TableHead>
                  <TableHead class="w-[56px] text-right">%</TableHead>
                  <TableHead class="w-[72px] text-center">Sel.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="b in beneficios" :key="b.slot">
                  <TableCell class="text-xs sm:text-sm">
                    {{ b.descripcion || 'Beneficio' }}
                  </TableCell>
                  <TableCell class="hidden sm:table-cell">
                    <span v-if="b.cod_beneficio" class="font-mono text-xs">{{ b.cod_beneficio }}</span>
                    <Badge v-else variant="outline" class="text-[10px]">sin mapear</Badge>
                  </TableCell>
                  <TableCell class="text-right tabular-nums text-xs">
                    {{ b.pct != null ? `${b.pct}%` : '—' }}
                  </TableCell>
                  <TableCell class="text-center">
                    <Checkbox
                      v-if="!b.sinMapear"
                      v-model:checked="beneficiosSeleccionados[b.slot]"
                    />
                    <span v-else class="text-xs text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p v-else class="text-sm text-muted-foreground">
              Sin beneficios en cartera Excel para este alumno.
            </p>
            <p
              v-if="
                !cargandoCarteraBeneficios &&
                (flagsConsolidadoUi.cae ||
                  flagsConsolidadoUi.ministerial ||
                  flagsConsolidadoUi.subdere)
              "
              class="text-xs text-muted-foreground"
            >
              Consolidado:
              <span v-if="flagsConsolidadoUi.cae">CAE</span>
              <span v-if="flagsConsolidadoUi.ministerial">
                {{ flagsConsolidadoUi.cae ? ' · ' : '' }}Ministerial
              </span>
              <span v-if="flagsConsolidadoUi.subdere">
                {{ flagsConsolidadoUi.cae || flagsConsolidadoUi.ministerial ? ' · ' : '' }}SUBDERE
              </span>
            </p>
            <Button variant="secondary" class="w-full" type="button" @click="calcularBecasMock">
              Calcular becas / descuentos
            </Button>
          </CardContent>
        </Card>

        <div class="space-y-4">
          <Card class="border-orange-100 shadow-md">
            <CardHeader class="pb-2">
              <CardTitle class="text-base text-uniacc-orange">Arancel</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div class="flex justify-between gap-2">
                <span>Valor arancel</span>
                <span>{{ fmt(montoBrutoArancel()) }}</span>
              </div>
              <div v-if="montoBeneficiosArancel() > 0" class="flex justify-between gap-2 text-green-700">
                <span>Beneficios arancel</span>
                <span>− {{ fmt(montoBeneficiosArancel()) }}</span>
              </div>
              <div
                class="mt-3 flex justify-between border-t border-uniacc-orange/30 pt-3 text-base font-bold text-uniacc-orange"
              >
                <span>Total arancel por pagar</span>
                <span>{{ fmt(montoNetoArancel()) }}</span>
              </div>
            </CardContent>
          </Card>

          <Card class="border-orange-100 shadow-md">
            <CardHeader class="pb-2">
              <CardTitle class="text-base text-uniacc-orange">Matrícula</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div class="flex justify-between gap-2">
                <span>Valor matrícula</span>
                <span>{{ fmt(montoBrutoMatricula()) }}</span>
              </div>
              <div
                class="mt-3 flex justify-between border-t border-uniacc-orange/30 pt-3 text-base font-bold text-uniacc-orange"
              >
                <span>Total matrícula por pagar</span>
                <span>{{ fmt(montoNetoMatricula()) }}</span>
              </div>
              <p v-if="tieneDeuda" class="text-xs text-red-700">
                No puedes pagar matrícula: hay deuda pendiente por regularizar.
              </p>
              <p v-else-if="resumenPagoMatricula" class="text-xs text-zinc-600">
                Configurado: {{ resumenPagoMatricula }}
              </p>
              <Button
                type="button"
                class="mt-2 w-full bg-uniacc-orange hover:bg-uniacc-orange/90"
                :disabled="!puedeAbrirPagoMatricula"
                @click="abrirPagoMatricula"
              >
                {{
                  abriendoPagoMatricula || cargandoDeuda
                    ? 'Validando…'
                    : tieneDeuda
                      ? 'Deuda pendiente'
                      : 'Pagar matrícula'
                }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Convenios institucionales del alumno -->
      <Card v-if="conveniosDetectados.length > 0" class="shadow-md">
        <CardHeader>
          <CardTitle class="text-lg text-uniacc-orange">Convenios institucionales</CardTitle>
          <CardDescription>
            El alumno tiene beneficios asociados a convenios registrados. Los convenios vigentes
            requieren subir el documento que acredita su vigencia para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <ConvenioVigenteUpload
            v-for="m in conveniosDetectados"
            :key="m.convenio.id"
            :match="m"
            :documento="mockCtx.conveniosDocumentos[m.convenio.id] ?? null"
            :contexto="contextoConvenio"
            @subido="onConvenioSubido"
            @eliminado="onConvenioEliminado"
          />
        </CardContent>
      </Card>

      <div
        v-if="conveniosVigentesPendientes.length > 0"
        class="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        Debes subir el documento de vigencia de
        {{ conveniosVigentesPendientes.length === 1 ? 'el convenio vigente' : 'los convenios vigentes' }}
        antes de continuar a la forma de pago.
      </div>

      <div class="flex flex-wrap justify-between gap-3">
        <Button variant="outline" type="button" @click="anterior">Anterior</Button>
        <Button
          class="bg-uniacc-orange rounded-full px-6 hover:bg-uniacc-orange/90"
          type="button"
          :disabled="conveniosVigentesPendientes.length > 0 || cargandoDeuda"
          @click="irAFormaPago"
        >
          {{ cargandoDeuda ? 'Consultando deuda…' : 'Siguiente — forma de pago' }}
        </Button>
      </div>
    </template>

    <!-- V07 Forma de pago -->
    <template v-else>
      <p class="text-muted-foreground">Selecciona un medio de pago simulado.</p>

      <div class="grid gap-4 sm:grid-cols-3">
        <Card
          class="cursor-pointer shadow-md transition hover:border-uniacc-orange"
          @click="simularPago('webpay')"
        >
          <CardHeader>
            <CardTitle class="text-base">WebPay</CardTitle>
            <CardDescription>Pago en línea simulado (éxito/error mock).</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Tarjeta / débito</Badge>
          </CardContent>
        </Card>

        <Card
          class="cursor-pointer shadow-md transition hover:border-uniacc-orange"
          @click="simularPago('pagare')"
        >
          <CardHeader>
            <CardTitle class="text-base">Pagaré</CardTitle>
            <CardDescription>Compromiso de pago firmado (mock).</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Documento</Badge>
          </CardContent>
        </Card>

        <Card class="cursor-pointer shadow-md transition hover:border-uniacc-orange" @click="simularPago('toku')">
          <CardHeader>
            <CardTitle class="text-base">TOKU</CardTitle>
            <CardDescription>Suscripción PAC/PAT simulada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Recurrente</Badge>
          </CardContent>
        </Card>
      </div>

      <p v-if="mockCtx.formaPagoSeleccionada" class="text-sm text-muted-foreground">
        Medio seleccionado: {{ mockCtx.formaPagoSeleccionada }}
      </p>

      <div class="flex flex-wrap justify-between gap-3">
        <Button variant="outline" type="button" @click="subPaso = 'becas'">Anterior</Button>
      </div>
    </template>

    <AlertDialog v-model:open="deudaModalOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deuda pendiente</AlertDialogTitle>
          <AlertDialogDescription class="space-y-2 text-left">
            <span class="block">
              El alumno registra deuda en el ERP y debe regularizarla antes de continuar con la
              rematrícula.
            </span>
            <span v-if="deudaValor != null" class="block font-mono text-xs text-zinc-600">
              DEUDA (SP): {{ deudaValor }}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="cerrarModalDeuda"
          >
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog :open="pagoMatriculaDialogOpen" @update:open="onPagoMatriculaDialogOpenChange">
      <DialogScrollContent
        :class="
          pagoMatriculaPaso === 'pagare'
            ? 'max-h-[90vh] w-[min(96vw,72rem)] max-w-6xl'
            : 'max-h-[85vh] max-w-lg'
        "
      >
        <DialogHeader>
          <DialogTitle>
            {{ pagoMatriculaPaso === 'selector' ? 'Pagar matrícula' : 'Pagaré — matrícula' }}
          </DialogTitle>
          <DialogDescription>
            Monto:
            <strong>{{ fmt(montoNetoMatricula()) }}</strong>
          </DialogDescription>
        </DialogHeader>

        <div v-if="pagoMatriculaPaso === 'selector'" class="grid gap-3 py-2">
          <Card
            class="cursor-pointer shadow-sm transition hover:border-uniacc-orange"
            @click="elegirMedioMatricula('webpay')"
          >
            <CardHeader class="py-3">
              <CardTitle class="text-base">WebPay</CardTitle>
              <CardDescription>Simulación de pago en línea.</CardDescription>
            </CardHeader>
          </Card>
          <Card
            class="cursor-pointer shadow-sm transition hover:border-uniacc-orange"
            @click="elegirMedioMatricula('pagare')"
          >
            <CardHeader class="py-3">
              <CardTitle class="text-base">Pagaré</CardTitle>
              <CardDescription>tipodoc 5 · 10 cuotas · días 5 / 15 / 25.</CardDescription>
            </CardHeader>
          </Card>
          <Card
            class="cursor-pointer shadow-sm transition hover:border-uniacc-orange"
            @click="elegirMedioMatricula('toku')"
          >
            <CardHeader class="py-3">
              <CardTitle class="text-base">TOKU</CardTitle>
              <CardDescription>Simulación PAC/PAT.</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div v-else class="space-y-4 py-2">
          <div class="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
            <p>
              Forma:
              <strong>Pagaré</strong>
              <Badge variant="outline" class="ml-2 font-mono text-[10px]">tipodoc 5</Badge>
            </p>
            <p class="mt-1">
              Cuotas: <strong>10</strong>
              · Valor cuota:
              <strong>{{ fmt(valorCuotaPagare) }}</strong>
            </p>
          </div>

          <div class="space-y-2">
            <Label>Día de vencimiento</Label>
            <Select v-model="pagareDiaVencimiento">
              <SelectTrigger>
                <SelectValue placeholder="Día" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Día 5</SelectItem>
                <SelectItem value="15">Día 15</SelectItem>
                <SelectItem value="25">Día 25</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="pagare-fecha-inicio">Fecha de inicio</Label>
            <Input
              id="pagare-fecha-inicio"
              v-model="pagareFechaInicio"
              type="date"
              :min="pagareFechaInicioMin"
            />
            <p class="text-xs text-muted-foreground">
              Día {{ pagareDiaVencimiento }} del mes siguiente a hoy.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              :disabled="!pagareFechaInicio || !pagareDiaVencimiento"
              @click="generarCuotasPagare"
            >
              Generar cuotas
            </Button>
            <Badge v-if="pagareCuotasPreview.length" variant="outline" class="text-[10px]">
              Correlativo provisional (mock)
            </Badge>
          </div>

          <div
            v-if="pagareCuotasPreview.length"
            class="-mx-1 max-h-72 overflow-auto rounded-md border border-zinc-200"
          >
            <table class="w-max min-w-full border-collapse text-left text-[11px] leading-tight">
              <thead class="sticky top-0 z-10 bg-zinc-50">
                <tr class="border-b border-zinc-200">
                  <th class="w-8 px-2 py-2" />
                  <th class="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground">
                    DOCUMENTO
                  </th>
                  <th class="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground">
                    CORRELATIVO
                  </th>
                  <th class="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground">
                    VENCIMIENTO
                  </th>
                  <th
                    class="whitespace-nowrap px-2 py-2 text-right font-medium text-muted-foreground"
                  >
                    MONTO
                  </th>
                  <th class="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground">
                    GASTOS
                  </th>
                  <th
                    class="whitespace-nowrap px-2 py-2 text-right font-medium text-muted-foreground"
                  >
                    TOTAL
                  </th>
                  <th class="whitespace-nowrap px-2 py-2 font-medium text-muted-foreground">
                    ÍTEMS
                  </th>
                  <th
                    class="whitespace-nowrap px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    CUOTA
                  </th>
                  <th
                    class="whitespace-nowrap px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    TOTAL CUOTA
                  </th>
                  <th
                    class="whitespace-nowrap px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    ID DOCUMENTO
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in pagareCuotasPreview"
                  :key="row.correlativo"
                  class="border-b border-zinc-100 last:border-0"
                >
                  <td class="px-2 py-1.5">
                    <Checkbox :checked="row.seleccionado" aria-label="Seleccionar cuota" />
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5">{{ row.documento }}</td>
                  <td class="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]">
                    {{ row.correlativo }}
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5">
                    {{ fmtFechaCuota(row.vencimiento) }}
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {{ fmt(row.monto) }}
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-muted-foreground">—</td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                    {{ fmt(row.totalAcumulado) }}
                  </td>
                  <td class="whitespace-nowrap px-2 py-1.5">{{ row.items }}</td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-center">{{ row.cuota }}</td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-center">{{ row.totalCuotas }}</td>
                  <td class="whitespace-nowrap px-2 py-1.5 text-center">{{ row.idDocumento }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button
            v-if="pagoMatriculaPaso === 'pagare'"
            type="button"
            variant="outline"
            @click="volverSelectorPagoMatricula"
          >
            Volver
          </Button>
          <Button type="button" variant="outline" @click="cerrarPagoMatriculaDialog">
            Cancelar
          </Button>
          <Button
            v-if="pagoMatriculaPaso === 'pagare'"
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            @click="confirmarPagareMatricula"
          >
            Confirmar pagaré
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
