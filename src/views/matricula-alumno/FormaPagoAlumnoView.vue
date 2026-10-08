<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import ConvenioVigenteUpload from '@/components/rematricula/ConvenioVigenteUpload.vue'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { tieneCae } from '@/constants/verificacionCae'
import { Check, CreditCard, FileText, GraduationCap, TriangleAlert } from 'lucide-vue-next'
import { abrirCasoRematricula, consultarCasosAlumno } from '@/services/casoRematriculaApi'
import {
  consultarCarteraBeneficios,
  consultarCodigosBeneficioAsignados,
  PERIODO_CARTERA_BENEFICIOS,
} from '@/services/carteraBeneficiosApi'
import { detectarConveniosAlumno } from '@/services/convenioAlumno'
import { fetchBeneficioPeriodo } from '@/services/fetchBeneficioPeriodo'
import {
  fetchDescuentosMatriculaAnticipada,
  fmtFechaCalendario,
} from '@/services/descuentoMatriculaAnticipada'
import {
  consultarReservaDescuentoMatricula,
  consultarResolucionBecaEstatal,
  reservarDescuentoMatricula,
} from '@/services/reservaDescuentoMatricula'
import { fmtMontoClp, fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { fetchMontoCaeAprobadoAlumno } from '@/services/fetchMnpEstadoCaeAlumnos'
import { contextoMolAuditoria, type ContextoMolAuditoriaOpciones } from '@/services/molAuditContext'
import { ejecutarVerificacionCae } from '@/services/verificacionCae'
import { registrarFormaPagoAudit } from '@/services/formaPagoAuditLog'
import { rutSinDv } from '@/services/alumnoDeudaNetApi'
import { crearWebpay, redirigirAWebpay } from '@/services/webpayPlusApi'
import {
  beneficioSeleccionable,
  etiquetaNoAplica,
  filtrarBeneficiosAsignados,
  itemsBeneficioDesdeCartera,
  type BeneficioExcelUiItem,
  type CarteraBeneficioRow,
  type CatalogoBeneficioAplica,
} from '@/utils/carteraBeneficiosUi'
import {
  anioNotasRematricula,
  filasBeneficioConPromedio,
  textoEfectoPromedio,
  textoFuentePromedio,
  textoNotaPromedio,
  textoPorcentajeFila,
  type FilaBeneficioPromedio,
} from '@/utils/beneficioPromedioVista'
import { elegirPromedio } from '@/utils/resolucionBecaPromedio'
import type { ContratoDescuentoLinea } from '@/types/contratoMatricula'
import type { MnpMvBeneficioPeriodoRow } from '@/types/supabase'
import {
  casoCertificadoConvenio,
  evaluarGateMatriculaConvenios,
  planDocumentosConvenioDesdeCasos,
} from '@/utils/convenioCertificadoGate'
import { periodoCatalogoLabel } from '@/utils/periodoCatalogo'
import { rutNorm } from '@/utils/rutNorm'
import { montoWebpayArancel } from '@/utils/descuentoFormaPagoWebpay'
import { arancelHabilitado, puedeContinuar } from '@/utils/selectorMedioPago'
import { textoWebpayAprobado } from '@/utils/webpayPagoDetalle'
import { siguientePaso } from '@/utils/webpaySiguientePaso'
import { useConvenioInstitucionalStore } from '@/stores/convenioInstitucional'
import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { usePa08MtArancelSelMatriculaNetStore } from '@/stores/datos_erp/pa08_MT_ARANCEL_sel_MATRICULA_NET'
import { useSpAlumnoDeudaNetStore } from '@/stores/datos_erp/sp_alumno_deuda_net'
import { useSpListaDocpagMatriculaCajaArancelStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_arancel'
import { useSpListaDocpagMatriculaCajaMatriculaStore } from '@/stores/datos_erp/sp_lista_docpag_matricula_caja_matricula'
import { useErpSpAmbienteStore } from '@/stores/erpSpAmbiente'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import type {
  MockConvenioDocumento,
  MockCuotaPagareDetalle,
  MockDescuentoPagare,
  MockPagoMatricula,
} from '@/stores/mockMatriculaContext'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  descuentoMatriculaAplicado,
  fechaChileIso,
  FLUJO_DESCUENTO_MATRICULA,
  type ReservaDescuentoMatriculaAplicar,
} from '@/utils/descuentoMatriculaMes'
import {
  asignarDocumentosDescuento,
  type LineaParaDocumentoDescuento,
} from '@/utils/documentosDescuentoContrato'
import { lineasBeneficioGrabar, lineasBeneficioPagare } from '@/utils/lineasBeneficioGrabar'
import {
  buildPagareCuotasDraft,
  incrementPeek,
  type CuotaPagareDraftRow,
} from '@/utils/pagareCuotasDraft'
import {
  etiquetaMesPrimeraCuota,
  fechaInicioPagarePeriodo,
  proximaFechaDiaVencimiento,
} from '@/utils/pagareFechaInicio'
import MatriculaAlumnoVerificacionCaeStep from '@/views/matricula-alumno/MatriculaAlumnoVerificacionCaeStep.vue'
import MatriculaAlumnoVerificacionEstatalStep from '@/views/matricula-alumno/MatriculaAlumnoVerificacionEstatalStep.vue'
import type {
  MnpCasoRematriculaRow,
  PlanPagosMvRow,
  TpMnpDescuentoMatriculaAnticipadaRow,
} from '@/types/supabase'

const router = useRouter()
const route = useRoute()
const alumnoCtx = useMatriculaAlumnoContextStore()
const periodoActivo = usePeriodoActivoStore()
const erpSpAmbiente = useErpSpAmbienteStore()
const { label: periodoActivoLabel } = storeToRefs(periodoActivo)
const { pagoMatricula } = storeToRefs(alumnoCtx)
const fuente = useAlumnoRematriculaFuente()
const {
  nombreMostrado,
  codcliMostrado,
  rutMostrado,
  carreraMostrada,
  jornadaMostrada,
  tipoCarreraMostrada,
} = fuente
const convenioStore = useConvenioInstitucionalStore()
const arancelSp = usePa08MtArancelSelMatriculaNetStore()
const docpagMatricula = useSpListaDocpagMatriculaCajaMatriculaStore()
const docpagArancel = useSpListaDocpagMatriculaCajaArancelStore()
const deudaNet = useSpAlumnoDeudaNetStore()
const preflight = useMatriculaFlujoPreflightStore()
const { loading: cargandoArancelSp, error: errorArancelSp, paramsUsados: paramsUsadosSp } =
  storeToRefs(arancelSp)
const { docs: docsPagoMatricula } = storeToRefs(docpagMatricula)
const { docs: docsPagoArancel } = storeToRefs(docpagArancel)
const { loading: cargandoDeuda, tieneDeuda, deudaValor } = storeToRefs(deudaNet)
const {
  corrpagnumPreview,
  correlativoPreview,
  contratoPreview,
  loading: cargandoPreflight,
} = storeToRefs(preflight)

const deudaModalOpen = ref(false)
const pagoMatriculaDialogOpen = ref(false)
/** 'selector' | 'pagare' */
const pagoMatriculaPaso = ref<'selector' | 'pagare'>('selector')
type MedioPagoConcepto = 'pagare' | 'webpay'
const medioPagoMatricula = ref<MedioPagoConcepto | null>(null)
const medioPagoArancel = ref<MedioPagoConcepto | null>(null)
const pagareDiaVencimiento = ref<string>('5')
const pagareTotalCuotas = ref<'10' | '12'>('10')
const pagareFechaInicio = ref('')
const abriendoPagoMatricula = ref(false)
const creandoWebpay = ref(false)

/** 'opciones' muestra los medios; 'webpay' muestra el aviso de salida con cuenta regresiva. */
const faseSalida = ref<'opciones' | 'webpay'>('opciones')
const conceptoSalida = ref<'matricula' | 'arancel'>('matricula')
const segundosSalida = ref(3)
const avisoWebpay = ref('')
let intervaloSalida: ReturnType<typeof setInterval> | null = null

const AVISO_SALIDA_WEBPAY =
  'Vas a salir de MOL hacia el sitio seguro de Webpay. Al terminar, volverás a la rematrícula.'
const AVISOS_RETORNO_WEBPAY: Record<'abortada' | 'rechazada', string> = {
  abortada: 'El pago con Webpay se canceló. Debes seleccionar la opción de pago.',
  rechazada: 'El pago con Webpay fue rechazado. Debes seleccionar la opción de pago.',
}

const matriculaPagadaWebpay = computed(() => alumnoCtx.webpayMatriculaEstado === 'autorizada')
const arancelPagadoWebpay = computed(() => alumnoCtx.webpayArancelEstado === 'autorizada')

const arancelEncendido = computed(
  () =>
    arancelHabilitado({
      medioMatricula: medioPagoMatricula.value,
      matriculaAutorizada: matriculaPagadaWebpay.value,
    }) && !arancelPagadoWebpay.value,
)

function totalCuotasActual(): 10 | 12 {
  return pagareTotalCuotas.value === '12' ? 12 : 10
}

const puedeContinuarSelectorMedios = computed(() =>
  puedeContinuar({
    medioMatricula: medioPagoMatricula.value,
    medioArancel: medioPagoArancel.value,
    matriculaAutorizada: matriculaPagadaWebpay.value,
  }),
)

const cuotasEsperadasPagare = computed(() => {
  let conceptos = 0
  if (medioPagoMatricula.value === 'pagare') conceptos += 1
  if (medioPagoArancel.value === 'pagare') conceptos += 1
  return conceptos * totalCuotasActual()
})

function clasesBotonMedio(activo: boolean, apagado = false): string {
  const base =
    'flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-3 text-left shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uniacc-orange'
  if (apagado) {
    return `${base} opacity-50 cursor-not-allowed border-zinc-200${activo ? ' ring-1 ring-uniacc-orange/40' : ''}`
  }
  return activo
    ? `${base} cursor-pointer border-uniacc-orange ring-1 ring-uniacc-orange/40 hover:bg-uniacc-orange/5`
    : `${base} cursor-pointer border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50`
}

function hoyIsoLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diaVencimientoActual(): 5 | 15 | 25 {
  const n = Number(pagareDiaVencimiento.value)
  if (n === 15 || n === 25) return n
  return 5
}

function sincronizarFechaInicioConDiaVencimiento() {
  pagareFechaInicio.value = fechaInicioPagarePeriodo({
    dia: diaVencimientoActual(),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
  })
  invalidarCuotasGeneradas()
}

watch(pagareDiaVencimiento, () => {
  sincronizarFechaInicioConDiaVencimiento()
})

watch(pagareFechaInicio, () => {
  invalidarCuotasGeneradas()
})

watch(pagareTotalCuotas, () => {
  invalidarCuotasGeneradas()
})

const pagareFechaInicioMin = computed(() => {
  const porPeriodo = fechaInicioPagarePeriodo({
    dia: diaVencimientoActual(),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
  })
  const desdeHoy = proximaFechaDiaVencimiento(diaVencimientoActual())
  // No permitir fechas pasadas; si el periodo fija un mes futuro, ese es el mínimo.
  return porPeriodo >= desdeHoy || porPeriodo >= hoyIsoLocal() ? porPeriodo : desdeHoy
})

const etiquetaPrimeraCuota = computed(() =>
  etiquetaMesPrimeraCuota(periodoActivo.anio, periodoActivo.semestre),
)

type CuotaPagarePreview = CuotaPagareDraftRow

const pagareCuotasPreview = ref<CuotaPagarePreview[]>([])

const pagareCuotasMat = computed(() =>
  pagareCuotasPreview.value.filter((r) => r.items === 'MATRICULA'),
)
const pagareCuotasAra = computed(() =>
  pagareCuotasPreview.value.filter((r) => r.items === 'ARANCEL'),
)

function invalidarCuotasGeneradas() {
  if (pagareCuotasPreview.value.length > 0) {
    pagareCuotasPreview.value = []
  }
}

function codCarrParaPreflight(): string {
  const desdePlan = (plan.value?.cod_carrera ?? '').trim()
  if (desdePlan) return desdePlan
  return (paramsUsadosSp.value?.codCarr ?? '').trim()
}

async function asegurarPreflightPagare(force = false): Promise<boolean> {
  const rut = rutMostrado.value
  if (!rut || rut === '—') {
    toast.error('Sin RUT para consultar correlativos ERP')
    return false
  }
  const codCarr = codCarrParaPreflight()
  if (!codCarr) {
    toast.error('Sin código de carrera para preflight ERP')
    return false
  }
  if (!force && corrpagnumPreview.value) return true

  const ok = await preflight.fetchFromErp({ rutCompleto: rut, codCarr })
  console.log('[forma-pago] gate preflight antes de pagar matrícula y arancel', {
    ok: preflight.ok,
    steps: preflight.steps,
    error: preflight.error,
  })
  if (!ok || !corrpagnumPreview.value) {
    toast.error(preflight.error || 'No se pudo obtener CORRPAGNUM del preflight ERP')
    return false
  }
  return true
}

async function generarCuotasPagare() {
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

  const peeksOk = await asegurarPreflightPagare()
  if (!peeksOk) return

  const corrpag = (corrpagnumPreview.value ?? '').trim()
  if (!/^\d+$/.test(corrpag)) {
    toast.error('Falta peek CORRPAGNUM del preflight')
    return
  }

  let corrpagAra: string
  try {
    corrpagAra = incrementPeek(corrpag, 1)
  } catch {
    toast.error('Peek CORRPAGNUM no numérico')
    return
  }

  const result = buildPagareCuotasDraft({
    fechaInicio: fecha,
    dia,
    montoMat: medioPagoMatricula.value === 'pagare' ? montoNetoMatricula() : 0,
    montoAra: medioPagoArancel.value === 'pagare' ? montoNetoArancel() : 0,
    corrpagMat: corrpag,
    corrpagAra,
    n: totalCuotasActual(),
  })
  if (!result.ok) {
    toast.error(result.error)
    return
  }

  pagareCuotasPreview.value = result.rows.filter((r) =>
    r.items === 'MATRICULA'
      ? medioPagoMatricula.value === 'pagare'
      : medioPagoArancel.value === 'pagare',
  )
  console.log('[forma-pago] cuotas pagaré generadas (correlativo peek / no consumido)', {
    corrpagMat: corrpag,
    corrpagAra,
    n: totalCuotasActual(),
    rows: result.rows,
  })
  toast.success('Plan de pagos generado correctamente.')
}

const resumenPagoMatricula = computed(() => {
  const p = pagoMatricula.value
  if (!p) return null
  if (p.medio === 'pagare') {
    return `Pagaré · ${p.cuotas} cuotas · día ${p.diaVencimiento} · desde ${p.fechaInicio}`
  }
  return `${p.nombre} (simulado)`
})

type SubPaso = 'verificacion-cae' | 'verificacion-estatal' | 'becas' | 'pago'
const subPaso = ref<SubPaso>('becas')

const fmt = fmtMontoClp

/** YYYY-MM-DD → DD/MM/YYYY para la grilla. */
function fmtFechaCuota(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}
const planPagosRow = ref<PlanPagosMvRow | null>(null)
const plan = computed(() => planPagosRow.value)

function etiquetaJornada(raw: string): string {
  const code = raw.trim().toUpperCase()
  if (code === 'D') return 'Diurna'
  if (code === 'V') return 'Vespertina'
  if (code === 'AD') return 'A distancia'
  if (code === 'S') return 'Semipresencial'
  return raw.trim() || '—'
}

const carreraRematricula = computed(() => {
  const desdePlan = (plan.value?.nombre_carrera ?? plan.value?.carrera ?? '').trim()
  if (desdePlan) return desdePlan
  return carreraMostrada.value
})

const jornadaRematricula = computed(() => {
  const desdePlan = (plan.value?.jornada_carrera ?? '').trim()
  return etiquetaJornada(desdePlan || jornadaMostrada.value)
})

async function cargarPlanPagosAlumno(): Promise<PlanPagosMvRow | null> {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (!codcli || anio == null || sem == null) return null
  const { data, error } = await fetchPlanPagosMvByCodcli({
    codcli,
    anioMatricula: anio,
    periodoMatricula: sem,
  })
  if (error || !data) {
    console.warn('[forma-pago-alumno] no se pudo cargar plan de pagos:', error)
    return null
  }
  planPagosRow.value = data
  await cargarMontoCaeDocumento(data)
  return data
}

const montoCaeAprobado = ref(0)

async function cargarMontoCaeDocumento(fila: PlanPagosMvRow | null): Promise<void> {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const sem = periodoActivo.semestre
  if (!tieneCae(fila) || !codcli || anio == null || sem == null) {
    montoCaeAprobado.value = 0
    return
  }
  montoCaeAprobado.value = await fetchMontoCaeAprobadoAlumno({
    codcli,
    anio,
    semestre: sem,
  })
}

const verificandoCae = ref(false)
const reintentandoCae = ref(false)
const reintentandoEstatal = ref(false)
const reservaMatricula = ref<ReservaDescuentoMatriculaAplicar | null>(null)

const carteraBeneficiosRow = ref<CarteraBeneficioRow | null>(null)
const codigosBeneficioAsignados = ref<Set<string>>(new Set())
const cargandoCarteraBeneficios = ref(false)
const errorCarteraBeneficios = ref<string | null>(null)

const catalogoPeriodo = ref<MnpMvBeneficioPeriodoRow[]>([])

const catalogoAplica = computed((): CatalogoBeneficioAplica[] =>
  catalogoPeriodo.value.map((c) => ({
    codigo_beneficio: c.codigo_beneficio,
    flujo: c.flujo,
    aplica: c.aplica,
  })),
)

const beneficios = computed((): BeneficioExcelUiItem[] =>
  filtrarBeneficiosAsignados(
    itemsBeneficioDesdeCartera(carteraBeneficiosRow.value, catalogoAplica.value),
    codigosBeneficioAsignados.value,
  ),
)

const periodoBeneficioLabel = computed(
  () => carteraBeneficiosRow.value?.periodo ?? PERIODO_CARTERA_BENEFICIOS,
)

const beneficiosSeleccionados = ref<Record<number, boolean>>({})
const descuentosMatriculaCatalogo = ref<TpMnpDescuentoMatriculaAnticipadaRow[]>([])

const tieneBecaEstatalAsignada = computed(() =>
  beneficios.value.some((b) => b.flujo === 'ESTATAL'),
)

const nombresBecaEstatal = computed(() =>
  beneficios.value.filter((b) => b.flujo === 'ESTATAL').map((b) => b.descripcion),
)

const descuentoMatriculaAplicadoConFila = computed(() =>
  descuentoMatriculaAplicado({
    filas: descuentosMatriculaCatalogo.value,
    periodo: periodoActivoLabel.value ?? '',
    hoy: fechaChileIso(),
    tieneCae: tieneCae(plan.value),
    tieneBecaEstatal: tieneBecaEstatalAsignada.value,
    reserva: reservaMatricula.value,
  }),
)

const descuentoMatriculaMes = computed(
  () => descuentoMatriculaAplicadoConFila.value?.descuento ?? null,
)

// CODBEN del ERP de la fila del catálogo que se aplicó. Sin fila o sin entero positivo, no hay código.
function codbenDescuentoMatricula(): string | undefined {
  const id = descuentoMatriculaAplicadoConFila.value?.fila.id
  if (id == null) return undefined
  const fila = descuentosMatriculaCatalogo.value.find((item) => item.id === id)
  const cod = Number(fila?.cod_beneficio)
  return Number.isInteger(cod) && cod > 0 ? String(cod) : undefined
}

const textoReservaMatricula = computed(() => {
  const descuento = descuentoMatriculaMes.value
  const reserva = reservaMatricula.value
  if (!descuento || !reserva) return null
  const fila = descuentosMatriculaCatalogo.value.find((item) => item.id === reserva.descuentoId)
  const hasta = fmtFechaCalendario(fila?.reserva_hasta)
  if (hasta === '—') return null
  return `Tienes reservado ${descuento.nombre} por ${fmt(descuento.monto)} hasta el ${hasta}.`
})

function pickCampoAlumno(val: string): string | null {
  const t = val.trim()
  if (!t || t === '—') return null
  return t
}

const codigosNoAplican = computed(() => {
  const set = new Set<string>()
  for (const c of catalogoAplica.value) {
    if (!c.aplica) set.add(c.codigo_beneficio.trim())
  }
  return set
})

const conveniosDetectados = computed(() =>
  detectarConveniosAlumno(plan.value, convenioStore.rows).filter(
    (m) => !codigosNoAplican.value.has((m.convenio.codigo_beneficio ?? '').trim()),
  ),
)

const conveniosVigentes = computed(() =>
  conveniosDetectados.value.filter((m) => m.esVigente),
)

const casosConvenio = ref<MnpCasoRematriculaRow[]>([])

const gateConvenioMatricula = computed(() =>
  evaluarGateMatriculaConvenios({
    vigentes: conveniosVigentes.value.map((m) => ({
      id: m.convenio.id,
      codigoBeneficio: m.convenio.codigo_beneficio,
    })),
    casos: casosConvenio.value,
    docsByConvenioId: alumnoCtx.conveniosDocumentos,
  }),
)

function estadoUiConvenio(convenioId: string): MnpCasoRematriculaRow['estado'] | null {
  const match = conveniosVigentes.value.find((m) => m.convenio.id === convenioId)
  if (!match) return null
  const doc = alumnoCtx.conveniosDocumentos[convenioId]
  return (
    casoCertificadoConvenio(
      casosConvenio.value,
      { id: match.convenio.id, codigoBeneficio: match.convenio.codigo_beneficio },
      doc?.storagePath,
    )?.estado ?? null
  )
}

const estadoPorConvenioId = computed(() => {
  const out: Record<string, MnpCasoRematriculaRow['estado'] | null> = {}
  for (const m of conveniosDetectados.value) {
    out[m.convenio.id] = estadoUiConvenio(m.convenio.id)
  }
  return out
})

const motivoPorConvenioId = computed(() => {
  const out: Record<string, string | null> = {}
  for (const m of conveniosDetectados.value) {
    const doc = alumnoCtx.conveniosDocumentos[m.convenio.id]
    out[m.convenio.id] =
      casoCertificadoConvenio(
        casosConvenio.value,
        { id: m.convenio.id, codigoBeneficio: m.convenio.codigo_beneficio },
        doc?.storagePath,
      )?.motivo ?? null
  }
  return out
})

const contextoConvenio = computed<ContextoMolAuditoriaOpciones>(() => ({
  rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
  codcli: pickCampoAlumno(fuente.codcliMostrado.value),
  nombreAlumno: pickCampoAlumno(fuente.nombreMostrado.value),
  anioPeriodo: periodoActivo.anio,
  semestrePeriodo: periodoActivo.semestre,
  esMock: false,
}))

async function refrescarCasosConvenio(): Promise<void> {
  const ctx = contextoConvenio.value
  const anio = ctx.anioPeriodo
  const sem = ctx.semestrePeriodo
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  if (!codcli || anio == null || sem == null) {
    casosConvenio.value = []
    return
  }
  const { data, error } = await consultarCasosAlumno(
    codcli,
    periodoCatalogoLabel(anio, sem),
  )
  if (error) {
    console.warn('[forma-pago] consultar_casos_alumno', error)
    return
  }
  casosConvenio.value = (data ?? []).filter((c) => c.tipo === 'CONVENIO_CERTIFICADO')
  const plan = planDocumentosConvenioDesdeCasos(casosConvenio.value)
  for (const convenioId of plan.quitar) {
    alumnoCtx.removeConvenioDocumento(convenioId)
  }
  for (const doc of plan.poner) {
    if (alumnoCtx.conveniosDocumentos[doc.convenioId]) continue
    alumnoCtx.setConvenioDocumento(doc.convenioId, {
      storagePath: doc.storagePath,
      nombreArchivo: doc.nombreArchivo,
    })
  }
}

async function onConvenioSubido(payload: {
  convenioId: string
  doc: MockConvenioDocumento
  documentoId?: string | null
}) {
  alumnoCtx.setConvenioDocumento(payload.convenioId, payload.doc)
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
    esMock: false,
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
  await refrescarCasosConvenio()
}

async function onConvenioEliminado(payload: { convenioId: string }) {
  alumnoCtx.removeConvenioDocumento(payload.convenioId)
  await refrescarCasosConvenio()
}

function setBeneficioSeleccionado(slot: number, checked: boolean) {
  beneficiosSeleccionados.value = {
    ...beneficiosSeleccionados.value,
    [slot]: checked,
  }
}

function initBeneficiosSeleccionados() {
  const sel: Record<number, boolean> = {}
  beneficios.value.forEach((b) => {
    if (beneficioSeleccionable(b)) sel[b.slot] = true
  })
  beneficiosSeleccionados.value = sel
}

async function cargarCatalogoPeriodo() {
  const { data, error } = await fetchBeneficioPeriodo(PERIODO_CARTERA_BENEFICIOS)
  if (error) {
    console.warn('[forma-pago] catálogo beneficio periodo', error)
    return
  }
  catalogoPeriodo.value = data
}

async function cargarDescuentosMatricula() {
  const { data, error } = await fetchDescuentosMatriculaAnticipada()
  if (error) {
    console.warn('[forma-pago] descuento de matrícula', error)
    descuentosMatriculaCatalogo.value = []
    return
  }
  descuentosMatriculaCatalogo.value = data
}

async function cargarCarteraBeneficios() {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const rut = pickCampoAlumno(fuente.rutMostrado.value)
  if (!codcli && !rut) {
    carteraBeneficiosRow.value = null
    codigosBeneficioAsignados.value = new Set()
    errorCarteraBeneficios.value = null
    initBeneficiosSeleccionados()
    return
  }

  cargandoCarteraBeneficios.value = true
  errorCarteraBeneficios.value = null
  try {
    const [{ data, error }, asignados] = await Promise.all([
      consultarCarteraBeneficios({
        periodo: PERIODO_CARTERA_BENEFICIOS,
        codcliExcel: codcli,
        rutNorm: rut ? rutNorm(rut) : null,
      }),
      consultarCodigosBeneficioAsignados(codcli),
    ])
    if (error || asignados.error) {
      errorCarteraBeneficios.value = error ?? asignados.error
      carteraBeneficiosRow.value = null
      codigosBeneficioAsignados.value = new Set()
    } else {
      carteraBeneficiosRow.value = data
      codigosBeneficioAsignados.value = asignados.codigos
    }
  } finally {
    cargandoCarteraBeneficios.value = false
  }
  initBeneficiosSeleccionados()
}

watch([codcliMostrado, rutMostrado], () => {
  void cargarCarteraBeneficios()
})

watch(catalogoAplica, () => {
  initBeneficiosSeleccionados()
})

function periodoFormaPago(): { codcli: string; anio: number; semestre: number } | null {
  const codcli = pickCampoAlumno(fuente.codcliMostrado.value)
  const anio = periodoActivo.anio
  const semestre = periodoActivo.semestre
  if (!codcli || anio == null || semestre == null) return null
  return { codcli, anio, semestre }
}

async function cargarReservaMatricula() {
  const periodo = periodoFormaPago()
  if (!periodo) return
  const { data, error } = await consultarReservaDescuentoMatricula({
    codcli: periodo.codcli,
    anioPeriodo: periodo.anio,
    semestrePeriodo: periodo.semestre,
  })
  if (error) {
    console.warn('[forma-pago] reserva de matrícula', error)
    return
  }
  reservaMatricula.value = data
}

async function guardarReservaMatricula(motivo: 'CAE' | 'ESTATAL') {
  const periodo = periodoFormaPago()
  if (!periodo) return
  const { data, error } = await reservarDescuentoMatricula({
    codcli: periodo.codcli,
    anioPeriodo: periodo.anio,
    semestrePeriodo: periodo.semestre,
    rutAlumno: pickCampoAlumno(fuente.rutMostrado.value),
    motivo,
  })
  if (error) {
    console.warn('[forma-pago] no se pudo reservar el descuento de matrícula', error)
    return
  }
  reservaMatricula.value = data
}

async function entrarSiBecaEstatalOPlan() {
  if (!tieneBecaEstatalAsignada.value) {
    subPaso.value = 'becas'
    return
  }
  const periodo = periodoFormaPago()
  if (!periodo) {
    toast.error('No se pudo verificar la beca ministerial: faltan codcli o periodo activo.')
    subPaso.value = 'verificacion-estatal'
    return
  }
  const { disponible, error } = await consultarResolucionBecaEstatal({
    codcli: periodo.codcli,
    anioPeriodo: periodo.anio,
    semestrePeriodo: periodo.semestre,
  })
  if (error) {
    console.warn('[forma-pago] resolución beca ministerial', error)
    toast.error('No se pudo verificar la beca ministerial. Intenta de nuevo.')
    subPaso.value = 'verificacion-estatal'
    return
  }
  if (disponible) {
    subPaso.value = 'becas'
    return
  }
  await guardarReservaMatricula('ESTATAL')
  subPaso.value = 'verificacion-estatal'
}

async function correrVerificacionEstatal() {
  reintentandoEstatal.value = true
  try {
    await entrarSiBecaEstatalOPlan()
  } finally {
    reintentandoEstatal.value = false
  }
}

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
    esMock: false,
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

    alumnoCtx.setVerificacionCae({ resultado: data.resultado })

    if (data.resultado === 'continua') {
      await entrarSiBecaEstatalOPlan()
      return
    }

    await guardarReservaMatricula('CAE')
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
    cargarCatalogoPeriodo(),
    cargarDescuentosMatricula(),
  ])
  await Promise.all([refrescarCasosConvenio(), cargarReservaMatricula()])

  let p = (await cargarPlanPagosAlumno()) ?? plan.value
  if (!p) return

  p = await refrescarPlanSiFaltanParamsErp(p)

  await Promise.all([cargarArancelDesdeErp(p), precargarDeudaSiHayRut()])

  if (!tieneCae(p)) {
    await entrarSiBecaEstatalOPlan()
  } else if (alumnoCtx.verificacionCae?.resultado === 'continua') {
    await entrarSiBecaEstatalOPlan()
  } else if (alumnoCtx.verificacionCae?.resultado === 'pendiente_resolucion') {
    await guardarReservaMatricula('CAE')
    subPaso.value = 'verificacion-cae'
  } else {
    await correrVerificacionCae()
  }

  if (subPaso.value === 'becas') await abrirPlanSiVieneDeWebpay()
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
  planPagosRow.value = data
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

