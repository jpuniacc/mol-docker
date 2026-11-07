import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { useAuthStore } from '@/stores/auth'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'
import type { ChipBandeja } from '@/utils/seguimientoBandejaChip'
import type { EstadoOutboxUi } from '@/utils/seguimientoBandejaOutbox'

export type SubetapaFormaPago = 'cae' | 'ministerial' | 'ambos' | 'resto' | null

export type FilaBandejaSeguimiento = {
  codcli: string
  rut: string | null
  rut_norm: string | null
  nombre_alumno: string | null
  nombre_carrera: string | null
  chip: ChipBandeja
  subetapa_forma_pago: SubetapaFormaPago
  mat_webpay_fecha: string | null
  mail_2h: EstadoOutboxUi
  sms_24h: EstadoOutboxUi
  mail_2h_sent_at: string | null
  sms_24h_sent_at: string | null
  ultimo_contacto: string | null
  ultimo_contacto_canal: string | null
  proxima_accion: string | null
  email_ejecutivo: string | null
}

/** GET /casos/:codcli enriquecido (CRM v5). */
export type CasoSeguimientoDetalle = FilaBandejaSeguimiento & {
  email_alumno: string | null
  telefono: string | null
  ejecutivo_nombre?: string | null
  firmantes_detalle?: { alumno: EstadoFirmaDrawer; sostenedor: EstadoFirmaDrawer }
  medios_pago_detalle?: { matricula: string; arancel: string }
  firmantes_resumen: string | null
  medios_pago_resumen: string | null
  firma_completa: boolean
  webpay_matricula_autorizada?: boolean
  recordatorios?: RecordatoriosCaso
}

export type EstadoFirmaDrawer = 'firmado' | 'pendiente' | 'no_aplica' | 'sin_informacion'

export type EstadoRecordatorio = 'programado' | 'simulado' | 'enviado' | 'omitido' | 'fallo' | 'no_aplica'

export type RecordatorioItem = {
  tipo: 'mail_2h' | 'sms_24h'
  estado: EstadoRecordatorio
  programado_para: string | null
  enviado_at: string | null
  destino: string | null
  motivo: string | null
}

export type RecordatoriosCaso = {
  habilitado: boolean
  dry_run: boolean
  pago_matricula_at: string | null
  firma_completa: boolean
  items: RecordatorioItem[]
}

export type FiltroAuxSeguimiento = 'sin_contactar_7d' | 'mail_2h_pdte' | 'sms_24h_pdte'

export type KpiBandejaSeguimiento = {
  sin_ingreso: number
  ingreso: number
  tyc: number
  datos: number
  forma_pago: number
  forma_pago_cae: number
  forma_pago_ministerial: number
  forma_pago_ambos: number
  forma_pago_resto: number
  contrato_pdte: number
  firmado_pdte_u: number
  matriculado: number
  mail_2h_pdte: number
  mail_2h_enviado: number
  sms_24h_pdte: number
  sms_24h_enviado: number
  sin_contactar_7d: number
}

export type ContactoSeguimiento = {
  id: string
  canal: string
  origen: string
  autor_email: string
  nota: string | null
  resultado: string | null
  proxima_accion: string | null
  proxima_accion_en: string | null
  created_at: string
}

function headersSesion(): HeadersInit {
  const auth = useAuthStore()
  const h: Record<string, string> = { Accept: 'application/json' }
  const perfil = auth.perfil?.codigo_perfil_usuario
  if (perfil != null) h['X-Mol-Codigo-Perfil'] = String(perfil)
  const email = auth.email?.trim()
  if (email) h['X-Mol-Email'] = email
  return h
}

