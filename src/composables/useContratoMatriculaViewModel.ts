import { computed } from 'vue'
import { storeToRefs } from 'pinia'

import clausulasFixture from '@/assets/contrato/clausulas.json'
import { useAlumnoRematriculaFuente } from '@/composables/useAlumnoRematriculaFuente'
import { useMockAlumnoFuente } from '@/composables/useMockAlumnoFuente'
import { useMatriculaAlumnoContextStore } from '@/stores/matriculaAlumnoContext'
import { useMockMatriculaContextStore } from '@/stores/mockMatriculaContext'
import { useMatriculaFlujoPreflightStore } from '@/stores/datos_erp/matricula_flujo_preflight'
import { usePeriodoActivoStore } from '@/stores/periodoActivo'
import type {
  ContratoDescuentoLinea,
  ContratoMatriculaViewModel,
  PagoWebpayContrato,
} from '@/types/contratoMatricula'
import type { WebpayPagoDetalle } from '@/utils/webpayPagoDetalle'
import { numeroOperacionContrato } from '@/utils/numeroOperacionContrato'
import {
  bloquesContrato,
  type ContratoMatriculaViewModelConMedio,
  type MedioContrato,
} from '@/utils/lineasContratoMedio'

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t.length > 0 && t !== '—' ? t : '—'
}

function formatClp(n: number): string {
  return new Intl.NumberFormat('es-CL').format(Math.round(n))
}

function jornadaLabel(raw: string): string {
  const u = raw.trim().toUpperCase()
  if (u === 'D' || u === 'DIURNA' || u === 'DIURNO') return 'DIURNO'
  if (u === 'V' || u === 'VESPERTINA' || u === 'VESPERTINO') return 'VESPERTINO'
  if (u === 'AD' || u.includes('DISTANCIA')) return 'A DISTANCIA'
  if (u === 'S' || u.includes('SEMI')) return 'SEMIPRESENCIAL'
  if (u === 'NA') return 'NO APLICA'
  return raw.trim() || '—'
}