const promedioElegido = computed(() =>
  elegirPromedio({
    promAnio: plan.value?.prom_anio,
    promUltimoPeriodo: plan.value?.prom_ultimo_periodo,
    promediosCerrados: periodoActivo.promediosCerrados,
  }),
)

const anioNotas = computed(() => anioNotasRematricula(periodoActivo.anio))

const notaPromedioMostrada = computed(() =>
  textoNotaPromedio(promedioElegido.value?.promedio ?? null),
)

const etiquetaFuentePromedio = computed(() =>
  textoFuentePromedio(promedioElegido.value?.fuente ?? null, anioNotas.value),
)

const efectoPromedio = computed(() => textoEfectoPromedio(promedioElegido.value?.promedio ?? null))

const filasPromedio = computed(() =>
  filasBeneficioConPromedio({
    items: beneficios.value,
    catalogo: catalogoPeriodo.value.map((c) => ({
      codigo_beneficio: c.codigo_beneficio,
      flujo: c.flujo,
      renovable: c.renovable,
    })),
    seleccionados: beneficiosSeleccionados.value,
    arancelBruto: montoBrutoArancel(),
    promedio: promedioElegido.value?.promedio ?? null,
  }),
)

const filaPorSlot = computed(() => {
  const map = new Map<number, FilaBeneficioPromedio>()
  for (const fila of filasPromedio.value) map.set(fila.slot, fila)
  return map
})

