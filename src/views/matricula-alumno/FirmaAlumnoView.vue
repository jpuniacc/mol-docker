<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppWindow, Check, Circle, Download, Loader2, Mail } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { mostrarErrorRematricula } from '@/stores/errorRematricula'

import AccionesFlujo from '@/components/rematricula/AccionesFlujo.vue'
import ContratoPrestacionServiciosPreview from '@/components/rematricula/ContratoPrestacionServiciosPreview.vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useContratoMatriculaViewModel } from '@/composables/useContratoMatriculaViewModel'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { fetchPlanPagosMvByCodcli } from '@/services/fetchPlanPagosMv'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import {
  ensureContratoFirma,
  getContratoFirmaEstado,
  getEnlaceFirmaFirmante,
  type ContratoFirmaEstadoResponse,
  type ContratoFirmaFirmanteEstado,
} from '@/services/contratoFirmaApi'
import { downloadContratoPreviewPdf } from '@/services/contratoPreviewApi'
import { registrarFirmaAudit } from '@/services/firmaAuditLog'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { useDatosAlumnoMnpStore } from '@/stores/datosAlumnoMnp'
import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { esPropioSostenedor } from '@/utils/apoderadoResponsable'
import { estadoFirmaDual } from '@/utils/firmaDual'
import {
  armarGrabarCuentaMixta,
  armarGrabarPlanPagos,
  postGrabarPlanPagos,
} from '@/services/grabarPlanPagosApi'
import { asignarDocumentosDescuento } from '@/utils/documentosDescuentoContrato'
import { armarGrabarCuentaWebpay } from '@/utils/grabarCuentaWebpay'
import { numeroOperacionContrato } from '@/utils/numeroOperacionContrato'
import { ordenGrabadoWebpay } from '@/utils/ordenGrabadoWebpay'
import { hoyIsoLocal } from '@/utils/pagareCuotasDraft'

const POLL_MS = 5000
const PASO_ENVIO_MS = 2_000
const AVISO_LENTO_MS = 30_000
const ESPERA_ENLACE_MS = 1_000
const REINTENTOS_ENLACE = 3

type PasoEnvioFirma = 'generando' | 'enviando' | 'listo'
type EstadoPasoEnvio = 'pendiente' | 'actual' | 'listo'

const router = useRouter()
const alumnoCtx = useMatriculaAlumnoContextStore()
const alumnoMnp = useDatosAlumnoMnpStore()
const preflight = useMatriculaFlujoPreflightStore()
const periodoActivo = usePeriodoActivoStore()
const fuente = useAlumnoRematriculaFuente()
const { viewModel, tienePlanConfirmado } = useContratoMatriculaViewModel('alumno')

const descargando = ref(false)
const aceptado = ref(false)
const enviando = ref(false)
const pasoEnvio = ref<PasoEnvioFirma | null>(null)
const avisoLento = ref(false)
const alcanzoEnvio = ref(false)
const errorFirma = ref<string | null>(null)
const firmantes = ref<ContratoFirmaFirmanteEstado[]>([])
const restaurandoFirma = ref(false)
const numOperacionFirma = ref<string | null>(null)
const enlacesFirma = ref<Record<string, string>>({})
const preparandoEnlaces = ref(false)
const errorEnlaces = ref<string | null>(null)
const segundosEspera = ref(0)
const esperaOperacion = ref<string | null>(null)
const firmaHabilitada = ref(false)
const contratoFirmadoRegistrado = ref(false)
const grabandoPlan = ref(false)
const planGrabado = ref(false)
const errorGrabacion = ref<string | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let timerEnviando: ReturnType<typeof setTimeout> | null = null
let timerProcesando: ReturnType<typeof setTimeout> | null = null
let timerEspera: ReturnType<typeof setInterval> | null = null
let unmounted = false
let abriendoFirma = false

const firmanteAlumno = computed(
  () => firmantes.value.find((firmante) => firmante.rol === 'alumno') ?? null,
)
const firmanteApoderado = computed(
  () => firmantes.value.find((firmante) => firmante.rol === 'apoderado') ?? null,
)
const firmaDual = computed(() =>
  estadoFirmaDual({
    hayApoderado: firmanteApoderado.value != null,
    alumnoFirmado: firmanteAlumno.value?.ready === true,
    apoderadoFirmado: firmanteApoderado.value?.ready === true,
  }),
)

