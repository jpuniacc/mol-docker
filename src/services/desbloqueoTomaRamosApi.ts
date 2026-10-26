import { admisionApiBaseUrl } from '@/constants/admisionApi'
import { urlConCarteraEjecutivo } from '@/stores/carteraEjecutivo'

export type DesbloqueoTomaRamosFila = {
  id: number
  rutCuerpo: string
  dv: string
  codcli: string
  rut: string
  desbloqueado: boolean
  actualizadoPor: string | null
  updatedAt: string
}

export type CarreraDesbloqueo = {
  codcli: string
  nombreCarrera: string
}

export type FilaDesbloqueoEntrada = {
  rut: string
  dv: string
  codcli: string
}

async function leerJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function listarDesbloqueoTomaRamos(): Promise<
  { ok: true; filas: DesbloqueoTomaRamosFila[] } | { ok: false; message: string }
> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos`)
  if (typeof destino !== 'string') return { ok: false, message: destino.error }
  const res = await fetch(destino)
  const body = await leerJson<{ ok?: boolean; filas?: DesbloqueoTomaRamosFila[]; message?: string }>(
    res,
  )
  if (!res.ok || !body?.ok || !body.filas) {
    return { ok: false, message: body?.message ?? 'No se pudo leer la lista.' }
  }
  return { ok: true, filas: body.filas }
}

export async function consultarDesbloqueoTomaRamos(rut: string): Promise<boolean> {
  const params = new URLSearchParams({ rut })
  try {
    const res = await fetch(
      `${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/vigente?${params}`,
    )
    const body = await leerJson<{ ok?: boolean; desbloqueado?: boolean }>(res)
    return res.ok && body?.ok === true && body.desbloqueado === true
  } catch {
    return false
  }
}

export async function buscarDesbloqueoTomaRamos(rut: string): Promise<
  | {
      ok: true
      rutCuerpo: string
      dv: string
      filas: DesbloqueoTomaRamosFila[]
      carreras: CarreraDesbloqueo[]
    }
  | { ok: false; message: string }
> {
  const params = new URLSearchParams({ rut })
  const destino = urlConCarteraEjecutivo(
    `${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/buscar?${params}`,
  )
  if (typeof destino !== 'string') return { ok: false, message: destino.error }
  const res = await fetch(destino)
  const body = await leerJson<{
    ok?: boolean
    message?: string
    rutCuerpo?: string
    dv?: string
    filas?: DesbloqueoTomaRamosFila[]
    carreras?: CarreraDesbloqueo[]
  }>(res)
  if (!res.ok || !body?.ok || !body.rutCuerpo || !body.dv || !body.filas) {
    return { ok: false, message: body?.message ?? 'No se pudo buscar el RUT.' }
  }
  return {
    ok: true,
    rutCuerpo: body.rutCuerpo,
    dv: body.dv,
    filas: body.filas,
    carreras: body.carreras ?? [],
  }
}

export async function importarDesbloqueoTomaRamos(
  filas: FilaDesbloqueoEntrada[],
  actualizadoPor: string,
): Promise<{ ok: boolean; insertadas: number; errores: string[]; avisosU: string[]; message?: string }> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/importar`)
  if (typeof destino !== 'string') {
    return { ok: false, insertadas: 0, errores: [], avisosU: [], message: destino.error }
  }
  const res = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filas, actualizadoPor }),
  })
  const body = await leerJson<{
    ok?: boolean
    insertadas?: number
    errores?: string[]
    avisosU?: string[]
    message?: string
  }>(res)
  return {
    ok: Boolean(body?.ok),
    insertadas: body?.insertadas ?? 0,
    errores: body?.errores ?? [],
    avisosU: body?.avisosU ?? [],
    message: body?.message,
  }
}

export async function desbloquearTomaRamos(input: FilaDesbloqueoEntrada & { actualizadoPor: string }): Promise<
  { ok: true; avisosU: string[] } | { ok: false; message: string }
> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/desbloquear`)
  if (typeof destino !== 'string') return { ok: false, message: destino.error }
  const res = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await leerJson<{ ok?: boolean; message?: string; avisosU?: string[] }>(res)
  if (!res.ok || !body?.ok) return { ok: false, message: body?.message ?? 'No se pudo desbloquear.' }
  return { ok: true, avisosU: body.avisosU ?? [] }
}

export async function bloquearTomaRamos(input: FilaDesbloqueoEntrada & { actualizadoPor: string }): Promise<
  { ok: true; avisosU: string[] } | { ok: false; message: string }
> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/bloquear`)
  if (typeof destino !== 'string') return { ok: false, message: destino.error }
  const res = await fetch(destino, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await leerJson<{ ok?: boolean; message?: string; avisosU?: string[] }>(res)
  if (!res.ok || !body?.ok) {
    return { ok: false, message: body?.message ?? 'No se pudo volver a bloquear.' }
  }
  return { ok: true, avisosU: body.avisosU ?? [] }
}

export async function quitarDesbloqueoTomaRamos(
  id: number,
): Promise<{ ok: true; avisosU: string[] } | { ok: false; message: string }> {
  const destino = urlConCarteraEjecutivo(`${admisionApiBaseUrl()}/api/rematricula/desbloqueo-toma-ramos/${id}`)
  if (typeof destino !== 'string') return { ok: false, message: destino.error }
  const res = await fetch(destino, {
    method: 'DELETE',
  })
  const body = await leerJson<{ ok?: boolean; message?: string; avisosU?: string[] }>(res)
  if (!res.ok || !body?.ok) return { ok: false, message: body?.message ?? 'No se pudo quitar la fila.' }
  return { ok: true, avisosU: body.avisosU ?? [] }
}