function filaDe(slot: number): FilaBeneficioPromedio | undefined {
  return filaPorSlot.value.get(slot)
}

const lineasDescuento = computed(() =>
  filasPromedio.value.filter((fila) => fila.marcado && fila.monto > 0),
)

function beneficioMarcado(slot: number): boolean {
  return beneficiosSeleccionados.value[slot] === true
}

// Los beneficios se descuentan del arancel según lo que el alumno deja marcado.
function montoBeneficiosArancel(): number {
  return lineasDescuento.value.reduce((sum, linea) => sum + linea.monto, 0)
}

function montoDescuentoMatriculaAplicado(): number {
  const catalogo = descuentoMatriculaMes.value?.monto ?? 0
  if (catalogo <= 0) return 0
  return Math.min(catalogo, montoBrutoMatricula())
}

function montoNetoMatricula(): number {
  return Math.max(0, montoBrutoMatricula() - montoDescuentoMatriculaAplicado())
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
    !abriendoPagoMatricula.value &&
    gateConvenioMatricula.value.puedePagarPorConvenio
  )
})

const valorCuotaPagareMat = computed(() =>
  Math.round(montoNetoMatricula() / totalCuotasActual()),
)
const valorCuotaPagareAra = computed(() =>
  Math.round(montoNetoArancel() / totalCuotasActual()),
)

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
    await asegurarPreflightPagare(true)
    prepararSelectorMedios()
    pagoMatriculaDialogOpen.value = true
  } finally {
    abriendoPagoMatricula.value = false
  }
}

