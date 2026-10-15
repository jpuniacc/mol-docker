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

const ETAPAS_CON_ALERTA_PERMANENCIA = new Set<EtapaProgresoRematricula>([
  'ingreso',
  'tyc',
  'datos',
  'forma_pago',
  'firma',
])

const UMBRAL_PERMANENCIA_MS = 24 * 60 * 60 * 1000

export type PermanenciaEtapa = {
  marcada: boolean
  horas: number | null
}

/** Marca la fila cuando lleva más de 24 horas seguidas en la etapa. */
export function permanenciaEtapa(
  etapa: EtapaProgresoRematricula,
  etapaDesde: string | null | undefined,
  ahora: Date = new Date(),
): PermanenciaEtapa {
  if (!ETAPAS_CON_ALERTA_PERMANENCIA.has(etapa) || !etapaDesde) {
    return { marcada: false, horas: null }
  }
  const inicio = new Date(etapaDesde)
  if (Number.isNaN(inicio.getTime())) {
    return { marcada: false, horas: null }
  }
  const transcurridoMs = ahora.getTime() - inicio.getTime()
  if (transcurridoMs <= UMBRAL_PERMANENCIA_MS) {
    return { marcada: false, horas: null }
  }
  return {
    marcada: true,
    horas: Math.floor(transcurridoMs / (60 * 60 * 1000)),
  }
}

function cantidadEnPalabras(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}

export function etiquetaPermanenciaEtapa(horas: number): string {
  const dias = Math.floor(horas / 24)
  const horasRestantes = horas % 24
  const partes: string[] = []
  if (dias > 0) partes.push(cantidadEnPalabras(dias, 'día', 'días'))
  if (horasRestantes > 0) partes.push(cantidadEnPalabras(horasRestantes, 'hora', 'horas'))
  const tiempo = partes.length > 0 ? partes.join(' y ') : '0 horas'
  return `${tiempo} en esta etapa`
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

const ETIQUETAS_DETALLE: Record<string, string> = {
  tyc_titulo: 'Documento',
  tyc_updated_at: 'Versión',
  canal: 'Canal',
  numero_envio: 'Envío',
  contacto_mascara: 'Contacto',
  numOperacion: 'N.º de operación',
  num_operacion: 'N.º de operación',
  medio: 'Medio',
  cuotas: 'Cuotas',
  montoMatricula: 'Matrícula',
  montoArancel: 'Arancel',
  montoTotal: 'Total',
  contrato: 'Contrato',
  apoderadoNombre: 'Apoderado',
  apoderadoTelefono: 'Teléfono',
  apoderadoEmail: 'Correo',
  simulado: 'Simulado',
}

const CANAL_DETALLE: Record<string, string> = {
  correo: 'Correo',
  telefono: 'Teléfono',
}

const MEDIO_DETALLE: Record<string, string> = {
  pagare: 'Pagaré',
  webpay: 'WebPay',
  toku: 'TOKU',
}

function valorDetalleActividad(clave: string, crudo: unknown): string | null {
  if (crudo == null || crudo === '') return null
  if (clave === 'canal' && typeof crudo === 'string') return CANAL_DETALLE[crudo] ?? crudo
  if (clave === 'medio' && typeof crudo === 'string') return MEDIO_DETALLE[crudo] ?? crudo
  if (clave === 'simulado') return crudo === true ? 'Sí' : crudo === false ? 'No' : null
  if ((clave.endsWith('_at') || clave.endsWith('At')) && (typeof crudo === 'string' || typeof crudo === 'number')) {
    const fecha = new Date(crudo)
    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  if (clave.startsWith('monto') && typeof crudo === 'number') {
    return crudo.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
  }
  if (typeof crudo === 'string' || typeof crudo === 'number') return String(crudo)
  return null
}

export function lineasDetalleActividad(
  payload: Record<string, unknown> | null,
): { etiqueta: string; valor: string }[] {
  if (!payload) return []
  const lineas: { etiqueta: string; valor: string }[] = []
  for (const [clave, crudo] of Object.entries(payload)) {
    const etiqueta = ETIQUETAS_DETALLE[clave]
    if (!etiqueta) continue
    const valor = valorDetalleActividad(clave, crudo)
    if (!valor) continue
    lineas.push({ etiqueta, valor })
  }
  return lineas
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
  if (c === 'matricula' && a === 'matriculado') return 'Matrícula actualizada en U+'
  return `${categoria}: ${accion}`
}

export { ORDEN as ORDEN_ETAPAS_PROGRESO }