async function getJson(
  pathConQuery: string,
  timeoutMs = 90_000,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string; status?: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}${pathConQuery}`)
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, {
      signal: controller.signal,
      headers: headersSesion(),
    })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status}`, status: res.status }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return {
        ok: false,
        error: rec.error || rec.message || `Error HTTP ${res.status}`,
        status: res.status,
      }
    }
    return { ok: true, body }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string; status?: number }> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}${path}`)
  if (typeof destino !== 'string') return { ok: false, error: destino.error }
  try {
    const res = await fetch(destino, {
      method: 'POST',
      headers: { ...headersSesion(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    let parsed: unknown
    try {
      parsed = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status}`, status: res.status }
    }
    if (!res.ok) {
      const rec = parsed as { message?: string; error?: string }
      return {
        ok: false,
        error: rec.message || rec.error || `Error HTTP ${res.status}`,
        status: res.status,
      }
    }
    return { ok: true, body: parsed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' }
  }
}

export async function fetchSeguimientoKpi(
  anio: number,
  semestre: number,
  emailEjecutivoOverride?: string | null,
): Promise<{ data: KpiBandejaSeguimiento | null; error: string | null }> {
  const params = new URLSearchParams({ anio: String(anio), semestre: String(semestre) })
  if (emailEjecutivoOverride?.trim()) {
    params.set('emailEjecutivo', emailEjecutivoOverride.trim().toLowerCase())
  }
  const r = await getJson(`/api/rematricula/seguimiento/kpi?${params}`)
  if (!r.ok) return { data: null, error: r.error }
  const body = r.body as { kpi?: KpiBandejaSeguimiento }
  return { data: body.kpi ?? null, error: null }
}

export type ColumnaBoardSeguimiento = {
  chip: ChipBandeja
  label: string
  total: number
  filas: FilaBandejaSeguimiento[]
}

export async function fetchSeguimientoBandeja(opts: {
  anio: number
  semestre: number
  chip?: ChipBandeja | null
  subetapa?: SubetapaFormaPago
  q?: string | null
  filtroAux?: FiltroAuxSeguimiento | null
  limit?: number
  offset?: number
  emailEjecutivoOverride?: string | null
}): Promise<{
  data: FilaBandejaSeguimiento[]
  total: number
  error: string | null
}> {
  const params = new URLSearchParams({
    anio: String(opts.anio),
    semestre: String(opts.semestre),
    limit: String(opts.limit ?? 25),
    offset: String(opts.offset ?? 0),
  })
  if (opts.chip) params.set('chip', opts.chip)
  if (opts.subetapa) params.set('subetapa', opts.subetapa)
  if (opts.q?.trim()) params.set('q', opts.q.trim())
  if (opts.filtroAux) params.set('filtroAux', opts.filtroAux)
  if (opts.emailEjecutivoOverride?.trim()) {
    params.set('emailEjecutivo', opts.emailEjecutivoOverride.trim().toLowerCase())
  }
  const r = await getJson(`/api/rematricula/seguimiento/bandeja?${params}`)
  if (!r.ok) return { data: [], total: 0, error: r.error }
  const body = r.body as { filas?: FilaBandejaSeguimiento[]; total?: number }
  return {
    data: Array.isArray(body.filas) ? body.filas : [],
    total: typeof body.total === 'number' ? body.total : 0,
    error: null,
  }
}

export async function fetchSeguimientoBoard(opts: {
  anio: number
  semestre: number
  q?: string | null
  filtroAux?: FiltroAuxSeguimiento | null
  limitPorColumna?: number
  emailEjecutivoOverride?: string | null
}): Promise<{
  columnas: ColumnaBoardSeguimiento[]
  error: string | null
}> {
  const params = new URLSearchParams({
    anio: String(opts.anio),
    semestre: String(opts.semestre),
    limitPorColumna: String(opts.limitPorColumna ?? 20),
  })
  if (opts.q?.trim()) params.set('q', opts.q.trim())
  if (opts.filtroAux) params.set('filtroAux', opts.filtroAux)
  if (opts.emailEjecutivoOverride?.trim()) {
    params.set('emailEjecutivo', opts.emailEjecutivoOverride.trim().toLowerCase())
  }
  const r = await getJson(`/api/rematricula/seguimiento/board?${params}`)
  if (!r.ok) return { columnas: [], error: r.error }
  const body = r.body as { columnas?: ColumnaBoardSeguimiento[] }
  return {
    columnas: Array.isArray(body.columnas) ? body.columnas : [],
    error: null,
  }
}