function limpiarIntervaloSalida(): void {
  if (intervaloSalida != null) {
    clearInterval(intervaloSalida)
    intervaloSalida = null
  }
}

/** Matrícula que se conserva al abrir o cerrar el selector: nunca borra una pagada ni la del pagaré si solo falló el arancel. */
function medioInicialMatricula(): MedioPagoConcepto | null {
  if (alumnoCtx.webpayMatriculaEstado === 'autorizada') return 'webpay'
  const arancelSoloPendiente =
    alumnoCtx.medioArancel === 'webpay' && alumnoCtx.webpayArancelEstado !== 'autorizada'
  if (alumnoCtx.medioMatricula === 'pagare' && arancelSoloPendiente) return 'pagare'
  return null
}

function medioInicialArancel(): MedioPagoConcepto | null {
  if (alumnoCtx.webpayArancelEstado === 'autorizada' && alumnoCtx.medioArancel === 'webpay') {
    return 'webpay'
  }
  return null
}

function prepararSelectorMedios(): void {
  limpiarIntervaloSalida()
  faseSalida.value = 'opciones'
  segundosSalida.value = 3
  avisoWebpay.value = ''
  pagoMatriculaPaso.value = 'selector'
  medioPagoMatricula.value = medioInicialMatricula()
  medioPagoArancel.value = medioInicialArancel()
  pagareDiaVencimiento.value = '5'
  pagareTotalCuotas.value = '10'
  sincronizarFechaInicioConDiaVencimiento()
}

function cerrarPagoMatriculaDialog() {
  limpiarIntervaloSalida()
  faseSalida.value = 'opciones'
  segundosSalida.value = 3
  avisoWebpay.value = ''
  pagoMatriculaDialogOpen.value = false
  pagoMatriculaPaso.value = 'selector'
  medioPagoMatricula.value = medioInicialMatricula()
  medioPagoArancel.value = medioInicialArancel()
  pagareCuotasPreview.value = []
}

function cancelarSalidaWebpay(): void {
  limpiarIntervaloSalida()
  faseSalida.value = 'opciones'
  segundosSalida.value = 3
}

function cancelarOCerrarPagoMatricula(): void {
  if (faseSalida.value === 'webpay') {
    cancelarSalidaWebpay()
    return
  }
  cerrarPagoMatriculaDialog()
}

async function ejecutarSalidaWebpay(): Promise<void> {
  const concepto = conceptoSalida.value
  if (concepto === 'matricula') medioPagoMatricula.value = 'webpay'
  else medioPagoArancel.value = 'webpay'
  const salio = await iniciarWebpay(concepto)
  if (salio) return
  // La pestaña no se fue: vuelven las opciones sin Webpay marcado.
  if (concepto === 'matricula') medioPagoMatricula.value = null
  else medioPagoArancel.value = null
  cancelarSalidaWebpay()
}

