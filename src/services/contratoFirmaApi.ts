import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'
import type { ContratoMatriculaViewModel } from '@/types/contratoMatricula'

export type ContratoFirmaEnsureRequest = ContratoMatriculaViewModel & {
  incluirApoderado: boolean
  codcli: string
}

export type ContratoFirmaFirmanteEstado = {
  email: string
  nombre: string
  rol: 'alumno' | 'apoderado'
  ready: boolean
}

export type ContratoFirmaEstadoResponse =
  | {
      ok: true
      created: boolean
      numOperacion: string
      documentId: string
      ready: boolean
      firmantes: ContratoFirmaFirmanteEstado[]
    }
  | { ok: false; error: string }

export type ContratoFirmaListRow = {
  num_operacion: string
  document_id: string
  rut: string | null
  codcli: string | null
  nombre: string | null
  carrera: string | null
  periodo: string | null
  created_at: string
  ready: boolean
  firmantes: ContratoFirmaFirmanteEstado[]
}

const TIMEOUT_MS = 90_000
/** El alta del PDF en TuFirma puede tardar hasta 100 s. El proxy corta a los 120. */
const ENSURE_TIMEOUT_MS = 115_000

function firmaUrl(suffix: string): string {
  const base = admisionApiBaseUrl()
  return `${base}/api/rematricula/alumno/contrato/firma${suffix}`
}

function abortMessage(e: unknown): string {
  if (e instanceof Error && e.name === 'AbortError') {
    return 'Tiempo de espera agotado al contactar el servicio de firma'
  }
  return e instanceof Error ? e.message : String(e)
}

function errorFromUnknown(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const rec = data as { error?: unknown; message?: unknown }
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message
  }
  return fallback
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function isEstadoOk(
  data: unknown,
): data is Extract<ContratoFirmaEstadoResponse, { ok: true }> {
  if (!data || typeof data !== 'object') return false
  const rec = data as Record<string, unknown>
  return (
    rec.ok === true &&
    typeof rec.created === 'boolean' &&
    typeof rec.numOperacion === 'string' &&
    typeof rec.documentId === 'string' &&
    typeof rec.ready === 'boolean' &&
    Array.isArray(rec.firmantes)
  )
}

async function readEstadoResponse(res: Response): Promise<ContratoFirmaEstadoResponse> {
  let data: unknown
  try {
    data = await res.json()
  } catch {
    return {
      ok: false,
      error: res.ok ? 'Respuesta inválida del servidor' : `Error HTTP ${res.status}`,
    }
  }
  if (!res.ok) {
    return { ok: false, error: errorFromUnknown(data, `Error HTTP ${res.status}`) }
  }
  if (isEstadoOk(data)) return data
  return { ok: false, error: errorFromUnknown(data, 'Respuesta inválida del servidor') }
}