export async function fetchSeguimientoCaso(
  codcli: string,
  anio: number,
  semestre: number,
): Promise<{
  caso: CasoSeguimientoDetalle | null
  bitacora: ContactoSeguimiento[]
  error: string | null
}> {
  const params = new URLSearchParams({ anio: String(anio), semestre: String(semestre) })
  const r = await getJson(
    `/api/rematricula/seguimiento/casos/${encodeURIComponent(codcli)}?${params}`,
  )
  if (!r.ok) return { caso: null, bitacora: [], error: r.error }
  const body = r.body as {
    caso?: CasoSeguimientoDetalle
    bitacora?: ContactoSeguimiento[]
  }
  return {
    caso: body.caso ?? null,
    bitacora: Array.isArray(body.bitacora) ? body.bitacora : [],
    error: null,
  }
}

export async function postSeguimientoContacto(
  codcli: string,
  body: {
    anio: number
    semestre: number
    canal: string
    nota?: string | null
    proxima_accion?: string | null
  },
): Promise<{ contacto: ContactoSeguimiento | null; error: string | null }> {
  const r = await postJson(
    `/api/rematricula/seguimiento/casos/${encodeURIComponent(codcli)}/contactos`,
    body,
  )
  if (!r.ok) return { contacto: null, error: r.error }
  const parsed = r.body as { contacto?: ContactoSeguimiento }
  return { contacto: parsed.contacto ?? null, error: null }
}

export type PlantillaCorreoSeguimiento =
  | 'retencion_2h'
  | 'recordatorio_firma'
  | 'recordatorio_forma_pago'
  | 'personalizado'

export async function postSeguimientoEnviarCorreo(
  codcli: string,
  body: {
    anio: number
    semestre: number
    plantilla: PlantillaCorreoSeguimiento
    asunto: string
    html: string
    incluirFirma?: boolean
  },
): Promise<{ error: string | null }> {
  const r = await postJson(
    `/api/rematricula/seguimiento/casos/${encodeURIComponent(codcli)}/enviar-correo`,
    body,
  )
  return { error: r.ok ? null : r.error }
}

export async function postSeguimientoEnviarSms(
  codcli: string,
  body: { anio: number; semestre: number; texto: string },
): Promise<{ error: string | null }> {
  const r = await postJson(
    `/api/rematricula/seguimiento/casos/${encodeURIComponent(codcli)}/enviar-sms`,
    body,
  )
  return { error: r.ok ? null : r.error }
}

export async function fetchFirmaEjecutivo(): Promise<{
  firma: { mime: string; base64: string; updated_at: string } | null
  error: string | null
}> {
  const r = await getJson('/api/rematricula/seguimiento/ejecutivo/firma')
  if (!r.ok) return { firma: null, error: r.error }
  const body = r.body as {
    firma?: { mime: string; base64: string; updated_at: string } | null
  }
  return { firma: body.firma ?? null, error: null }
}

export async function putFirmaEjecutivo(input: {
  mime: 'image/png' | 'image/jpeg'
  base64: string
}): Promise<{ error: string | null }> {
  const destino = urlConCarteraEjecutivo(
    `${admisionApiBaseUrl()}/api/rematricula/seguimiento/ejecutivo/firma`,
  )
  if (typeof destino !== 'string') return { error: destino.error }
  try {
    const res = await fetch(destino, {
      method: 'PUT',
      headers: { ...headersSesion(), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const parsed = (await res.json().catch(() => ({}))) as { message?: string }
      return { error: parsed.message || `Error HTTP ${res.status}` }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error de red' }
  }
}