function iniciarSalidaWebpay(concepto: 'matricula' | 'arancel'): void {
  if (creandoWebpay.value) return
  limpiarIntervaloSalida()
  conceptoSalida.value = concepto
  segundosSalida.value = 3
  avisoWebpay.value = ''
  faseSalida.value = 'webpay'
  intervaloSalida = setInterval(() => {
    segundosSalida.value -= 1
    if (segundosSalida.value > 0) return
    segundosSalida.value = 0
    limpiarIntervaloSalida()
    void ejecutarSalidaWebpay()
  }, 1000)
}

onBeforeUnmount(limpiarIntervaloSalida)

function volverSelectorPagoMatricula() {
  pagoMatriculaPaso.value = 'selector'
  pagareCuotasPreview.value = []
}

function onPagoMatriculaDialogOpenChange(open: boolean) {
  if (open) {
    pagoMatriculaDialogOpen.value = true
    return
  }
  // Durante la salida a Webpay, cerrar solo detiene el contador y devuelve las opciones.
  if (faseSalida.value === 'webpay') {
    cancelarSalidaWebpay()
    return
  }
  cerrarPagoMatriculaDialog()
}

function persistirMediosYMontosWebpay(): void {
  alumnoCtx.setMedioMatricula(medioPagoMatricula.value)
  alumnoCtx.setMedioArancel(medioPagoArancel.value)
  alumnoCtx.setWebpayMontoMatricula(montoNetoMatricula())
  // Saldo antes del 5 %. El contrato y la cuenta calculan el descuento sobre este monto.
  alumnoCtx.setWebpayMontoArancel(montoNetoArancel())
  alumnoCtx.setDatosContratoWebpay({
    valorMatriculaBruto: montoBrutoMatricula(),
    valorArancelBruto: montoBrutoArancel(),
    descuentosContrato: lineasBeneficioParaContratoWebpay(),
  })
  // Con CODBEN y sin folio. El folio se asigna al grabar la cuenta.
  alumnoCtx.setLineasBeneficioGrabar(lineasBeneficioGrabar(entradaBeneficiosGrabar()))
}

// Única fuente de los beneficios con CODBEN: la usan el pagaré y el grabado tras Webpay.
function entradaBeneficiosGrabar(): {
  lineasArancel: LineaParaDocumentoDescuento[]
  descuentoMatricula: LineaParaDocumentoDescuento | null
  cae: LineaParaDocumentoDescuento | null
} {
  const arancelBruto = montoBrutoArancel()
  const lineasArancel = lineasDescuento.value.map((fila) => ({
    concepto: 'arancel' as const,
    flujo: fila.flujo,
    descripcion: fila.descripcion,
    monto: fila.monto,
    codben: fila.codigo,
    porc: fila.porcCatalogo,
    montoSolicitado:
      fila.porcCatalogo != null
        ? Math.round((arancelBruto * fila.porcCatalogo) / 100)
        : fila.monto,
  }))
  const cae: LineaParaDocumentoDescuento | null = tieneCae(plan.value)
    ? {
        concepto: 'arancel',
        flujo: 'CAE',
        codben: '4',
        descripcion: 'Crédito Aval del Estado',
        monto: montoCaeAprobado.value,
      }
    : null
  const descuentoMes = descuentoMatriculaMes.value
  const montoDescuentoMes = montoDescuentoMatriculaAplicado()
  const descuentoMatricula: LineaParaDocumentoDescuento | null =
    descuentoMes && montoDescuentoMes > 0
      ? {
          concepto: 'matricula',
          flujo: FLUJO_DESCUENTO_MATRICULA,
          codben: codbenDescuentoMatricula(),
          descripcion: descuentoMes.nombre,
          monto: montoDescuentoMes,
        }
      : null
  return { lineasArancel, descuentoMatricula, cae }
}

// Líneas que montoNetoMatricula/montoNetoArancel restan. No depende del correlativo del pagaré.
function lineasBeneficioParaContratoWebpay(): ContratoDescuentoLinea[] {
  const base = (
    concepto: 'matricula' | 'arancel',
    descripcion: string,
    monto: number,
  ): ContratoDescuentoLinea => ({
    concepto,
    documento: '—',
    tipoDocumento: descripcion,
    descripcion,
    detalle: descripcion,
    monto,
    vencimiento: '—',
  })
  const lineas: ContratoDescuentoLinea[] = []
  const montoMes = montoDescuentoMatriculaAplicado()
  const descuentoMes = descuentoMatriculaMes.value
  if (descuentoMes && montoMes > 0) {
    lineas.push(base('matricula', descuentoMes.nombre, montoMes))
  }
  for (const fila of lineasDescuento.value) {
    if (fila.flujo === 'CAE') continue
    lineas.push(base('arancel', fila.descripcion, fila.monto))
  }
  return lineas
}

function contextoCrearWebpay(): { codcli: string; anio: number; periodo: 1 | 2 } | null {
  const periodo = periodoFormaPago()
  const codcli = rutSinDv(fuente.rutMostrado.value)
  if (!periodo || !/^\d{7,8}$/.test(codcli)) return null
  if (periodo.semestre !== 1 && periodo.semestre !== 2) return null
  return { codcli, anio: periodo.anio, periodo: periodo.semestre }
}

/** Devuelve true si la pestaña salió hacia Webpay. */
async function iniciarWebpay(concepto: 'matricula' | 'arancel'): Promise<boolean> {
  const ctx = contextoCrearWebpay()
  if (!ctx) {
    toast.error('Faltan codcli o periodo de matrícula para Webpay')
    return false
  }
  const monto =
    concepto === 'matricula' ? montoNetoMatricula() : montoWebpayArancel(montoNetoArancel())
  if (!Number.isInteger(monto) || monto <= 0) {
    toast.error('El monto a pagar no es un entero mayor que cero')
    return false
  }
  persistirMediosYMontosWebpay()
  creandoWebpay.value = true
  try {
    const creado = await crearWebpay({
      codcli: ctx.codcli,
      anio: ctx.anio,
      periodo: ctx.periodo,
      concepto,
      monto,
    })
    if (!creado.ok) {
      toast.error(creado.error)
      return false
    }
    redirigirAWebpay(creado.url, creado.token)
    return true
  } finally {
    creandoWebpay.value = false
  }
}

async function abrirPasoPlanPagare(): Promise<boolean> {
  const ok = await asegurarPreflightPagare()
  if (!ok) return false
  pagoMatriculaPaso.value = 'pagare'
  pagareCuotasPreview.value = []
  sincronizarFechaInicioConDiaVencimiento()
  pagoMatriculaDialogOpen.value = true
  return true
}

function avisoDesdeQuery(raw: unknown): string | null {
  const valor: unknown = Array.isArray(raw) ? raw[0] : raw
  if (valor === 'abortada') return AVISOS_RETORNO_WEBPAY.abortada
  if (valor === 'rechazada') return AVISOS_RETORNO_WEBPAY.rechazada
  return null
}

async function abrirPlanSiVieneDeWebpay(): Promise<void> {
  const aviso = avisoDesdeQuery(route.query.aviso)
  if (aviso) {
    prepararSelectorMedios()
    avisoWebpay.value = aviso
    pagoMatriculaDialogOpen.value = true
    const { aviso: _quitar, ...resto } = route.query
    await router.replace({ query: resto })
    return
  }
  const plan = route.query.plan
  if (plan !== 'matricula' && plan !== 'arancel') {
    if (matriculaPagadaWebpay.value && alumnoCtx.medioArancel == null && pagoMatricula.value == null) {
      prepararSelectorMedios()
      pagoMatriculaDialogOpen.value = true
    }
    return
  }
  const medioMat = alumnoCtx.medioMatricula
  const medioAra = alumnoCtx.medioArancel
  if (medioMat == null || medioAra == null) return
  medioPagoMatricula.value = medioMat
  medioPagoArancel.value = medioAra
  pagareDiaVencimiento.value = '5'
  pagareTotalCuotas.value = '10'
  await abrirPasoPlanPagare()
}

async function continuarSelectorMedios() {
  if (!puedeContinuarSelectorMedios.value) {
    toast.error('Selecciona Pagaré para continuar. Webpay te lleva al pago al elegirlo.')
    return
  }
  const medioMat = medioPagoMatricula.value
  const medioAra = medioPagoArancel.value
  if (medioMat == null || medioAra == null) return

  persistirMediosYMontosWebpay()

  const paso = siguientePaso({
    medioMatricula: medioMat,
    medioArancel: medioAra,
    matriculaAutorizada: alumnoCtx.webpayMatriculaEstado === 'autorizada',
    arancelAutorizado: alumnoCtx.webpayArancelEstado === 'autorizada',
    planListo: false,
  })

  if (paso.tipo === 'flujo-pagare' || paso.tipo === 'plan-pagare') {
    await abrirPasoPlanPagare()
    return
  }

  if (paso.tipo === 'webpay') {
    await iniciarWebpay(paso.concepto)
    return
  }

  if (paso.tipo === 'firma') {
    alumnoCtx.marcarPasoAlcanzado(3)
    void router.push({ name: 'matricula-alumno-firma' })
  }
}

