import {
  descuentoFormaPagoArancel,
  montoWebpayArancel,
} from '@/utils/descuentoFormaPagoWebpay'
import type { WebpayPagoDetalle } from '@/utils/webpayPagoDetalle'

type Medio = 'webpay' | 'pagare' | null

export type BloquePagoWebpay = {
  titulo: 'Matrícula' | 'Arancel'
  pagado: number
  /** Saldo antes del 5 %. Solo arancel. */
  saldo: number | null
  descuento: number | null
  tarjeta: string
  cuotas: string
  autorizacion: string
}

function textoTarjeta(detalle: WebpayPagoDetalle | null): string {
  if (!detalle) return '—'
  return detalle.forma === 'debito' ? 'Débito' : 'Crédito'
}

function textoCuotas(detalle: WebpayPagoDetalle | null): string {
  if (!detalle || detalle.forma === 'debito' || detalle.cuotas == null) return 'Sin cuotas'
  return detalle.cuotas === 1 ? '1 cuota' : `${detalle.cuotas} cuotas`
}

function bloque(input: {
  titulo: 'Matrícula' | 'Arancel'
  medio: Medio
  saldo: number | null
  detalle: WebpayPagoDetalle | null
  conDescuento: boolean
}): BloquePagoWebpay | null {
  if (input.medio !== 'webpay') return null
  const saldo = input.saldo != null && Number.isFinite(input.saldo) ? Math.max(0, input.saldo) : null
  const descuento = input.conDescuento && saldo != null ? descuentoFormaPagoArancel(saldo) : null
  const pagado =
    saldo == null ? 0 : input.conDescuento ? montoWebpayArancel(saldo) : saldo
  return {
    titulo: input.titulo,
    pagado,
    saldo: input.conDescuento ? saldo : null,
    descuento,
    tarjeta: textoTarjeta(input.detalle),
    cuotas: textoCuotas(input.detalle),
    autorizacion: input.detalle?.autorizacion || '—',
  }
}

/** Bloques del resumen. El monto guardado del arancel es el saldo antes del 5 %. */
export function resumenPagosWebpay(input: {
  medioMatricula: Medio
  medioArancel: Medio
  montoMatricula: number | null
  montoArancel: number | null
  detalleMatricula: WebpayPagoDetalle | null
  detalleArancel: WebpayPagoDetalle | null
}): { bloques: BloquePagoWebpay[]; total: number } | null {
  const bloques = [
    bloque({
      titulo: 'Matrícula',
      medio: input.medioMatricula,
      saldo: input.montoMatricula,
      detalle: input.detalleMatricula,
      conDescuento: false,
    }),
    bloque({
      titulo: 'Arancel',
      medio: input.medioArancel,
      saldo: input.montoArancel,
      detalle: input.detalleArancel,
      conDescuento: true,
    }),
  ].filter((item): item is BloquePagoWebpay => item != null)
  if (bloques.length === 0) return null
  return {
    bloques,
    total: bloques.reduce((suma, item) => suma + item.pagado, 0),
  }
}
