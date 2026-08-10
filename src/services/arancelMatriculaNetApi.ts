import { admisionApiBaseUrl } from '@/constants/admisionApi'

/**
 * Params de entrada de pa08_MT_ARANCEL_sel_MATRICULA_NET
 * (mapeo desde mnp_mv_plan_pagos_consolidado / v_mnp_mv_plan_pagos).
 */
export type ArancelMatriculaNetParams = {
  /** @CODCARR ← codigo_carrera / cod_carrera */
  codCarr: string
  /** @ANO ← anio_matricula */
  ano: number
  /** @ANOINI ← anio_ingreso / ano_ingreso */
  anoIni: number
  /** @PERIODO ← periodo_matricula */
  periodo: number
  /** @CATALUMNO ← categoria_alumno */
  catAlumno: string
  /** @JORNADA ← jornada_carrera */
  jornada: string
  /** @FECMOD echo del API, formato YYYY-MM-DDTHH:mm:ss */
  fecMod?: string
  /** Ambiente SQL Server usado (prod|test). */
  ambiente?: 'prod' | 'test'
  /** Host enmascarado del pool. */
  host?: string
}

export type ArancelMatriculaNetData = {
  matricula: number | null
  arancel: number | null
  cuotasMatricula: number | null
  cuotasArancel: number | null
  documentos: string | null
  moneda: number | null
  fecMod: string | null
  /** `sp` = EXEC del procedure; `mt_arancel` = fallback SELECT on-demand. */
  fuente?: 'sp' | 'mt_arancel'
  raw: Record<string, unknown>
}

export type ArancelMatriculaNetResponse = {
  ok: boolean
  message?: string
  data?: ArancelMatriculaNetData
  error?: string
  code?: 'NO_ROWS' | 'ERP_ERROR' | string
  params?: ArancelMatriculaNetParams
  duracionMs?: number
}

const TIMEOUT_MS = 60_000

export async function fetchArancelMatriculaNet(
  params: ArancelMatriculaNetParams,
): Promise<ArancelMatriculaNetResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/arancel/matricula-net`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: controller.signal,
    })

    let body: ArancelMatriculaNetResponse
    try {
      body = (await res.json()) as ArancelMatriculaNetResponse
    } catch {
      return {
        ok: false,
        error: res.ok
          ? 'Respuesta inválida del servidor'
          : `Error HTTP ${res.status} al consultar arancel/matrícula`,
      }
    }

    if (!res.ok) {
      return {
        ok: false,
        error: body.error || body.message || `Error HTTP ${res.status}`,
        ...body,
      }
    }

    return body
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'Timeout consultando arancel/matrícula en ERP' }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    }
  } finally {
    clearTimeout(timer)
  }
}
