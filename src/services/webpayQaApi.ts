import { admisionApiBaseUrl } from '@/constants/admisionApi'
import {
  redirigirAWebpay,
  type ConceptoWebpay,
  type EstadoWebpay,
  type FilaPublica,
} from '@/services/webpayPlusApi'

/** Forma pública de /api/webpay-qa/transaccion (sin codcli ni datos de tarjeta). */
export type FilaQa = Pick<
  FilaPublica,
  | 'buyOrder'
  | 'concepto'
  | 'monto'
  | 'estado'
  | 'authorizationCode'
  | 'paymentTypeCode'
  | 'installmentsNumber'
  | 'ambiente'
> & { token: string | null }

export type CrearWebpayQaOk = { ok: true; buyOrder: string; token: string; url: string }
export type CrearWebpayQaError = { ok: false; error: string }

const TIMEOUT_MS = 60_000
const STORAGE_PREFIX = 'webpay-qa-token:'

export function guardarTokenQa(buyOrder: string, token: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + buyOrder, token)
  } catch {
    /* ignore */
  }
}

export function leerTokenQa(buyOrder: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + buyOrder)
  } catch {
    return null
  }
}

function esConcepto(v: unknown): v is ConceptoWebpay {
  return v === 'matricula' || v === 'arancel'
}

function esEstado(v: unknown): v is EstadoWebpay {
  return v === 'creada' || v === 'autorizada' || v === 'rechazada' || v === 'abortada'
}

function esAmbiente(v: unknown): v is FilaPublica['ambiente'] {
  return v === 'integracion' || v === 'produccion'
}

function textoONulo(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function parseFilaQa(body: Record<string, unknown>): FilaQa | null {
  const monto = Number(body.monto)
  if (
    typeof body.buyOrder !== 'string' ||
    !esConcepto(body.concepto) ||
    !esEstado(body.estado) ||
    !esAmbiente(body.ambiente) ||
    !Number.isFinite(monto)
  ) {
    return null
  }
  return {
    buyOrder: body.buyOrder,
    concepto: body.concepto,
    monto,
    estado: body.estado,
    authorizationCode: textoONulo(body.authorizationCode),
    paymentTypeCode: textoONulo(body.paymentTypeCode),
    installmentsNumber:
      body.installmentsNumber == null || body.installmentsNumber === ''
        ? null
        : Number.isFinite(Number(body.installmentsNumber))
          ? Number(body.installmentsNumber)
          : null,
    ambiente: body.ambiente,
    token: typeof body.token === 'string' ? body.token : null,
  }
}

export async function crearWebpayQa(input: {
  monto: number
  concepto: ConceptoWebpay
  codcli?: string
}): Promise<CrearWebpayQaOk | CrearWebpayQaError> {
  const base = admisionApiBaseUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/api/webpay-qa/crear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    let body: Record<string, unknown>
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    if (
      body.ok === true &&
      typeof body.buyOrder === 'string' &&
      typeof body.token === 'string' &&
      typeof body.url === 'string'
    ) {
      return { ok: true, buyOrder: body.buyOrder, token: body.token, url: body.url }
    }
    return { ok: false, error: typeof body.error === 'string' ? body.error : `HTTP ${res.status}` }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout creando transacción Webpay QA' }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Error de red' }
  } finally {
    clearTimeout(timer)
  }
}

export async function obtenerWebpayQa(buyOrder: string): Promise<FilaQa | null> {
  const orden = buyOrder.trim()
  if (!orden) return null
  const base = admisionApiBaseUrl()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `${base}/api/webpay-qa/transaccion?buy_order=${encodeURIComponent(orden)}`,
      { method: 'GET', signal: controller.signal },
    )
    let body: Record<string, unknown>
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      return null
    }
    if (!res.ok || body.ok !== true) return null
    return parseFilaQa(body)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export { redirigirAWebpay }