export async function ensureContratoFirma(
  body: ContratoFirmaEnsureRequest,
): Promise<ContratoFirmaEstadoResponse> {
  try {
    const res = await fetchWithTimeout(
      firmaUrl('/ensure'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      ENSURE_TIMEOUT_MS,
    )
    return await readEstadoResponse(res)
  } catch (e) {
    return { ok: false, error: abortMessage(e) }
  }
}

export async function getEnlaceFirmaFirmante(
  numOperacion: string,
  email: string,
): Promise<{ ok: true; signatureLink: string } | { ok: false; error: string }> {
  const op = encodeURIComponent(numOperacion)
  try {
    const res = await fetchWithTimeout(firmaUrl(`/${op}/enlace`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status}` }
    }
    if (!res.ok) {
      return { ok: false, error: errorFromUnknown(data, `Error HTTP ${res.status}`) }
    }
    if (data && typeof data === 'object') {
      const link = (data as { signatureLink?: unknown }).signatureLink
      if (typeof link === 'string' && link.startsWith('https://')) {
        try {
          const url = new URL(link)
          const host = url.hostname.toLowerCase()
          if (host === 'tufirma.digital' || host.endsWith('.tufirma.digital')) {
            return { ok: true, signatureLink: url.toString() }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return { ok: false, error: 'Enlace de firma inválido' }
  } catch (e) {
    return { ok: false, error: abortMessage(e) }
  }
}

export async function getContratoFirmaEstado(
  numOperacion: string,
  identidad?: { rut: string; codcli: string },
): Promise<ContratoFirmaEstadoResponse> {
  const op = encodeURIComponent(numOperacion)
  const params = new URLSearchParams()
  const rut = identidad?.rut.trim() ?? ''
  const codcli = identidad?.codcli.trim() ?? ''
  if (rut && rut !== '—' && codcli && codcli !== '—') {
    params.set('rut', rut)
    params.set('codcli', codcli)
  }
  const qs = params.size > 0 ? `?${params.toString()}` : ''
  try {
    const res = await fetchWithTimeout(firmaUrl(`/${op}${qs}`), { method: 'GET' })
    return await readEstadoResponse(res)
  } catch (e) {
    return { ok: false, error: abortMessage(e) }
  }
}

export type PedirNumeroOperacionInput = {
  rut: string
  codcli: string
  anio: number
  semestre: number
  sesionNum?: string
}

export type PedirNumeroOperacionResult =
  | { ok: true; numOperacion: string }
  | { ok: false; code: 'identidad-incompleta' | 'reintentar' }

export async function pedirNumeroOperacion(
  input: PedirNumeroOperacionInput,
): Promise<PedirNumeroOperacionResult> {
  const body: {
    rut: string
    codcli: string
    anio: number
    semestre: number
    sesionNum?: string
  } = {
    rut: input.rut,
    codcli: input.codcli,
    anio: input.anio,
    semestre: input.semestre,
  }
  const sesionNum = (input.sesionNum ?? '').trim()
  if (sesionNum) body.sesionNum = sesionNum

  try {
    const res = await fetchWithTimeout(firmaUrl('/correlativo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { ok: false, code: 'reintentar' }
    }
    if (res.status === 409) {
      const code =
        data && typeof data === 'object' ? (data as { code?: unknown }).code : null
      if (code === 'identidad-incompleta') {
        return { ok: false, code: 'identidad-incompleta' }
      }
    }
    if (res.status === 503 || !res.ok) {
      return { ok: false, code: 'reintentar' }
    }
    const num =
      data && typeof data === 'object' ? (data as { numOperacion?: unknown }).numOperacion : null
    if (typeof num !== 'string' || !/^\d+$/.test(num)) {
      return { ok: false, code: 'reintentar' }
    }
    return { ok: true, numOperacion: num }
  } catch {
    return { ok: false, code: 'reintentar' }
  }
}

export async function pedirCorrelativoOperacion(input: {
  peek: string
  rut: string
  codcli: string
  actualEnError: boolean
}): Promise<{ ok: true; numOperacion: string } | { ok: false; error: string }> {
  try {
    const res = await fetchWithTimeout(firmaUrl('/correlativo'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status}` }
    }
    if (!res.ok) return { ok: false, error: errorFromUnknown(data, `Error HTTP ${res.status}`) }
    const num =
      data && typeof data === 'object' ? (data as { numOperacion?: unknown }).numOperacion : null
    if (typeof num !== 'string' || !/^\d+$/.test(num)) {
      return { ok: false, error: 'No se obtuvo un correlativo nuevo' }
    }
    return { ok: true, numOperacion: num }
  } catch (e) {
    return { ok: false, error: abortMessage(e) }
  }
}

export async function listContratoFirmas(): Promise<{
  ok: boolean
  data: ContratoFirmaListRow[]
  error?: string
}> {
  try {
    const destino = urlConCarteraEjecutivo(firmaUrl(''))
    if (typeof destino !== 'string') return { ok: false, data: [], error: destino.error }
    const res = await fetchWithTimeout(destino, { method: 'GET' })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return {
        ok: false,
        data: [],
        error: res.ok ? 'Respuesta inválida del servidor' : `Error HTTP ${res.status}`,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        data: [],
        error: errorFromUnknown(data, `Error HTTP ${res.status}`),
      }
    }
    if (data && typeof data === 'object') {
      const rec = data as { ok?: unknown; data?: unknown }
      if (rec.ok === true && Array.isArray(rec.data)) {
        return { ok: true, data: rec.data as ContratoFirmaListRow[] }
      }
    }
    return { ok: false, data: [], error: 'Respuesta inválida del servidor' }
  } catch (e) {
    return { ok: false, data: [], error: abortMessage(e) }
  }
}

export async function downloadContratoFirmaPdf(
  numOperacion: string,
): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  const op = encodeURIComponent(numOperacion)
  try {
    const res = await fetchWithTimeout(firmaUrl(`/${op}/documento`), { method: 'GET' })
    if (!res.ok) {
      let error = `Error HTTP ${res.status}`
      try {
        const j = (await res.json()) as { message?: string; error?: string }
        error = j.error || j.message || error
      } catch {
        /* ignore */
      }
      return { ok: false, error }
    }
    const blob = await res.blob()
    return { ok: true, blob }
  } catch (e) {
    return { ok: false, error: abortMessage(e) }
  }
}
