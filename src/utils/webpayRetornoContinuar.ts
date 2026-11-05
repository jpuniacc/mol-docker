import type { ConceptoWebpay } from '@/services/webpayPlusApi'
import { montoWebpayArancel } from '@/utils/descuentoFormaPagoWebpay'
import type { PasoWebpay } from '@/utils/webpaySiguientePaso'

export type DestinoContinuarWebpay =
  | 'webpay'
  | 'elegir-arancel'
  | 'plan-pagare'
  | 'firma'
  | 'forma-pago'

export function destinoDesdePaso(paso: PasoWebpay): DestinoContinuarWebpay {
  if (paso.tipo === 'webpay') return 'webpay'
  if (paso.tipo === 'elegir-arancel') return 'elegir-arancel'
  if (paso.tipo === 'plan-pagare') return 'plan-pagare'
  if (paso.tipo === 'firma') return 'firma'
  return 'forma-pago'
}

export type MotivoContinuarWebpay =
  | 'medio_null'
  | 'monto_invalido'
  | 'identidad'
  | 'crear_webpay'
  | 'persistencia'

export function motivoContinuarError(
  motivo: MotivoContinuarWebpay,
): MotivoContinuarWebpay {
  return motivo
}

function montoEnteroPositivo(valor: number | null): number | null {
  if (valor == null || !Number.isInteger(valor) || valor <= 0) return null
  return valor
}

/**
 * Monto a crear en Transbank al Continuar desde el retorno.
 * `webpayMontoArancel` en contexto es el saldo antes del 5 %; aquí se aplica el descuento.
 */
export function montoCrearSiguienteWebpay(input: {
  concepto: ConceptoWebpay
  webpayMontoMatricula: number | null
  webpayMontoArancel: number | null
}): number | null {
  if (input.concepto === 'matricula') {
    return montoEnteroPositivo(input.webpayMontoMatricula)
  }
  const saldo = montoEnteroPositivo(input.webpayMontoArancel)
  if (saldo == null) return null
  return montoEnteroPositivo(montoWebpayArancel(saldo))
}
