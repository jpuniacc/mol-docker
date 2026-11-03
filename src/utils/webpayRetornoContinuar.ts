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

export function motivoContinuarError(
  motivo: MotivoContinuarWebpay,
): MotivoContinuarWebpay {
  return motivo
}