function fechaHoyLabel(): string {
  const d = new Date()
  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatFecven(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

function pagoWebpayContrato(
  detalle: WebpayPagoDetalle | null | undefined,
  monto: number,
): PagoWebpayContrato | null {
  if (monto <= 0) return null
  return {
    fecha: detalle?.fecha ?? null,
    hora: detalle?.hora ?? null,
    autorizacion: detalle?.autorizacion?.trim() || null,
    forma: detalle?.forma ?? null,
    ultimos4: detalle?.ultimos4 ?? null,
    cuotas: detalle?.forma === 'credito' ? (detalle.cuotas ?? 1) : null,
    monto,
  }
}

function domiciliadoPorGenero(genero: string): string {
  const g = genero.trim().toUpperCase()
  if (g === 'F' || g === 'FEMENINO' || g === 'MUJER') return 'domiciliada'
  return 'domiciliado'
}

export type ContratoMatriculaFlow = 'mock' | 'alumno'

/** Porcentaje de descuento por forma de pago del arancel pagado con Webpay. */
const PORC_DESCUENTO_FORMA_PAGO_WEBPAY = 0.05

type WebpayConceptoEstadoCtx = 'autorizada' | 'rechazada' | 'abortada' | null

/** Medios y estados Webpay que solo guarda el contexto del alumno. */
type MediosWebpayCtx = {
  medioMatricula?: MedioContrato | null
  medioArancel?: MedioContrato | null
  webpayMatriculaEstado?: WebpayConceptoEstadoCtx
  webpayArancelEstado?: WebpayConceptoEstadoCtx
  webpayMontoMatricula?: number | null
  webpayMatriculaDetalle?: WebpayPagoDetalle | null
  webpayArancelDetalle?: WebpayPagoDetalle | null
  numOperacionCuenta?: string | null
  webpayMontoArancel?: number | null
  valorMatriculaBruto?: number | null
  valorArancelBruto?: number | null
  descuentosContrato?: ContratoDescuentoLinea[]
}

export function useContratoMatriculaViewModel(flow: ContratoMatriculaFlow = 'mock') {
  const mockCtx =
    flow === 'alumno' ? useMatriculaAlumnoContextStore() : useMockMatriculaContextStore()
  const fuente = flow === 'alumno' ? useAlumnoRematriculaFuente() : useMockAlumnoFuente()
  const preflight = useMatriculaFlujoPreflightStore()
  const periodoActivo = usePeriodoActivoStore()
  const { pagoMatricula } = storeToRefs(mockCtx)

  const viewModel = computed((): ContratoMatriculaViewModelConMedio | null => {
    const pago = pagoMatricula.value
    // Solo el contexto del alumno guarda medios y estados Webpay.
    const ctx: MediosWebpayCtx =
      flow === 'alumno' ? (mockCtx as ReturnType<typeof useMatriculaAlumnoContextStore>) : {}
    const matriculaWebpayOk =
      ctx.medioMatricula === 'webpay' && ctx.webpayMatriculaEstado === 'autorizada'
    const arancelWebpayOk =
      ctx.medioArancel === 'webpay' && ctx.webpayArancelEstado === 'autorizada'
    // Con los dos conceptos pagados por Webpay no hay plan de pagaré, pero el contrato se arma igual.
    if (!pago && !(matriculaWebpayOk && arancelWebpayOk)) return null

    const asignaturasNuevo = false

    const direccion = dash(fuente.direccionMostrada.value)
    const comuna = dash(fuente.comunaMostrada.value)
    const ciudad = dash(fuente.ciudadMostrada.value)
    const domicilioLinea = [direccion, comuna, ciudad].filter((x) => x !== '—').join(', ') || '—'

    const cuotasDetalle = pago?.cuotasDetalle ?? []
    const matSum = cuotasDetalle
      .filter((c) => c.item === 1)
      .reduce((a, c) => a + (Number(c.monto) || 0), 0)
    const araSum = cuotasDetalle
      .filter((c) => c.item === 2)
      .reduce((a, c) => a + (Number(c.monto) || 0), 0)

    // Sin pagoMatricula el bruto viene del contexto persistido, nunca del saldo Webpay.
    let valorMatricula =
      pago?.valorMatriculaBruto ?? (pago ? matSum : (ctx.valorMatriculaBruto ?? 0))
    let valorArancel = pago?.valorArancelBruto ?? (pago ? araSum : (ctx.valorArancelBruto ?? 0))
    if (pago && valorMatricula <= 0 && valorArancel <= 0 && pago.monto > 0) {
      valorArancel = pago.monto
    }

    const saldoWebpayArancel = arancelWebpayOk ? Math.max(0, ctx.webpayMontoArancel ?? 0) : 0
    const descuentoFormaPagoArancel = Math.round(
      saldoWebpayArancel * PORC_DESCUENTO_FORMA_PAGO_WEBPAY,
    )
    const descuentosContrato: ContratoDescuentoLinea[] =
      pago?.descuentos && pago.descuentos.length > 0
        ? pago.descuentos
        : (ctx.descuentosContrato ?? [])
    const bloques = bloquesContrato({
      medioMatricula: matriculaWebpayOk ? 'webpay' : 'pagare',
      medioArancel: arancelWebpayOk ? 'webpay' : 'pagare',
      descuentoFormaPagoArancel,
      montoWebpayMatricula: Math.max(0, ctx.webpayMontoMatricula ?? 0),
      montoWebpayArancel: Math.max(0, saldoWebpayArancel - descuentoFormaPagoArancel),
    })

    const preAno = preflight.steps?.contrato.ano
    const prePer = preflight.steps?.contrato.periodo
    const periodoAcademico =
      periodoActivo.label ??
      (preAno && prePer ? `${preAno}/${prePer}` : '—')

    const sostNombre = dash(fuente.nombreApoderadoMostrado.value)
    const sostRut = dash(fuente.rutApoderadoMostrado.value)

    const previewContrato = (preflight.steps?.contrato.preview ?? '').trim()
    const contrato = (pago?.contrato ?? '').trim() || previewContrato || '—'

    return {
      numOperacion: numeroOperacionContrato(pago?.numOperacion, ctx.numOperacionCuenta, {
        ambosWebpay: matriculaWebpayOk && arancelWebpayOk,
      }),
      contrato,
      fechaContratoLabel: fechaHoyLabel(),
      ciudadFirma: 'Santiago',
      periodoAcademico,
      alumno: {
        nombre: dash(fuente.nombreMostrado.value),
        rut: dash(fuente.rutMostrado.value),
        domicilio: domicilioLinea,
        comuna,
        ciudad,
        nacionalidad: dash(fuente.nacionalidadMostrada.value),
        estadoCivil: '—',
        profesion: '—',
        domiciliadoLabel: domiciliadoPorGenero(fuente.generoMostrado.value),
        carrera: dash(fuente.carreraMostrada.value),
        jornada: jornadaLabel(fuente.jornadaMostrada.value),
      },
      sostenedor: {
        nombre: sostNombre === '—' ? dash(fuente.nombreMostrado.value) : sostNombre,
        rut: sostRut === '—' ? dash(fuente.rutMostrado.value) : sostRut,
        domicilio: domicilioLinea,
        comuna,
        ciudad,
        nacionalidad: 'Chilena',
        estadoCivil: '—',
        profesion: '—',
        domiciliadoLabel: 'domiciliado',
      },
      emailAlumno: dash(fuente.correoPersonalMostrado.value),
      emailApoderado:
        fuente.mailApoderadoMostrado.value === '—'
          ? null
          : fuente.mailApoderadoMostrado.value,
      valorMatricula,
      valorArancel,
      descuentos: descuentosContrato.map((d) => ({
        concepto: d.concepto,
        documento: d.documento,
        tipoDocumento: d.tipoDocumento,
        descripcion: d.descripcion,
        detalle: d.detalle,
        monto: d.monto,
        vencimiento: d.vencimiento,
      })),
      pagoWebpayMatricula: matriculaWebpayOk
        ? pagoWebpayContrato(
            ctx.webpayMatriculaDetalle,
            Math.max(0, ctx.webpayMontoMatricula ?? 0),
          )
        : null,
      pagoWebpayArancel: arancelWebpayOk
        ? pagoWebpayContrato(
            ctx.webpayArancelDetalle,
            Math.max(0, saldoWebpayArancel - descuentoFormaPagoArancel),
          )
        : null,
      cuotas: cuotasDetalle.map((c) => ({
        documento: c.correlativo || c.documento,
        tipoDocumento: c.documento,
        valor: c.monto,
        fechaVencimiento: formatFecven(c.vencimiento),
        cuota: c.cuota,
        totalCuotas: c.totalCuotas,
        item: c.item,
        ctapagnum: c.ctapagnum,
      })),
      representante: {
        nombre: '',
        rut: '',
      },
      asignaturasNuevo,
      bloques,
    }
  })

  const tienePlanConfirmado = computed(() => viewModel.value != null)

  return {
    clausulasFixture,
    tienePlanConfirmado,
    viewModel,
    formatClp,
  }
}

export type { ContratoMatriculaViewModel }
