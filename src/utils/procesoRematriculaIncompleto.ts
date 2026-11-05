import { siguientePaso, type MedioConcepto, type PasoWebpay } from '@/utils/webpaySiguientePaso'

export type SenalesRetencionRematricula = {
  medioMatricula: MedioConcepto | null
  medioArancel: MedioConcepto | null
  webpayMatriculaEstado: string | null
  webpayArancelEstado: string | null
  pagoMatricula: unknown
  firmaCompletada: boolean
  /** Neto arancel. null = desconocido (no cubierto). */
  arancelPorPagar: number | null
  /** Si false, no aplica retención de periodo. Default true si se omite. */
  periodoActivo?: boolean
}

export function matriculaWebpayAutorizada(input: SenalesRetencionRematricula): boolean {
  return input.medioMatricula === 'webpay' && input.webpayMatriculaEstado === 'autorizada'
}

/**
 * Arancel cerrado para retención: neto <= 0, Webpay arancel autorizada, o pagaré con plan.
 * Monto null no cuenta como cubierto.
 */
export function arancelResueltoRetencion(input: SenalesRetencionRematricula): boolean {
  if (input.arancelPorPagar == null) return false
  if (input.arancelPorPagar <= 0) return true
  if (input.medioArancel === 'webpay' && input.webpayArancelEstado === 'autorizada') return true
  if (input.medioArancel === 'pagare' && input.pagoMatricula != null) return true
  return false
}

/** P = M && !F (matrícula Webpay OK y sin firma completa). */
export function procesoRematriculaIncompleto(input: SenalesRetencionRematricula): boolean {
  if (input.periodoActivo === false) return false
  if (!matriculaWebpayAutorizada(input)) return false
  if (input.firmaCompletada) return false
  return true
}

export function pasoPendienteRetencion(input: SenalesRetencionRematricula): PasoWebpay {
  const medioMatricula: MedioConcepto = input.medioMatricula === 'pagare' ? 'pagare' : 'webpay'
  return siguientePaso({
    medioMatricula,
    medioArancel: input.medioArancel,
    matriculaAutorizada: input.webpayMatriculaEstado === 'autorizada',
    arancelAutorizado: input.webpayArancelEstado === 'autorizada',
    planListo: input.pagoMatricula != null,
    arancelPorPagar: input.arancelPorPagar,
  })
}

const COPY_ARANCEL_Y_FIRMA =
  'Tu matrícula está pagada, pero tu rematrícula no está completa. Falta elegir cómo pagarás el arancel y firmar tu contrato.'

const COPY_SOLO_FIRMA =
  'Tu matrícula está pagada, pero tu rematrícula no está completa. Falta firmar tu contrato.'

export function copyProcesoIncompleto(input: SenalesRetencionRematricula): string {
  return arancelResueltoRetencion(input) ? COPY_SOLO_FIRMA : COPY_ARANCEL_Y_FIRMA
}

export function ctaContinuarRetornoMatricula(input: SenalesRetencionRematricula): {
  label: string
  paso: PasoWebpay
} {
  const paso = pasoPendienteRetencion(input)
  if (paso.tipo === 'firma') {
    return { label: 'Continuar a la firma', paso }
  }
  if (paso.tipo === 'plan-pagare') {
    return { label: 'Continuar con el plan de pago', paso }
  }
  return { label: 'Continuar con el arancel', paso }
}
