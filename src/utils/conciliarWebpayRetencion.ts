import {
  pasoPendienteRetencion,
  procesoRematriculaIncompleto,
  type SenalesRetencionRematricula,
} from '@/utils/procesoRematriculaIncompleto'

export type EstadoRetencionServidor = {
  matriculaAutorizada: boolean
  arancelAutorizado: boolean
  firmaCompletadaServidor: boolean
}

export type ParcheRetencionWebpay = {
  medioMatricula?: 'webpay'
  webpayMatriculaEstado?: 'autorizada'
  medioArancel?: 'webpay'
  webpayArancelEstado?: 'autorizada'
  firmaCompletada?: true
  /** Baja medio/estado Webpay de arancel no confirmado por servidor (no toca pagaré). */
  limpiarArancelWebpay?: true
}

/** Parche mínimo al store/borrador sin inventar cobros. */
export function parcheDesdeWebpayAutorizadas(
  estado: EstadoRetencionServidor,
): ParcheRetencionWebpay {
  const out: ParcheRetencionWebpay = {}
  if (estado.matriculaAutorizada) {
    out.medioMatricula = 'webpay'
    out.webpayMatriculaEstado = 'autorizada'
  }
  if (estado.arancelAutorizado) {
    out.medioArancel = 'webpay'
    out.webpayArancelEstado = 'autorizada'
  } else {
    out.limpiarArancelWebpay = true
  }
  if (estado.firmaCompletadaServidor) {
    out.firmaCompletada = true
  }
  return out
}

export function aplicarParcheRetencionASenales(
  actual: SenalesRetencionRematricula,
  estado: EstadoRetencionServidor,
): SenalesRetencionRematricula {
  const p = parcheDesdeWebpayAutorizadas(estado)
  let medioArancel = p.medioArancel ?? actual.medioArancel
  let webpayArancelEstado = p.webpayArancelEstado ?? actual.webpayArancelEstado
  if (p.limpiarArancelWebpay) {
    if (actual.medioArancel === 'webpay' || actual.webpayArancelEstado != null) {
      medioArancel = null
      webpayArancelEstado = null
    }
  }
  return {
    ...actual,
    medioMatricula: p.medioMatricula ?? actual.medioMatricula,
    webpayMatriculaEstado: p.webpayMatriculaEstado ?? actual.webpayMatriculaEstado,
    medioArancel,
    webpayArancelEstado,
    firmaCompletada: p.firmaCompletada === true ? true : actual.firmaCompletada,
  }
}

export function rutaPasoPendienteRetencion(
  input: SenalesRetencionRematricula,
):
  | 'matricula-alumno-forma-pago'
  | 'matricula-alumno-firma'
  | 'matricula-alumno-resumen'
  | null {
  if (input.firmaCompletada) return 'matricula-alumno-resumen'
  if (!procesoRematriculaIncompleto(input)) return null
  const paso = pasoPendienteRetencion(input)
  if (paso.tipo === 'firma') return 'matricula-alumno-firma'
  return 'matricula-alumno-forma-pago'
}