const enlacesListos = computed(
  () => !preparandoEnlaces.value && (segundosEspera.value > 0 || firmaHabilitada.value),
)

const pasosEnvioVisibles = computed(() => {
  const paso = pasoEnvio.value
  if (!paso) return []
  const textos: Record<PasoEnvioFirma, string> = {
    generando: 'Estamos generando tu contrato.',
    enviando: 'Estamos enviando tu contrato a firmar.',
    listo: 'Ya puedes firmar.',
  }
  if (paso === 'listo' && !alcanzoEnvio.value) {
    return [{ id: 'listo' as const, texto: textos.listo, estado: 'listo' as EstadoPasoEnvio }]
  }
  const orden: PasoEnvioFirma[] = ['generando', 'enviando', 'listo']
  const idx = orden.indexOf(paso)
  return orden.map((id, i) => {
    let estado: EstadoPasoEnvio = 'pendiente'
    if (i < idx || paso === 'listo') estado = 'listo'
    else if (i === idx) estado = 'actual'
    return { id, texto: textos[id], estado }
  })
})

function clearEnvioTimers(): void {
  if (timerEnviando !== null) {
    clearTimeout(timerEnviando)
    timerEnviando = null
  }
  if (timerProcesando !== null) {
    clearTimeout(timerProcesando)
    timerProcesando = null
  }
}

function iniciarProgresoEnvio(): void {
  clearEnvioTimers()
  pasoEnvio.value = 'generando'
  avisoLento.value = false
  alcanzoEnvio.value = false
  timerEnviando = setTimeout(() => {
    if (pasoEnvio.value !== 'generando') return
    pasoEnvio.value = 'enviando'
    alcanzoEnvio.value = true
  }, PASO_ENVIO_MS)
  timerProcesando = setTimeout(() => {
    if (pasoEnvio.value !== 'generando' && pasoEnvio.value !== 'enviando') return
    pasoEnvio.value = 'enviando'
    alcanzoEnvio.value = true
    avisoLento.value = true
  }, AVISO_LENTO_MS)
}

function cerrarProgresoOk(): void {
  clearEnvioTimers()
  avisoLento.value = false
  pasoEnvio.value = 'listo'
}

function cerrarProgresoError(): void {
  clearEnvioTimers()
  pasoEnvio.value = null
  avisoLento.value = false
  alcanzoEnvio.value = false
}

