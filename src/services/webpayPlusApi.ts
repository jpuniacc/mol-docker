import { admisionApiBaseUrl } from '@/constants/admisionApi'

export type ConceptoWebpay = 'matricula' | 'arancel'
export type EstadoWebpay = 'creada' | 'autorizada' | 'rechazada' | 'abortada'

export type CrearWebpayInput = {
  /** RUT sin dígito verificador: código de orden de compra Transbank. */
  codcli: string
  /** Código académico de mnp.rematricula_operacion (no es el codcli de Transbank). */
  codcliAcademico: string
  /** RUT completo, con dígito verificador. */
  rut: string
  anio: number
  periodo: 1 | 2
  concepto: ConceptoWebpay
  monto: number
}

export type CrearWebpayOk = {
  ok: true
  buyOrder: string
  token: string
  url: string
}

export type CrearWebpayError = {
  ok: false
  error: string
}

export type FilaPublica = {
  buyOrder: string
  sessionId: string
  concepto: ConceptoWebpay
  codcli: string
  anioPeriodo: number
  semestrePeriodo: 1 | 2
  correlativo: number
  monto: number
  estado: EstadoWebpay
  authorizationCode: string | null
  responseCode: number | null
  paymentTypeCode: string | null
  installmentsNumber: number | null
  cardLast4: string | null
  transactionDate: string | null
  ambiente: 'integracion' | 'produccion'
}

const TIMEOUT_MS = 60_000

function esConcepto(v: unknown): v is ConceptoWebpay {
  return v === 'matricula' || v === 'arancel'
}

function esEstado(v: unknown): v is EstadoWebpay {
  return v === 'creada' || v === 'autorizada' || v === 'rechazada' || v === 'abortada'
}

function esPeriodo(v: unknown): v is 1 | 2 {
  return v === 1 || v === 2
}

function esAmbiente(v: unknown): v is FilaPublica['ambiente'] {
  return v === 'integracion' || v === 'produccion'
}

function textoONulo(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function parseFilaPublica(body: Record<string, unknown>): FilaPublica | null {
  const semestre = Number(body.semestrePeriodo)
  const correlativo = Number(body.correlativo)
  const monto = Number(body.monto)
  const anioPeriodo = Number(body.anioPeriodo)
  if (
    typeof body.buyOrder !== 'string' ||
    typeof body.sessionId !== 'string' ||
    typeof body.codcli !== 'string' ||
    !esConcepto(body.concepto) ||
    !esEstado(body.estado) ||
    !esPeriodo(semestre) ||
    !esAmbiente(body.ambiente) ||
    !Number.isInteger(anioPeriodo) ||
    !Number.isInteger(correlativo) ||
    !Number.isFinite(monto)
  ) {
    return null
  }
  return {
    buyOrder: body.buyOrder,
    sessionId: body.sessionId,
    concepto: body.concepto,
    codcli: body.codcli,
    anioPeriodo,
    semestrePeriodo: semestre,
    correlativo,
    monto,
    estado: body.estado,
    authorizationCode: textoONulo(body.authorizationCode),
    responseCode:
      body.responseCode == null || body.responseCode === ''
        ? null
        : Number(body.responseCode),
    paymentTypeCode: textoONulo(body.paymentTypeCode),
    installmentsNumber:
      body.installmentsNumber == null || body.installmentsNumber === ''
        ? null
        : Number.isFinite(Number(body.installmentsNumber))
          ? Number(body.installmentsNumber)
          : null,
    cardLast4: textoONulo(body.cardLast4),
    transactionDate: textoONulo(body.transactionDate),
    ambiente: body.ambiente,
  }
}

export async function crearWebpay(
  input: CrearWebpayInput,
): Promise<CrearWebpayOk | CrearWebpayError> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/webpay/crear`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    })

    let body: Record<string, unknown>
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al crear Webpay`,
      }
    }

    if (
      body.ok === true &&
      typeof body.buyOrder === 'string' &&
      typeof body.token === 'string' &&
      typeof body.url === 'string'
    ) {
      return {
        ok: true,
        buyOrder: body.buyOrder,
        token: body.token,
        url: body.url,
      }
    }

    const error =
      typeof body.error === 'string' && body.error.trim() !== ''
        ? body.error
        : `Error HTTP ${res.status} al crear Webpay`
    return { ok: false, error }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout creando transacción Webpay' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function obtenerWebpay(buyOrder: string): Promise<FilaPublica | null> {
  const orden = buyOrder.trim()
  if (!orden) return null

  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/webpay/transaccion?buy_order=${encodeURIComponent(orden)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    let body: Record<string, unknown>
    try {
      body = (await res.json()) as Record<string, unknown>
    } catch {
      return null
    }
    if (!res.ok || body.ok !== true) return null
    return parseFilaPublica(body)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function redirigirAWebpay(url: string, token: string): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'token_ws'
  input.value = token
  form.appendChild(input)
  document.body.appendChild(form)
  form.submit()
}
