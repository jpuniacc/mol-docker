import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type WebpayConciliacionFila = {
  buyOrder: string
  codcli: string
  rut: string | null
  nombre: string | null
  concepto: 'matricula' | 'arancel'
  authorizationCode: string
  folioUPlus: string
  foliosUPlus: string[]
  requiereConversion: boolean
  paymentTypeCode: string | null
  installmentsNumber: number | null
  monto: number
  transactionDate: string | null
  numOperacion: string | null
  estado: string
  anioPeriodo: number
  semestrePeriodo: number
}

export type WebpayConciliacionListado = {
  ok: true
  anio: number
  semestre: number
  total: number
  convertidos: number
  filas: WebpayConciliacionFila[]
}

export async function listarWebpayConciliacion(
  anio: number,
  semestre: number,
): Promise<WebpayConciliacionListado | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const params = new URLSearchParams({
      anio: String(anio),
      semestre: String(semestre),
    })
    const destino = urlConCarteraEjecutivo(
      `${admisionApiBaseUrl()}/api/rematricula/webpay/conciliacion?${params.toString()}`,
    )
    if (typeof destino !== 'string') return { ok: false, error: destino.error }
    const res = await fetch(destino, { signal: controller.signal })
    let body: unknown
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Error HTTP ${res.status} al leer conciliación Transbank` }
    }
    if (!res.ok) {
      const rec = body as { error?: string; message?: string }
      return { ok: false, error: rec.error || rec.message || `Error HTTP ${res.status}` }
    }
    const data = body as WebpayConciliacionListado
    if (!data?.ok || !Array.isArray(data.filas)) {
      return { ok: false, error: 'Respuesta inválida de conciliación Transbank' }
    }
    return data
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout al cargar conciliación Transbank' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'No se pudo cargar conciliación Transbank',
    }
  } finally {
    clearTimeout(timer)
  }
}