function clearPoll(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function completarYNavegar(): void {
  clearPoll()
  alumnoCtx.setFirmaCompletada(true)
  void router.push({ name: 'matricula-alumno-resumen' })
}

function contextoFirma() {
  const limpio = (valor: string): string | null => {
    const texto = valor.trim()
    return !texto || texto === '—' ? null : texto
  }
  return {
    rutAlumno: limpio(fuente.rutMostrado.value),
    codcli: limpio(fuente.codcliMostrado.value),
    nombreAlumno: limpio(fuente.nombreMostrado.value),
    anioPeriodo: periodoActivo.anio,
    semestrePeriodo: periodoActivo.semestre,
    esMock: false,
  }
}

async function registrarPasoFirma(
  accion: 'enviado' | 'firmado',
  numOperacion: string,
): Promise<void> {
  await registrarFirmaAudit({
    ...contextoFirma(),
    accion,
    numOperacion,
  })
}

function clearEsperaFirma(): void {
  if (timerEspera !== null) {
    clearInterval(timerEspera)
    timerEspera = null
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function puedeAbrirFirma(email: string): boolean {
  return firmaHabilitada.value && Boolean(enlacesFirma.value[email])
}

function iniciarCuentaRegresiva(): void {
  clearEsperaFirma()
  segundosEspera.value = 2
  firmaHabilitada.value = false
  timerEspera = setInterval(() => {
    if (segundosEspera.value <= 1) {
      segundosEspera.value = 0
      firmaHabilitada.value = true
      clearEsperaFirma()
      return
    }
    segundosEspera.value -= 1
  }, ESPERA_ENLACE_MS)
}

function identidadFirma(): { rut: string; codcli: string } | undefined {
  const rut = fuente.rutMostrado.value.trim()
  const codcli = fuente.codcliMostrado.value.trim()
  if (!rut || rut === '—' || !codcli || codcli === '—') return undefined
  return { rut, codcli }
}

function volverAFormaDePagoSiNumeroAjeno(error: string): boolean {
  if (!error.toLowerCase().includes('otro alumno')) return false
  void router.push({ name: 'matricula-alumno-forma-pago' })
  return true
}

async function prepararFirma(numOperacion: string): Promise<void> {
  if (esperaOperacion.value === numOperacion) return
  const pendientes = firmantes.value.filter((firmante) => !firmante.ready)
  if (pendientes.length === 0) return
  esperaOperacion.value = numOperacion
  preparandoEnlaces.value = true
  errorEnlaces.value = null
  firmaHabilitada.value = false
  segundosEspera.value = 0
  const obtenidos: Record<string, string> = {}
  let fallo: string | null = null
  for (const firmante of pendientes) {
    if (enlacesFirma.value[firmante.email]) {
      obtenidos[firmante.email] = enlacesFirma.value[firmante.email]
      continue
    }
    let enlace: string | null = null
    let ultimoError = 'No se pudo preparar el enlace de firma.'
    for (let intento = 0; intento < REINTENTOS_ENLACE && !enlace; intento += 1) {
      if (intento > 0) await esperar(ESPERA_ENLACE_MS)
      if (unmounted) return
      const res = await getEnlaceFirmaFirmante(numOperacion, firmante.email)
      if (res.ok) enlace = res.signatureLink
      else ultimoError = res.error
    }
    if (!enlace) {
      fallo = ultimoError
      break
    }
    obtenidos[firmante.email] = enlace
  }
  if (unmounted) return
  preparandoEnlaces.value = false
  if (fallo) {
    esperaOperacion.value = null
    errorEnlaces.value = fallo
    mostrarErrorRematricula(fallo, {
      reintentar: () => {
        esperaOperacion.value = null
        void prepararFirma(numOperacion)
      },
    })
    return
  }
  enlacesFirma.value = { ...enlacesFirma.value, ...obtenidos }
  iniciarCuentaRegresiva()
}

function reintentarEnlaces(): void {
  const num = numOperacionFirma.value
  if (!num || preparandoEnlaces.value) return
  esperaOperacion.value = null
  void prepararFirma(num)
}

function abrirFirma(email: string): void {
  if (abriendoFirma || !puedeAbrirFirma(email)) return
  const link = enlacesFirma.value[email]
  if (!link) return
  abriendoFirma = true
  const ventana = window.open(link, '_blank')
  abriendoFirma = false
  if (!ventana) {
    mostrarErrorRematricula(
      'El navegador bloqueó la ventana de firma. Permite ventanas emergentes e inténtalo de nuevo.',
    )
  }
}

const ambosWebpay = computed(
  () =>
    alumnoCtx.medioMatricula === 'webpay' &&
    alumnoCtx.webpayMatriculaEstado === 'autorizada' &&
    alumnoCtx.medioArancel === 'webpay' &&
    alumnoCtx.webpayArancelEstado === 'autorizada',
)

// Tras Transbank la SPA recarga y el preflight queda vacío. Se pide igual que en la forma de pago.
async function asegurarPreflightWebpay(): Promise<string | null> {
  const rut = fuente.rutMostrado.value
  if (!rut || rut === '—') return 'Sin RUT para consultar correlativos ERP'
  let codCarr = ''
  const codcli = fuente.codcliMostrado.value.trim()
  if (codcli && codcli !== '—' && periodoActivo.anio != null && periodoActivo.semestre != null) {
    const { data } = await fetchPlanPagosMvByCodcli({
      codcli,
      anioMatricula: periodoActivo.anio,
      periodoMatricula: periodoActivo.semestre,
    })
    codCarr = (data?.cod_carrera ?? '').trim()
  }
  if (!codCarr) codCarr = (alumnoMnp.primeraFila?.codigo_carrera ?? '').trim()
  if (!codCarr) return 'Sin código de carrera para preflight ERP'
  const ok = await preflight.fetchFromErp({
    rutCompleto: rut,
    codCarr,
    ano: periodoActivo.anio,
    periodo: periodoActivo.semestre,
  })
  if (!ok || !(preflight.corrpagnumPreview ?? '').trim() || !(preflight.contratoPreview ?? '').trim()) {
    return preflight.error || 'No se pudo obtener CORRPAGNUM del preflight ERP'
  }
  return null
}

async function grabarCuentaWebpay(cerrarFicha: boolean): Promise<boolean> {
  if (grabandoPlan.value) return false
  if (!(preflight.contratoPreview ?? '').trim() || !(preflight.corrpagnumPreview ?? '').trim()) {
    grabandoPlan.value = true
    errorGrabacion.value = null
    let errorPreflight: string | null
    try {
      errorPreflight = await asegurarPreflightWebpay()
    } finally {
      grabandoPlan.value = false
    }
    if (unmounted) return false
    if (errorPreflight) {
      errorGrabacion.value = errorPreflight
      return false
    }
  }
  const peek = (preflight.corrpagnumPreview ?? '').trim()
  const lineas = alumnoCtx.lineasBeneficioGrabar
  const hayBeneficios = lineas.some((linea) => linea.monto > 0)
  if (hayBeneficios && !/^\d+$/.test(peek)) {
    errorGrabacion.value = 'Faltan los folios de los beneficios'
    return false
  }
  const contrato = (preflight.contratoPreview ?? '').trim()
  if (!contrato) {
    errorGrabacion.value = 'Falta el número de contrato'
    return false
  }
  const fechaInicio = hoyIsoLocal()
  const descuentos = hayBeneficios
    ? asignarDocumentosDescuento({
        peek,
        lineas,
        vencimiento: fechaInicio,
        // El 5 % pide CORRPAGNUM dentro del procedimiento y recibe peek (Valor+1); el primer beneficio es peek+1.
        reservadosPagare: 1,
      })
    : []
  const armado = armarGrabarCuentaWebpay({
    rut: fuente.rutMostrado.value,
    codcliAcademico: fuente.codcliMostrado.value,
    codigoCarrera: alumnoMnp.primeraFila?.codigo_carrera ?? '',
    ano: periodoActivo.anio,
    periodo: periodoActivo.semestre,
    caja: preflight.steps?.caja.row?.caja ?? null,
    contrato,
    fechaInicio,
    montoMatricula: alumnoCtx.webpayMontoMatricula ?? 0,
    montoArancel: alumnoCtx.webpayMontoArancel ?? 0,
    descuentos,
    cerrarFicha,
  })
  if (!armado.ok) {
    errorGrabacion.value = armado.error
    return false
  }
  grabandoPlan.value = true
  errorGrabacion.value = null
  const res = await postGrabarPlanPagos(armado.payload)
  grabandoPlan.value = false
  if (unmounted) return false
  if (!res.ok) {
    errorGrabacion.value = res.error
    return false
  }
  if (/^\d+$/.test(res.numOperacion)) alumnoCtx.setNumOperacionCuenta(res.numOperacion)
  return true
}

async function grabarPlanFirmado(): Promise<boolean> {
  if (planGrabado.value || grabandoPlan.value) return planGrabado.value
  if (ambosWebpay.value) {
    const orden = ordenGrabadoWebpay({
      ambosWebpay: true,
      numOperacion: numeroOperacionContrato(null, alumnoCtx.numOperacionCuenta),
      firmasListas: true,
    })
    // 'grabar' aquí solo ocurre si falta el número: se graba y cierra en una sola llamada.
    const cerrarFicha = orden.tipo === 'cerrar-ficha' || orden.tipo === 'grabar'
    if (!(await grabarCuentaWebpay(cerrarFicha))) return false
    planGrabado.value = true
    return true
  }
  const medioMat = alumnoCtx.medioMatricula
  const medioAra = alumnoCtx.medioArancel
  const matriculaConTarjeta =
    medioMat === 'webpay' && alumnoCtx.webpayMatriculaEstado === 'autorizada'
  const arancelConTarjeta = medioAra === 'webpay' && alumnoCtx.webpayArancelEstado === 'autorizada'
  const mixto =
    (matriculaConTarjeta && medioAra === 'pagare') || (arancelConTarjeta && medioMat === 'pagare')
  const armado = mixto
    ? armarGrabarCuentaMixta({
        rut: fuente.rutMostrado.value,
        codcliAcademico: fuente.codcliMostrado.value,
        codigoCarrera: alumnoMnp.primeraFila?.codigo_carrera ?? '',
        ano: periodoActivo.anio,
        periodo: periodoActivo.semestre,
        caja: preflight.steps?.caja.row?.caja ?? null,
        pago: alumnoCtx.pagoMatricula,
        medioMatricula: matriculaConTarjeta ? 'webpay' : 'pagare',
        medioArancel: arancelConTarjeta ? 'webpay' : 'pagare',
        montoWebpayMatricula: alumnoCtx.webpayMontoMatricula,
        montoWebpayArancel: alumnoCtx.webpayMontoArancel,
      })
    : armarGrabarPlanPagos({
        rut: fuente.rutMostrado.value,
        codcliAcademico: fuente.codcliMostrado.value,
        codigoCarrera: alumnoMnp.primeraFila?.codigo_carrera ?? '',
        ano: periodoActivo.anio,
        periodo: periodoActivo.semestre,
        caja: preflight.steps?.caja.row?.caja ?? null,
        pago: alumnoCtx.pagoMatricula,
      })
  if (!armado.ok) {
    errorGrabacion.value = armado.error
    return false
  }
  grabandoPlan.value = true
  errorGrabacion.value = null
  const res = await postGrabarPlanPagos(armado.payload)
  grabandoPlan.value = false
  if (unmounted) return false
  if (!res.ok) {
    errorGrabacion.value = res.error
    return false
  }
  planGrabado.value = true
  return true
}

function aplicarEstadoOk(estado: Extract<ContratoFirmaEstadoResponse, { ok: true }>): void {
  firmantes.value = estado.firmantes
  numOperacionFirma.value = estado.numOperacion
  if (estado.ready && !contratoFirmadoRegistrado.value) {
    contratoFirmadoRegistrado.value = true
    void registrarPasoFirma('firmado', estado.numOperacion)
  }
  if (estado.ready) {
    clearEsperaFirma()
    void grabarPlanFirmado().then((ok) => {
      if (ok && !unmounted) completarYNavegar()
    })
    return
  }
  void prepararFirma(estado.numOperacion)
}

async function pollEstado(numOperacion: string): Promise<void> {
  const res = await getContratoFirmaEstado(numOperacion, identidadFirma())
  if (unmounted) return
  if (!res.ok) {
    volverAFormaDePagoSiNumeroAjeno(res.error)
    return
  }
  aplicarEstadoOk(res)
}

function iniciarPoll(numOperacion: string): void {
  clearPoll()
  pollTimer = setInterval(() => {
    void pollEstado(numOperacion)
  }, POLL_MS)
}

async function restaurarFirmaExistente(): Promise<void> {
  const num = (viewModel.value?.numOperacion ?? '').trim()
  if (!num || num === '—') return
  restaurandoFirma.value = true
  try {
    const res = await getContratoFirmaEstado(num, identidadFirma())
    if (unmounted) return
    if (!res.ok) {
      volverAFormaDePagoSiNumeroAjeno(res.error)
      return
    }
    aplicarEstadoOk(res)
    if (!res.ready) iniciarPoll(res.numOperacion)
  } finally {
    if (!unmounted) restaurandoFirma.value = false
  }
}

const anteriorDeshabilitado = computed(
  () => alumnoCtx.envioFirmaIniciado || enviando.value || firmantes.value.length > 0,
)

async function enviarAFirmar(): Promise<void> {
  const vm = viewModel.value
  if (!vm || enviando.value) {
    return
  }

  clearPoll()
  alumnoCtx.marcarEnvioFirmaIniciado()
  enviando.value = true
  errorFirma.value = null
  iniciarProgresoEnvio()

  try {
    const codcliRaw = fuente.codcliMostrado.value
    const codcli = codcliRaw === '—' ? undefined : codcliRaw.trim()
    let esResponsableFinanciero: string | null | undefined
    let emailApoderado = vm.emailApoderado
    if (codcli && periodoActivo.anio != null && periodoActivo.semestre != null) {
      const { data: planRow } = await fetchPlanPagosMvByCodcli({
        codcli,
        anioMatricula: periodoActivo.anio,
        periodoMatricula: periodoActivo.semestre,
      })
      esResponsableFinanciero = planRow?.es_responsable_financiero
      const mailPlan = (planRow?.mail_apoder ?? '').trim()
      if (mailPlan && mailPlan !== '—') emailApoderado = mailPlan
    }
    const incluirApoderado = !esPropioSostenedor(esResponsableFinanciero)

    // Con los dos Webpay se graba antes, para que el PDF salga con el número de operación de U+.
    const orden = ordenGrabadoWebpay({
      ambosWebpay: ambosWebpay.value,
      numOperacion: numeroOperacionContrato(null, alumnoCtx.numOperacionCuenta),
      firmasListas: false,
    })
    if (orden.tipo === 'grabar') {
      const grabado = await grabarCuentaWebpay(orden.cerrarFicha)
      if (unmounted) {
        clearEnvioTimers()
        return
      }
      if (!grabado) {
        cerrarProgresoError()
        errorFirma.value = errorGrabacion.value ?? 'No se pudo grabar el plan de pagos.'
        return
      }
    }
    const vmFirmado = viewModel.value ?? vm
    const numOperacionContrato = numeroOperacionContrato(
      vmFirmado.numOperacion,
      alumnoCtx.numOperacionCuenta,
      { ambosWebpay: ambosWebpay.value },
    )
    if (ambosWebpay.value && numOperacionContrato === '—') {
      cerrarProgresoError()
      errorFirma.value = errorGrabacion.value ?? 'No se obtuvo el número de operación del contrato.'
      return
    }
    const res = await ensureContratoFirma({
      ...vmFirmado,
      numOperacion: numOperacionContrato,
      incluirApoderado,
      emailApoderado,
      codcli,
    })

    if (unmounted) {
      clearEnvioTimers()
      return
    }

    if (!res.ok) {
      cerrarProgresoError()
      if (volverAFormaDePagoSiNumeroAjeno(res.error)) return
      errorFirma.value = res.error
      return
    }

    cerrarProgresoOk()
    if (res.created) {
      await registrarPasoFirma('enviado', res.numOperacion)
    }
    aplicarEstadoOk(res)
    if (!res.ready) {
      iniciarPoll(res.numOperacion)
    }
  } finally {
    enviando.value = false
  }
}

onMounted(() => {
  void restaurarFirmaExistente()
})

onUnmounted(() => {
  unmounted = true
  clearPoll()
  clearEnvioTimers()
  clearEsperaFirma()
})

async function descargaBorrador(): Promise<void> {
  const vm = viewModel.value
  if (!vm) {
    mostrarErrorRematricula('Confirma el plan de pagos antes de descargar el contrato.')
    return
  }
  descargando.value = true
  try {
    const res = await downloadContratoPreviewPdf(vm)
    if (!res.ok || !res.blob) {
      mostrarErrorRematricula(res.error || 'No se pudo generar el PDF')
      return
    }
    const url = URL.createObjectURL(res.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contrato-${vm.numOperacion || 'borrador'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Borrador del contrato descargado.')
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted-foreground">
      Revisa el contrato. Cuando lo aceptes, se envía a firmar por correo.
    </p>

    <Card v-if="!tienePlanConfirmado" class="shadow-md border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle>Falta el plan de pagos</CardTitle>
        <CardDescription>
          Confirma el plan de pagos en el paso anterior para ver el contrato con los datos de
          {{ fuente.nombreMostrado }}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          class="bg-uniacc-orange hover:bg-uniacc-orange/90"
          type="button"
          @click="router.push({ name: 'matricula-alumno-forma-pago' })"
        >
          Ir a forma de pago
        </Button>
      </CardContent>
    </Card>

    <template v-else>
      <Card class="shadow-md">
        <CardHeader>
          <CardTitle>1. Revisa el contrato</CardTitle>
          <CardDescription>
            Estudiante: {{ fuente.nombreMostrado }} · RUT {{ fuente.rutMostrado }} · Op.
            {{ viewModel?.numOperacion }}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            class="max-h-[70vh] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-100/80 p-2"
          >
            <ContratoPrestacionServiciosPreview v-if="viewModel" :model="viewModel" />
          </div>
          <div class="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              class="gap-2"
              type="button"
              :disabled="descargando"
              @click="descargaBorrador"
            >
              <Download class="h-4 w-4" />
              {{ descargando ? 'Generando…' : 'Descarga borrador' }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-if="firmantes.length === 0 && !enviando && !restaurandoFirma && !errorFirma" class="shadow-md">
        <CardHeader>
          <CardTitle>2. Acepta y envía a firmar</CardTitle>
          <CardDescription>
            El contrato queda en pantalla para que lo revises. Recién al aceptarlo se envía a
            TuFirma.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <label class="flex cursor-pointer items-start gap-3 text-sm text-zinc-800">
            <Checkbox
              :checked="aceptado"
              class="mt-0.5 cursor-pointer"
              @update:checked="(v: boolean) => (aceptado = v === true)"
            />
            <span>Acepto el contrato de prestación de servicios y quiero enviarlo a firmar.</span>
          </label>
          <div class="flex justify-end">
            <Button
              type="button"
              class="cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90"
              :disabled="!aceptado"
              @click="enviarAFirmar"
            >
              Enviar a firmar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-else class="shadow-md">
        <CardHeader>
          <CardTitle>Firma del contrato</CardTitle>
          <CardDescription>
            Enviamos el contrato a firmar por correo. Esta pantalla espera a que firmen todos.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div
            v-if="restaurandoFirma && firmantes.length === 0 && !errorFirma"
            class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 class="h-5 w-5 shrink-0 animate-spin text-uniacc-orange motion-reduce:animate-none" aria-hidden="true" />
            <span>Recuperando la firma del contrato…</span>
          </div>

          <div
            v-else-if="pasoEnvio && !errorFirma"
            class="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            :aria-busy="enviando"
          >
            <ol class="space-y-3">
              <li
                v-for="paso in pasosEnvioVisibles"
                :key="paso.id"
                class="flex items-start gap-3 text-sm"
                :aria-current="paso.estado === 'actual' ? 'step' : undefined"
              >
                <Loader2
                  v-if="paso.estado === 'actual'"
                  class="mt-0.5 h-5 w-5 shrink-0 animate-spin text-uniacc-orange motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <Check
                  v-else-if="paso.estado === 'listo'"
                  class="mt-0.5 h-5 w-5 shrink-0 text-uniacc-celeste"
                  aria-hidden="true"
                />
                <Circle
                  v-else
                  class="mt-0.5 h-5 w-5 shrink-0 text-zinc-300"
                  aria-hidden="true"
                />
                <div>
                  <p :class="paso.estado === 'pendiente' ? 'text-muted-foreground' : 'text-foreground'">
                    {{ paso.texto }}
                  </p>
                  <p
                    v-if="paso.id === 'enviando' && avisoLento"
                    class="mt-1 text-muted-foreground"
                  >
                    Seguimos procesando.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <Alert v-if="errorFirma" variant="destructive">
            <AlertTitle>No se pudo enviar el contrato a firmar</AlertTitle>
            <AlertDescription class="mt-2 space-y-3">
              <p>{{ errorFirma }}</p>
              <Button type="button" variant="secondary" :disabled="enviando" @click="enviarAFirmar">
                {{ enviando ? 'Reintentando…' : 'Reintentar' }}
              </Button>
            </AlertDescription>
          </Alert>

          <div v-if="firmantes.length > 0" class="space-y-3">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Operación {{ numOperacionFirma || viewModel?.numOperacion }}.</span>
            </div>
            <p
              v-if="preparandoEnlaces"
              class="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2
                class="h-4 w-4 shrink-0 animate-spin text-uniacc-orange motion-reduce:animate-none"
                aria-hidden="true"
              />
              Preparando el enlace de firma…
            </p>
            <div v-else-if="errorEnlaces" class="space-y-2">
              <p class="text-sm text-destructive">{{ errorEnlaces }}</p>
              <Button type="button" variant="secondary" class="cursor-pointer" @click="reintentarEnlaces">
                Reintentar
              </Button>
            </div>
            <div
              v-else-if="enlacesListos"
              class="space-y-3 rounded-lg border border-uniacc-orange/40 bg-uniacc-orange/10 p-4 ring-1 ring-uniacc-orange/15"
              role="note"
            >
              <p class="text-base font-semibold text-zinc-900">Antes de firmar</p>
              <ul class="space-y-3">
                <li class="flex items-start gap-3 text-sm leading-relaxed text-zinc-900">
                  <AppWindow class="mt-0.5 h-5 w-5 shrink-0 text-uniacc-orange" aria-hidden="true" />
                  <p>
                    <span class="font-semibold">Activa las ventanas emergentes.</span>
                    El botón abre la firma en una ventana nueva del navegador.
                  </p>
                </li>
              </ul>
              <p
                v-if="segundosEspera > 0"
                class="text-sm font-semibold text-uniacc-orange"
                role="timer"
                aria-live="polite"
              >
                Podrás firmar en {{ segundosEspera }}
                {{ segundosEspera === 1 ? 'segundo' : 'segundos' }}.
              </p>
            </div>
            <ul class="divide-y rounded-md border" role="list">
              <li
                v-for="(firmante, idx) in firmantes"
                :key="`${firmante.rol}-${firmante.email}-${idx}`"
                class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div class="min-w-0">
                  <p class="font-medium text-foreground">{{ firmante.nombre }}</p>
                  <p class="text-sm text-muted-foreground">{{ firmante.email }}</p>
                </div>
                <Badge
                  :variant="firmante.ready ? 'success' : 'outline'"
                  :class="firmante.ready ? '' : 'border-zinc-200 bg-zinc-100 text-zinc-600'"
                >
                  {{ firmante.ready ? 'Firmado' : 'Pendiente' }}
                </Badge>
              </li>
            </ul>
            <AccionesFlujo
              v-if="firmaDual.mostrarFirmarAlumno || firmaDual.mostrarFirmarApoderado"
            >
              <template
                v-if="firmaDual.mostrarFirmarApoderado && firmaDual.mostrarFirmarAlumno && firmanteApoderado"
                #secundaria
              >
                <Button
                  type="button"
                  variant="outline"
                  class="w-full cursor-not-allowed sm:w-auto"
                  disabled
                >
                  El apoderado firma ahora
                </Button>
              </template>
              <template v-if="firmaDual.mostrarFirmarAlumno && firmanteAlumno" #primaria>
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="!puedeAbrirFirma(firmanteAlumno.email)"
                  @click="abrirFirma(firmanteAlumno.email)"
                >
                  Firmar ahora
                </Button>
              </template>
              <template v-else-if="firmaDual.mostrarFirmarApoderado && firmanteApoderado" #primaria>
                <Button
                  type="button"
                  class="w-full cursor-pointer bg-uniacc-orange hover:bg-uniacc-orange/90 sm:w-auto"
                  :disabled="!puedeAbrirFirma(firmanteApoderado.email)"
                  @click="abrirFirma(firmanteApoderado.email)"
                >
                  El apoderado firma ahora
                </Button>
              </template>
            </AccionesFlujo>
            <p v-if="firmaDual.frase" class="text-sm leading-relaxed text-zinc-800">
              {{ firmaDual.frase }}
            </p>
            <p
              v-if="errorGrabacion"
              class="text-sm text-destructive"
            >
              {{ errorGrabacion }}
            </p>
            <p
              v-else-if="grabandoPlan"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 class="h-4 w-4 shrink-0 animate-spin text-uniacc-orange" aria-hidden="true" />
              Guardando el plan de pagos en TEST…
            </p>
            <p
              v-else-if="!errorFirma"
              class="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 class="h-4 w-4 shrink-0 animate-spin text-uniacc-orange" aria-hidden="true" />
              Esperando firmas…
            </p>
          </div>
        </CardContent>
      </Card>
    </template>

    <div class="flex flex-wrap justify-between gap-3">
      <Button
        variant="outline"
        type="button"
        :disabled="anteriorDeshabilitado"
        @click="router.push({ name: 'matricula-alumno-forma-pago' })"
      >
        Anterior
      </Button>
    </div>
  </div>
</template>