function descuentosParaContrato(): MockDescuentoPagare[] {
  const peek = (corrpagnumPreview.value ?? '').trim()
  if (!/^\d+$/.test(peek)) return []
  const anio = anioNotas.value
  const vencimiento = anio != null ? `29/12/${anio}` : '—'
  // Sin CODBEN en el CAE ni en el descuento de matrícula: el payload del pagaré no cambia.
  const lineas = lineasBeneficioPagare(entradaBeneficiosGrabar())
  return asignarDocumentosDescuento({
    peek,
    vencimiento,
    lineas,
  })
}

const documentosPlanPago = computed(() => descuentosParaContrato())

const bloquesPlanPago = computed(() => [
  {
    titulo: 'Matrícula',
    monto: montoNetoMatricula(),
    descuentos: documentosPlanPago.value.filter((d) => d.concepto === 'matricula'),
    rows: pagareCuotasMat.value,
  },
  {
    titulo: 'Arancel',
    monto: montoNetoArancel(),
    descuentos: documentosPlanPago.value.filter((d) => d.concepto === 'arancel'),
    rows: pagareCuotasAra.value,
  },
])

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
  const nCuotas = totalCuotasActual()
  if (cuotasEsperadasPagare.value === 0 || pagareCuotasPreview.value.length !== cuotasEsperadasPagare.value) {
    toast.error('Debes generar las cuotas del pagaré antes de confirmar')
    return
  }
  const montoMat = medioPagoMatricula.value === 'pagare' ? montoNetoMatricula() : 0
  const montoAra = medioPagoArancel.value === 'pagare' ? montoNetoArancel() : 0
  const monto = montoMat + montoAra
  const cuotasDetalle: MockCuotaPagareDetalle[] = pagareCuotasPreview.value.map(
    ({ seleccionado: _sel, ...rest }) => rest,
  )
  const numOperacion = (correlativoPreview.value ?? '').trim() || undefined
  const contrato = (contratoPreview.value ?? '').trim() || undefined
  const payload: MockPagoMatricula = {
    medio: 'pagare',
    tipodoc: '5',
    nombre: 'PAGARÉ',
    cuotas: nCuotas,
    diaVencimiento: dia as 5 | 15 | 25,
    fechaInicio: fecha,
    monto,
    valorCuota: cuotasDetalle[0]?.monto ?? Math.floor(montoMat / nCuotas),
    simulado: false,
    cuotasDetalle,
    valorMatriculaBruto: montoBrutoMatricula(),
    valorArancelBruto: montoBrutoArancel(),
    descuentos: descuentosParaContrato(),
    numOperacion,
    contrato,
  }
  console.log('[forma-pago] pagoMatricula pagaré → firma', payload)
  alumnoCtx.setPagoMatricula(payload)
  alumnoCtx.setFormaPago('pagare')

  // Registrar evento de forma de pago confirmada
  await registrarFormaPagoAudit({
    rutAlumno: rutMostrado.value,
    codcli: codcliMostrado.value,
    nombreAlumno: nombreMostrado.value,
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: false,
    accion: 'confirmado',
    payload: {
      medio: 'pagare',
      cuotas: nCuotas,
      montoMatricula: montoMat,
      montoArancel: montoAra,
      montoTotal: monto,
      simulado: false,
      numOperacion: numOperacion ?? null,
      contrato: contrato ?? null,
    },
  })

  alumnoCtx.marcarPasoAlcanzado(3)
  toast.success('Plan de pagos confirmado. Continúa con el contrato.')
  const medioMat = medioPagoMatricula.value ?? alumnoCtx.medioMatricula
  const medioAra = medioPagoArancel.value ?? alumnoCtx.medioArancel
  cerrarPagoMatriculaDialog()
  if (medioMat == null || medioAra == null) return
  const paso = siguientePaso({
    medioMatricula: medioMat,
    medioArancel: medioAra,
    matriculaAutorizada: alumnoCtx.webpayMatriculaEstado === 'autorizada',
    arancelAutorizado: alumnoCtx.webpayArancelEstado === 'autorizada',
    planListo: true,
  })
  if (paso.tipo === 'firma') {
    alumnoCtx.marcarPasoAlcanzado(3)
    void router.push({ name: 'matricula-alumno-firma' })
  }
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
  alumnoCtx.setFormaPago(medio)
  const labels = { webpay: 'WebPay', pagare: 'Pagaré', toku: 'TOKU' } as const
  toast.success(`Pago simulado vía ${labels[medio]}.`)
  alumnoCtx.marcarPasoAlcanzado(3)
  void router.push({ name: 'matricula-alumno-firma' })
}

function cerrarModalDeuda() {
  deudaModalOpen.value = false
}

function volverDatosPersonales() {
  void router.push({ name: 'matricula-alumno-datos' })
}

