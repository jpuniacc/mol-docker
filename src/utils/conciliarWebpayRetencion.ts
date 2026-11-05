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

/** Parche mínimo al store/borrador sin inventar cobros. */
export function parcheDesdeWebpayAutorizadas(estado: EstadoRetencionServidor): {
  medioMatricula?: 'webpay'
  webpayMatriculaEstado?: 'autorizada'
  medioArancel?: 'webpay'
  webpayArancelEstado?: 'autorizada'
  firmaCompletada?: true
} {
  const out: ReturnType<typeof parcheDesdeWebpayAutorizadas> = {}
  if (estado.matriculaAutorizada) {
    out.medioMatricula = 'webpay'
    out.webpayMatriculaEstado = 'autorizada'
  }
  if (estado.arancelAutorizado) {
    out.medioArancel = 'webpay'
    out.webpayArancelEstado = 'autorizada'
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
  return {
    ...actual,
    medioMatricula: p.medioMatricula ?? actual.medioMatricula,
    webpayMatriculaEstado: p.webpayMatriculaEstado ?? actual.webpayMatriculaEstado,
    medioArancel: p.medioArancel ?? actual.medioArancel,
    webpayArancelEstado: p.webpayArancelEstado ?? actual.webpayArancelEstado,
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
