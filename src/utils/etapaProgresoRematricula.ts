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
  if ((c === 'contacto' || c === 'contacto_otp') && a === 'verificar_ok') return 'Verificó contacto'
  if (c === 'contacto' || c === 'contacto_otp') return `Contacto OTP: ${a}`
  if (c === 'apoderado' && a === 'confirma_ok') return 'Confirmó datos del apoderado'
  if (c === 'apoderado' && a === 'confirma_desactualizado') return 'Marcó datos del apoderado como desactualizados'
  if (c === 'apoderado') return `Apoderado: ${a}`
  if (c === 'discapacidad' && a === 'omitir') return 'Omitió discapacidad'
  if (c === 'discapacidad') return `Discapacidad: ${a}`
  if (c === 'forma_pago' && a === 'confirmado') return 'Confirmó forma de pago'
  if (c === 'firma' && a === 'enviado') return 'Envió el contrato a firmar'
  if (c === 'firma' && a === 'firmado') return 'Contrato firmado'
  return `${categoria}: ${accion}`
}

export { ORDEN as ORDEN_ETAPAS_PROGRESO }
