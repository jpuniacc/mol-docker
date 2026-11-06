import type { MedioConcepto } from '@/utils/webpaySiguientePaso'

export type SenalesAvisoCierreFormaPago = {
  medioMatricula: MedioConcepto | null
  medioArancel: MedioConcepto | null
  webpayMatriculaEstado: string | null
  webpayArancelEstado: string | null
  pagoMatricula: unknown
  /** Neto arancel. null = desconocido (no cubierto). */
  arancelPorPagar: number | null
  firmaCompletada: boolean
}

export type TipoAvisoCierreFormaPago = 'arancel' | 'ambos'

export type CopyAvisoCierreFormaPago = {
  tipo: TipoAvisoCierreFormaPago
  cuerpo: string
  aviso: string
}

const COPY_ARANCEL: CopyAvisoCierreFormaPago = {
  tipo: 'arancel',
  cuerpo:
    'Tu matrícula ya está pagada, pero todavía debes completar tu proceso de rematrícula. Para finalizarlo, falta seleccionar la forma de pago del arancel y firmar tu contrato.',
  aviso:
    '¡No te preocupes! Tu pago de matrícula ya está registrado. No necesitas volver a pagarlo. Solo debes continuar con los pasos pendientes.',
}

const COPY_AMBOS: CopyAvisoCierreFormaPago = {
  tipo: 'ambos',
  cuerpo:
    'Todavía falta elegir el medio de pago de la matrícula y del arancel, y firmar el contrato.',
  aviso:
    'Si sales ahora, no queda registrado ningún pago ni tu rematrícula queda completa.',
}

function matriculaWebpayAutorizada(input: SenalesAvisoCierreFormaPago): boolean {
  return input.medioMatricula === 'webpay' && input.webpayMatriculaEstado === 'autorizada'
}

function matriculaCerrada(input: SenalesAvisoCierreFormaPago): boolean {
  if (matriculaWebpayAutorizada(input)) return true
  return input.medioMatricula === 'pagare' && input.pagoMatricula != null
}

function arancelPendiente(input: SenalesAvisoCierreFormaPago): boolean {
  if (input.arancelPorPagar == null) return true
  if (input.arancelPorPagar <= 0) return false
  if (input.medioArancel == null) return true
  if (input.medioArancel === 'webpay' && input.webpayArancelEstado !== 'autorizada') return true
  if (input.medioArancel === 'pagare' && input.pagoMatricula == null) return true
  return false
}

/**
 * Si el cierre del Dialog Forma de pago debe mostrar warning.
 * null = cerrar de inmediato.
 */
export function copyAvisoCierreFormaPago(
  input: SenalesAvisoCierreFormaPago,
): CopyAvisoCierreFormaPago | null {
  if (input.firmaCompletada) return null
  if (matriculaWebpayAutorizada(input) && !arancelPendiente(input)) return null
  if (matriculaWebpayAutorizada(input) && arancelPendiente(input)) return COPY_ARANCEL
  if (!matriculaCerrada(input)) return COPY_AMBOS
  if (arancelPendiente(input)) return COPY_ARANCEL
  return null
}
