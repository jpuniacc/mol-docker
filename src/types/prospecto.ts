/**
 * Tipo para un prospecto de la tabla prospectos en Supabase
 */
export interface Prospecto {
  id: string
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  rut: string | null
  pasaporte: string | null
  created_at: string
  updated_at: string
  genero: string | null
  curso: string
  region: string | null
  comuna: string | null
  colegio: string | null
  carrera: number | null
  nem: number | null
  ranking: number | null
  año_egreso: number | null
  paes: boolean | null
  comprension_lectora: number | null
  matematica1: number | null
  cae: boolean | null
  becas_estado: boolean | null
  rango_ingreso: string | null
  decil: string | null
  segmentacion: string
  carreratitulo: string | null
  area_interes: string | null
  modalidadpreferencia: Record<string, any> | null
  objetivo: Record<string, any> | null
  consentimiento_contacto: boolean
  anio_nacimiento: number | null
  url_origen: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  campaign_id: string | null
  ad_id: string | null
  gclid: string | null
  fbclid: string | null
  msclkid: string | null
  ttclid: string | null
  li_fat_id: string | null
  first_touch_url: string | null
  first_touch_timestamp: string | null
  last_touch_url: string | null
  last_touch_timestamp: string | null
  beca: string | null
}

/**
 * Respuesta de Supabase con paginación
 */
export interface ProspectosResponse {
  data: Prospecto[]
  count: number | null
  error: Error | null
}

/**
 * Filtros para la búsqueda de prospectos
 */
export interface FiltrosProspecto {
  nombre?: string
  email?: string
  rut?: string
  carrera?: number
  region?: string
  segmentacion?: string
  fechaDesde?: string
  fechaHasta?: string
  consentimiento_contacto?: boolean | null
}

/**
 * Formatea el nombre completo del prospecto
 */
export function getNombreCompletoProspecto(prospecto: Prospecto): string {
  return `${prospecto.nombre} ${prospecto.apellido}`.trim()
}

/**
 * Formatea la fecha para mostrar (fecha y hora en zona horaria de Chile/Santiago)
 */
export function formatearFechaProspecto(fecha: string | null): string {
  if (!fecha) return '-'
  try {
    const date = new Date(fecha)
    // Convertir a zona horaria de Chile/Santiago
    return date.toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return fecha
  }
}

/**
 * Limpia y normaliza un RUT o pasaporte
 * Elimina espacios al inicio, final y entre caracteres
 */
export function limpiarRUT(rut: string | null | undefined): string {
  if (!rut) return ''
  const original = rut
  // Eliminar espacios al inicio y final, y espacios internos
  const limpio = rut.trim().replace(/\s+/g, '')
  if (original !== limpio) {
    console.log('🔍 limpiarRUT:', { original: `"${original}"`, limpio: `"${limpio}"`, tieneEspacios: original.includes(' ') })
  }
  return limpio
}

/**
 * Obtiene el identificador (RUT o Pasaporte) limpio
 */
export function getIdentificador(prospecto: Prospecto): string {
  const identificador = prospecto.rut || prospecto.pasaporte || ''
  const limpio = limpiarRUT(identificador) || '-'
  if (identificador && identificador !== limpio) {
    console.log('🔍 getIdentificador:', {
      id: prospecto.id,
      nombre: `${prospecto.nombre} ${prospecto.apellido}`,
      rutOriginal: `"${prospecto.rut || ''}"`,
      pasaporteOriginal: `"${prospecto.pasaporte || ''}"`,
      identificadorOriginal: `"${identificador}"`,
      identificadorLimpio: `"${limpio}"`
    })
  }
  return limpio
}

