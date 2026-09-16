import { admisionApiBaseUrl } from '@/constants/admisionApi'
import type { ContratoMatriculaViewModel } from '@/types/contratoMatricula'

export type ContratoPreviewPdfResponse = {
  ok: boolean
  blob?: Blob
  error?: string
}

const TIMEOUT_MS = 90_000

export async function downloadContratoPreviewPdf(
  model: ContratoMatriculaViewModel,
): Promise<ContratoPreviewPdfResponse> {
  const base = admisionApiBaseUrl()
  const url = `${base}/api/rematricula/alumno/contrato/preview-pdf`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
      signal: controller.signal,
    })

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
    const msg =
      e instanceof Error && e.name === 'AbortError'
        ? 'Tiempo de espera agotado al generar PDF'
        : e instanceof Error
          ? e.message
          : String(e)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}