function anterior() {
  if (subPaso.value === 'pago') {
    subPaso.value = 'becas'
    return
  }
  if (subPaso.value === 'becas') {
    void router.push({ name: 'matricula-alumno-datos' })
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
    <MatriculaAlumnoVerificacionCaeStep
      v-if="subPaso === 'verificacion-cae'"
      :estado="estadoVerificacionCae"
      :reintentando="reintentandoCae"
      :periodo-label="periodoActivoLabel"
      :nombre-alumno="nombreMostrado"
      :codcli="codcliMostrado"
      :reserva-texto="textoReservaMatricula"
      @reintentar="correrVerificacionCae(true)"
      @volver="volverDatosPersonales"
    />

    <MatriculaAlumnoVerificacionEstatalStep
      v-else-if="subPaso === 'verificacion-estatal'"
      :periodo-label="periodoActivoLabel"
      :nombre-alumno="nombreMostrado"
      :codcli="codcliMostrado"
      :beneficios="nombresBecaEstatal"
      :reintentando="reintentandoEstatal"
      :reserva-texto="textoReservaMatricula"
      @reintentar="correrVerificacionEstatal"
      @volver="volverDatosPersonales"
    />

    <!-- V06 Becas y plan -->
    <template v-else-if="subPaso === 'becas'">
      <section
        class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        aria-labelledby="rematricula-contexto"
      >
        <div
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white"
          style="background: linear-gradient(90deg, #ff5b00 0%, #ee2183 50%, #4d98c5 100%)"
        >
          <GraduationCap class="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{{ periodoActivo.tituloRematricula }}</span>
        </div>
        <div class="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="sm:col-span-2">
            <p id="rematricula-contexto" class="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Carrera
            </p>
            <p class="mt-1 text-base font-semibold text-zinc-900">{{ carreraRematricula }}</p>
            <p v-if="tipoCarreraMostrada !== '—'" class="mt-0.5 text-sm text-zinc-600">
              {{ tipoCarreraMostrada }}
            </p>
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Jornada</p>
            <p class="mt-1 text-sm font-semibold text-zinc-900">{{ jornadaRematricula }}</p>
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Periodo</p>
            <p class="mt-1 text-sm font-semibold text-zinc-900">{{ periodoActivoLabel ?? '—' }}</p>
          </div>
          <div class="sm:col-span-2 lg:col-span-4">
            <p class="text-sm text-zinc-600">
              <span class="font-semibold text-zinc-900">{{ nombreMostrado }}</span>
              <span class="mx-2 text-zinc-300" aria-hidden="true">·</span>
              RUT {{ rutMostrado }}
            </p>
          </div>
        </div>
      </section>

      <section
        class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        aria-labelledby="promedio-titulo"
      >
        <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-8">
          <p class="text-4xl font-semibold tabular-nums tracking-tight text-zinc-900">
            {{ notaPromedioMostrada }}
          </p>
          <div class="min-w-0 border-zinc-200 sm:border-l sm:pl-8">
            <p id="promedio-titulo" class="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Tu promedio
            </p>
            <p class="mt-1 text-base font-semibold text-zinc-900">{{ etiquetaFuentePromedio }}</p>
            <p class="mt-1 text-sm text-zinc-600">{{ efectoPromedio }}</p>
          </div>
        </div>
      </section>

      <div
        v-if="cargandoArancelSp"
        class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
      >
        Consultando matrícula y arancel…
      </div>
      <div
        v-else-if="errorArancelSp"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p>{{ errorArancelSp }}</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3 cursor-pointer"
          type="button"
          :disabled="!plan"
          @click="plan && cargarArancelDesdeErp(plan)"
        >
          Reintentar
        </Button>
      </div>

      <div class="grid gap-6 lg:grid-cols-5">
        <Card class="shadow-md lg:col-span-3">
          <CardHeader>
            <CardTitle class="text-lg text-zinc-900">Tus beneficios</CardTitle>
            <CardDescription>
              Periodo {{ periodoBeneficioLabel }}. El porcentaje de cada beca ya considera tu promedio.
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <p v-if="cargandoCarteraBeneficios" class="text-sm text-zinc-600">
              Consultando tus beneficios…
            </p>
            <p v-else-if="errorCarteraBeneficios" class="text-sm text-red-700">
              {{ errorCarteraBeneficios }}
            </p>
            <ul v-else-if="beneficios.length > 0" class="space-y-2">
              <li v-for="b in beneficios" :key="b.slot">
                <label
                  v-if="beneficioSeleccionable(b) && filaDe(b.slot)?.resultado !== 'PIERDE'"
                  class="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-200"
                  :class="
                    beneficioMarcado(b.slot)
                      ? 'border-uniacc-orange/40 bg-uniacc-orange/5'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  "
                >
                  <Checkbox
                    :checked="beneficioMarcado(b.slot)"
                    class="cursor-pointer"
                    @update:checked="(v: boolean) => setBeneficioSeleccionado(b.slot, v === true)"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-zinc-900">
                      {{ b.descripcion || 'Beneficio' }}
                    </span>
                    <span class="mt-0.5 block text-xs text-zinc-500">
                      {{ filaDe(b.slot) ? textoPorcentajeFila(filaDe(b.slot)!) : 'Sin porcentaje' }}
                    </span>
                  </span>
                  <span
                    v-if="beneficioMarcado(b.slot)"
                    class="shrink-0 text-sm font-semibold tabular-nums text-emerald-700"
                  >
                    − {{ fmt(filaDe(b.slot)?.monto ?? 0) }}
                  </span>
                </label>
                <div
                  v-else-if="filaDe(b.slot)?.resultado === 'PIERDE'"
                  class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium text-zinc-700">
                      {{ b.descripcion || 'Beneficio' }}
                    </span>
                    <span class="mt-0.5 block text-xs text-zinc-500">
                      {{ textoPorcentajeFila(filaDe(b.slot)!) }}
                    </span>
                  </span>
                </div>
                <div
                  v-else
                  class="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3"
                >
                  <span class="min-w-0 flex-1 text-sm text-zinc-700">
                    {{ b.descripcion || 'Beneficio' }}
                  </span>
                  <Badge v-if="b.aplica === false" variant="outline" class="text-[10px]">
                    {{ etiquetaNoAplica(b.flujo) }}
                  </Badge>
                  <span v-else class="text-xs text-zinc-500">No disponible</span>
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-zinc-600">
              No hay beneficios asociados para este periodo.
            </p>
          </CardContent>
        </Card>

        <div class="space-y-4 lg:col-span-2">
          <Card class="border-orange-100 shadow-md">
            <CardHeader class="pb-2">
              <CardTitle class="text-base text-uniacc-orange">Arancel</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2 text-sm">
              <div class="flex justify-between gap-2">
                <span>Valor arancel</span>
                <span class="tabular-nums">{{ fmt(montoBrutoArancel()) }}</span>
              </div>
              <div
                v-for="linea in lineasDescuento"
                :key="linea.slot"
                class="flex justify-between gap-3 text-emerald-700"
              >
                <span class="min-w-0 truncate">{{ linea.descripcion }}</span>
                <span class="shrink-0 tabular-nums">− {{ fmt(linea.monto) }}</span>
              </div>
              <p v-if="lineasDescuento.length === 0" class="text-xs text-zinc-500">
                Sin descuentos aplicados.
              </p>
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
                v-if="descuentoMatriculaMes && montoDescuentoMatriculaAplicado() > 0"
                class="flex justify-between gap-3 text-emerald-700"
              >
                <span class="min-w-0 truncate">{{ descuentoMatriculaMes.nombre }}</span>
                <span class="shrink-0 tabular-nums">− {{ fmt(montoDescuentoMatriculaAplicado()) }}</span>
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
              <p
                v-else-if="!gateConvenioMatricula.puedePagarPorConvenio && gateConvenioMatricula.mensaje"
                class="text-xs text-amber-800"
              >
                {{ gateConvenioMatricula.mensaje }}
              </p>
              <p v-else-if="resumenPagoMatricula" class="text-xs text-zinc-600">
                Configurado: {{ resumenPagoMatricula }}
              </p>
              <div class="mt-2 grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
                  :disabled="!puedeAbrirPagoMatricula"
                  @click="abrirPagoMatricula"
                >
                  {{
                    abriendoPagoMatricula || cargandoDeuda
                      ? 'Validando…'
                      : tieneDeuda
                        ? 'Deuda pendiente'
                        : 'Realizar pago'
                  }}
                </Button>
                <!-- <Button
                  type="button"
                  variant="outline"
                  class="w-full cursor-pointer border-uniacc-orange text-uniacc-orange hover:bg-uniacc-orange/10"
                  :disabled="!puedeAbrirPagoMatricula"
                  @click="abrirPagoMatricula"
                >
                  Webpay
                </Button> -->
              </div>
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
            requieren subir el documento que acredita su vigencia para poder pagar la matrícula.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <ConvenioVigenteUpload
            v-for="m in conveniosDetectados"
            :key="m.convenio.id"
            :match="m"
            :documento="alumnoCtx.conveniosDocumentos[m.convenio.id] ?? null"
            :contexto="contextoConvenio"
            :estado-caso="estadoPorConvenioId[m.convenio.id] ?? null"
            :motivo-rechazo="motivoPorConvenioId[m.convenio.id] ?? null"
            @subido="onConvenioSubido"
            @eliminado="onConvenioEliminado"
          />
        </CardContent>
      </Card>

      <div class="flex flex-wrap justify-between gap-3">
        <Button variant="outline" type="button" @click="anterior">Anterior</Button>
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

      <p v-if="alumnoCtx.formaPagoSeleccionada" class="text-sm text-muted-foreground">
        Medio seleccionado: {{ alumnoCtx.formaPagoSeleccionada }}
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
            ? 'flex max-h-[90vh] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden'
            : 'max-h-[85vh] max-w-lg sm:max-w-xl'
        "
      >
        <DialogHeader class="shrink-0 space-y-3 text-left">
          <DialogTitle class="text-xl text-zinc-900">
            {{ pagoMatriculaPaso === 'selector' ? 'Forma de pago' : 'Plan de pagos' }}
          </DialogTitle>
          <DialogDescription v-if="pagoMatriculaPaso === 'selector'" class="text-sm text-muted-foreground">
            Confirma el medio para matrícula y arancel. Luego definirás cuotas y vencimientos.
          </DialogDescription>
          <DialogDescription v-else class="text-sm text-muted-foreground">
            Revisa las cuotas y el documento de cada beca, en matrícula o en arancel.
          </DialogDescription>
        </DialogHeader>

        <div v-if="pagoMatriculaPaso === 'selector'" class="space-y-5 py-1">
          <div
            class="rounded-lg border border-uniacc-orange/25 bg-gradient-to-br from-uniacc-orange/10 to-white px-4 py-3"
          >
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total a financiar
            </p>
            <p class="mt-1 text-2xl font-semibold tabular-nums text-uniacc-orange">
              {{ fmt(montoNetoMatricula() + montoNetoArancel()) }}
            </p>
            <div class="mt-3 grid gap-1.5 text-sm text-zinc-700 sm:grid-cols-2">
              <p class="flex justify-between gap-2 sm:block">
                <span class="text-muted-foreground">Matrícula: </span>
                <span class="font-medium tabular-nums">{{ fmt(montoNetoMatricula()) }}</span>
              </p>
              <p class="flex justify-between gap-2 sm:block">
                <span class="text-muted-foreground">Arancel: </span>
                <span class="font-medium tabular-nums">{{ fmt(montoNetoArancel()) }}</span>
              </p>
            </div>
          </div>

          <div
            v-if="faseSalida === 'webpay'"
            class="flex flex-col items-center gap-3 rounded-lg border border-uniacc-orange/25 bg-uniacc-orange/5 px-4 py-6 text-center"
            role="status"
            aria-live="polite"
          >
            <span
              class="flex h-12 w-12 items-center justify-center rounded-full bg-uniacc-orange/15 text-uniacc-orange"
            >
              <CreditCard class="h-6 w-6" aria-hidden="true" />
            </span>
            <p class="text-sm font-medium text-zinc-900">{{ AVISO_SALIDA_WEBPAY }}</p>
            <p class="text-3xl font-semibold tabular-nums text-uniacc-orange">{{ segundosSalida }}</p>
            <p class="text-xs text-muted-foreground">
              {{ creandoWebpay ? 'Creando el pago…' : 'segundos para salir' }}
            </p>
          </div>

          <template v-else>
            <div
              v-if="avisoWebpay"
              class="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{{ avisoWebpay }}</p>
            </div>

            <section class="space-y-2">
              <h3 class="text-sm font-semibold text-zinc-900">Matrícula</h3>
              <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                :disabled="matriculaPagadaWebpay"
                :class="clasesBotonMedio(medioPagoMatricula === 'pagare', matriculaPagadaWebpay)"
                :aria-pressed="medioPagoMatricula === 'pagare'"
                @click="medioPagoMatricula = 'pagare'"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-uniacc-orange/15 text-uniacc-orange"
                >
                  <FileText class="h-5 w-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-zinc-900">Pagaré</span>
                  <span class="block text-xs text-muted-foreground">
                    {{ matriculaPagadaWebpay ? 'Pagada' : `En cuotas · ${fmt(montoNetoMatricula())}` }}
                  </span>
                </span>
                <span
                  v-if="medioPagoMatricula === 'pagare'"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-white"
                  aria-hidden="true"
                >
                  <Check class="h-3.5 w-3.5" />
                </span>
              </button>
              <button
                type="button"
                :disabled="matriculaPagadaWebpay"
                :class="clasesBotonMedio(medioPagoMatricula === 'webpay', matriculaPagadaWebpay)"
                :aria-pressed="medioPagoMatricula === 'webpay'"
                @click="iniciarSalidaWebpay('matricula')"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-uniacc-orange/15 text-uniacc-orange"
                >
                  <CreditCard class="h-5 w-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-zinc-900">Webpay</span>
                  <span class="block text-xs text-muted-foreground">
                    {{
                      matriculaPagadaWebpay
                        ? textoWebpayAprobado('Pagada', alumnoCtx.webpayMatriculaDetalle)
                        : `Pago en línea · ${fmt(montoNetoMatricula())}`
                    }}
                  </span>
                </span>
                <span
                  v-if="medioPagoMatricula === 'webpay'"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-white"
                  aria-hidden="true"
                >
                  <Check class="h-3.5 w-3.5" />
                </span>
              </button>
              </div>
            </section>

            <section class="space-y-2">
              <h3 class="text-sm font-semibold text-zinc-900">Arancel</h3>
              <div class="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                :disabled="!arancelEncendido"
                :class="clasesBotonMedio(medioPagoArancel === 'pagare', !arancelEncendido)"
                :aria-pressed="medioPagoArancel === 'pagare'"
                @click="medioPagoArancel = 'pagare'"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-uniacc-orange/15 text-uniacc-orange"
                >
                  <FileText class="h-5 w-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-zinc-900">Pagaré</span>
                  <span class="block text-xs text-muted-foreground">
                    {{ arancelPagadoWebpay ? 'Pagado' : `En cuotas · ${fmt(montoNetoArancel())}` }}
                  </span>
                </span>
                <span
                  v-if="medioPagoArancel === 'pagare'"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-white"
                  aria-hidden="true"
                >
                  <Check class="h-3.5 w-3.5" />
                </span>
              </button>
              <button
                type="button"
                :disabled="!arancelEncendido"
                :class="clasesBotonMedio(medioPagoArancel === 'webpay', !arancelEncendido)"
                :aria-pressed="medioPagoArancel === 'webpay'"
                @click="iniciarSalidaWebpay('arancel')"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-uniacc-orange/15 text-uniacc-orange"
                >
                  <CreditCard class="h-5 w-5" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-zinc-900">Webpay</span>
                  <span class="block text-xs text-muted-foreground">
                    {{
                      arancelPagadoWebpay
                        ? textoWebpayAprobado('Pagado', alumnoCtx.webpayArancelDetalle)
                        : `Pago en línea · ${fmt(montoWebpayArancel(montoNetoArancel()))}`
                    }}
                  </span>
                </span>
                <span
                  v-if="medioPagoArancel === 'webpay'"
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-uniacc-orange text-white"
                  aria-hidden="true"
                >
                  <Check class="h-3.5 w-3.5" />
                </span>
              </button>
              </div>
            </section>

            <p class="text-xs text-muted-foreground">
              Elige Pagaré o Webpay en cada concepto. Si seleccionas Pagaré en cualquiera de los conceptos, después podrás generar el plan de pagos.
            </p>
          </template>
        </div>

        <div v-else class="flex min-h-0 flex-1 flex-col gap-4 py-2">
          <div class="shrink-0 space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-if="medioPagoMatricula === 'pagare'"
                class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Matrícula
                </p>
                <p class="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                  {{ fmt(montoNetoMatricula()) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ pagareTotalCuotas }} cuotas de {{ fmt(valorCuotaPagareMat) }}
                </p>
              </div>
              <div
                v-if="medioPagoArancel === 'pagare'"
                class="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Arancel
                </p>
                <p class="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                  {{ fmt(montoNetoArancel()) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ pagareTotalCuotas }} cuotas de {{ fmt(valorCuotaPagareAra) }}
                </p>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-3">
              <div class="space-y-2">
                <Label>Cantidad de cuotas</Label>
                <Select v-model="pagareTotalCuotas">
                  <SelectTrigger>
                    <SelectValue placeholder="Cuotas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 cuotas</SelectItem>
                    <SelectItem value="12">12 cuotas</SelectItem>
                  </SelectContent>
                </Select>
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
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              <template v-if="etiquetaPrimeraCuota">
                Primera cuota del periodo: {{ etiquetaPrimeraCuota }} (día
                {{ pagareDiaVencimiento }}).
              </template>
              <template v-else>
                Día {{ pagareDiaVencimiento }} del mes siguiente a hoy.
              </template>
            </p>

            <Button
              type="button"
              variant="secondary"
              class="cursor-pointer"
              :disabled="!pagareFechaInicio || !pagareDiaVencimiento || cargandoPreflight"
              @click="generarCuotasPagare"
            >
              {{ cargandoPreflight ? 'Consultando…' : 'Generar cuotas' }}
            </Button>
          </div>

          <div
            v-if="bloquesPlanPago.some((b) => b.descuentos.length || b.rows.length)"
            class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5"
          >
            <template v-for="bloque in bloquesPlanPago" :key="bloque.titulo">
            <section
              v-if="
                bloque.titulo === 'Matrícula'
                  ? medioPagoMatricula === 'pagare'
                  : medioPagoArancel === 'pagare'
              "
              class="overflow-hidden rounded-lg border border-zinc-200"
            >
              <div class="flex items-baseline justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <h3 class="text-sm font-semibold text-zinc-900">{{ bloque.titulo }}</h3>
                <p class="text-sm font-medium tabular-nums text-zinc-900">{{ fmt(bloque.monto) }}</p>
              </div>

              <div v-if="bloque.descuentos.length" class="border-b border-zinc-200 px-3 py-3">
                <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Descuentos
                </p>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[36rem] border-collapse text-left text-xs">
                    <thead>
                      <tr class="border-b border-zinc-200 text-muted-foreground">
                        <th class="py-1.5 pr-3 font-medium">Documento</th>
                        <th class="py-1.5 pr-3 font-medium">Tipo de documento</th>
                        <th class="py-1.5 pr-3 font-medium">Beca</th>
                        <th class="py-1.5 pr-3 text-right font-medium">Valor</th>
                        <th class="py-1.5 font-medium">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="descuento in bloque.descuentos"
                        :key="descuento.documento"
                        class="border-b border-zinc-100 last:border-0"
                      >
                        <td class="py-2 pr-3 font-mono text-[11px]">{{ descuento.documento }}</td>
                        <td class="py-2 pr-3">{{ descuento.tipoDocumento }}</td>
                        <td class="py-2 pr-3">{{ descuento.descripcion }}</td>
                        <td class="py-2 pr-3 text-right tabular-nums">{{ fmt(descuento.monto) }}</td>
                        <td class="py-2">{{ descuento.vencimiento }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                v-if="bloque.rows.length && (bloque.titulo === 'Matrícula' ? medioPagoMatricula === 'pagare' : medioPagoArancel === 'pagare')"
                class="px-3 py-3"
              >
                <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cuotas del pagaré
                </p>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[28rem] border-collapse text-left text-xs">
                    <thead>
                      <tr class="border-b border-zinc-200 text-muted-foreground">
                        <th class="py-1.5 pr-3 font-medium">Cuota</th>
                        <th class="py-1.5 pr-3 font-medium">Documento</th>
                        <th class="py-1.5 pr-3 font-medium">Vencimiento</th>
                        <th class="py-1.5 text-right font-medium">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in bloque.rows"
                        :key="row.correlativo"
                        class="border-b border-zinc-100 last:border-0"
                      >
                        <td class="py-2 pr-3">{{ row.cuota }} de {{ row.totalCuotas }}</td>
                        <td class="py-2 pr-3 font-mono text-[11px]">{{ row.correlativo }}</td>
                        <td class="py-2 pr-3">{{ fmtFechaCuota(row.vencimiento) }}</td>
                        <td class="py-2 text-right tabular-nums">{{ fmt(row.monto) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
            </template>
          </div>
        </div>

        <DialogFooter class="shrink-0 gap-2 border-t border-zinc-200 pt-4 sm:gap-0">
          <Button
            v-if="pagoMatriculaPaso === 'pagare'"
            type="button"
            variant="outline"
            @click="volverSelectorPagoMatricula"
          >
            Volver
          </Button>
          <Button type="button" variant="outline" @click="cancelarOCerrarPagoMatricula">
            Cancelar
          </Button>
          <Button
            v-if="pagoMatriculaPaso === 'selector' && faseSalida === 'opciones'"
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="!puedeContinuarSelectorMedios || cargandoPreflight || creandoWebpay"
            @click="continuarSelectorMedios"
          >
            {{ creandoWebpay ? 'Redirigiendo…' : 'Continuar' }}
          </Button>
          <Button
            v-if="pagoMatriculaPaso === 'pagare'"
            type="button"
            class="bg-uniacc-orange hover:bg-uniacc-orange/90"
            :disabled="pagareCuotasPreview.length !== cuotasEsperadasPagare"
            @click="confirmarPagareMatricula"
          >
            Confirmar plan
          </Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
