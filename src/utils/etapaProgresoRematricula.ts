export type EtapaProgresoRematricula =
  | 'sin_ingreso'
  | 'ingreso'
  | 'tyc'
  | 'datos'
  | 'forma_pago'
  | 'firma'
  | 'matriculado'

export type HitosProgresoRematricula = {
  tieneIngreso: boolean
  tycAcepta: boolean
  datosOk: boolean
  formaPagoOk: boolean
  firmaOk: boolean
  matriculadoOk: boolean
}

const ORDEN: EtapaProgresoRematricula[] = [
  'matriculado',
  'firma',
  'forma_pago',
  'datos',
  'tyc',
  'ingreso',
  'sin_ingreso',
]

export function resolverEtapaProgreso(h: HitosProgresoRematricula): EtapaProgresoRematricula {
  if (h.matriculadoOk) return 'matriculado'
  if (h.firmaOk) return 'firma'
  if (h.formaPagoOk) return 'forma_pago'
  if (h.datosOk) return 'datos'
  if (h.tycAcepta) return 'tyc'
  if (h.tieneIngreso) return 'ingreso'
  return 'sin_ingreso'
}

export function etiquetaEtapaProgreso(etapa: EtapaProgresoRematricula): string {
  const map: Record<EtapaProgresoRematricula, string> = {
    sin_ingreso: 'Sin ingreso',
    ingreso: 'Ingresó',
    tyc: 'TyC aceptados',
    datos: 'Datos OK',
    forma_pago: 'Forma de pago',
    firma: 'Contrato firmado',
    matriculado: 'Matriculado',
  }
  return map[etapa]
}

export function etiquetaActividadLog(categoria: string, accion: string): string {
  const c = categoria.trim().toLowerCase()
  const a = accion.trim().toLowerCase()
  if (c === 'tyc' && a === 'acepta') return 'Aceptó TyC'
  if (c === 'tyc' && a === 'rechaza') return 'Rechazó TyC'
  if (c === 'sesion' && a === 'inicio') return 'Inicio de sesión'
  if (c === 'contacto' || c === 'contacto_otp') return `Contacto OTP: ${a}`
  if (c === 'apoderado') return `Apoderado: ${a}`
  if (c === 'discapacidad') return `Discapacidad: ${a}`
  return `${categoria}: ${accion}`
}

export { ORDEN as ORDEN_ETAPAS_PROGRESO }
