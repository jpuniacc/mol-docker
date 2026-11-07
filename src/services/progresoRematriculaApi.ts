import { supabase } from '@/services/supabaseClient'
import { useCarteraEjecutivoStore } from '@/stores/carteraEjecutivo'
import type {
  EtapaProgresoRematricula,
  KpiProgresoRematricula,
  MnpProgresoRematriculaRow,
  VLogMolSesionTimelineRow,
} from '@/types/supabase'
import { AVISO_CARTERA_SIN_CORREO } from '@/utils/alcanceCarteraEjecutivo'

function correoEjecutivo(): { email: string | null } | { error: string } {
  const cartera = useCarteraEjecutivoStore()
  if (cartera.bloqueado) return { error: AVISO_CARTERA_SIN_CORREO }
  return { email: cartera.emailConsulta }
}

type ResultadoRefresh = { count: number | null; error: string | null }
const REFRESH_TTL_MS = 60_000
const REFRESH_TIMEOUT_MS = 8_000
const refreshEnCurso = new Map<string, Promise<ResultadoRefresh>>()
const refreshCompletado = new Map<string, { at: number; result: ResultadoRefresh }>()

/** Single-flight por período y TTL de éxito. Ante fallo la vista puede listar con aviso. */
export async function refreshProgresoRematricula(
  anio: number,
  semestre: number,
): Promise<ResultadoRefresh> {
  const key = `${anio}-${semestre}`
  const pendiente = refreshEnCurso.get(key)
  if (pendiente) return pendiente
  const previo = refreshCompletado.get(key)
  if (previo && Date.now() - previo.at < REFRESH_TTL_MS) return previo.result

  const tarea = ejecutarRefresh(anio, semestre).then((result) => {
    if (!result.error) refreshCompletado.set(key, { at: Date.now(), result })
    return result
  }).finally(() => {
    refreshEnCurso.delete(key)
  })
  refreshEnCurso.set(key, tarea)
  return tarea
}

async function ejecutarRefresh(anio: number, semestre: number): Promise<ResultadoRefresh> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const limite = new Promise<ResultadoRefresh>((resolve) => {
      timer = setTimeout(() => {
        resolve({ count: null, error: 'Tiempo de espera agotado al refrescar el progreso (8 s)' })
        controller.abort()
      }, REFRESH_TIMEOUT_MS)
    })
    const peticion = Promise.resolve(supabase.rpc('refresh_mnp_progreso_rematricula', {
      p_anio: anio,
      p_semestre: semestre,
    }).abortSignal(controller.signal)).then(({ data, error }) => ({
      count: (data as number | null) ?? null,
      error: error?.message ?? null,
    }))
    return await Promise.race([peticion, limite])
  } catch (error: unknown) {
    return { count: null, error: error instanceof Error ? error.message : 'No se pudo refrescar el progreso' }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

export async function fetchKpiProgresoRematricula(
  anio: number,
  semestre: number,
): Promise<{ data: KpiProgresoRematricula | null; error: string | null }> {
  const alcance = correoEjecutivo()
  if ('error' in alcance) return { data: null, error: alcance.error }
  const { data, error } = await supabase.rpc('kpi_mnp_progreso_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_email_ejecutivo: alcance.email,
  })
  const row = Array.isArray(data) ? data[0] : null
  return {
    data: (row as KpiProgresoRematricula | undefined) ?? null,
    error: error?.message ?? null,
  }
}

export async function listarProgresoRematricula(
  anio: number,
  semestre: number,
  filtros?: {
    etapa?: EtapaProgresoRematricula | null
    q?: string | null
  },
): Promise<{ data: MnpProgresoRematriculaRow[]; error: string | null }> {
  const alcance = correoEjecutivo()
  if ('error' in alcance) return { data: [], error: alcance.error }
  const { data, error } = await supabase.rpc('listar_mnp_progreso_rematricula', {
    p_anio: anio,
    p_semestre: semestre,
    p_etapa: filtros?.etapa ?? null,
    p_q: filtros?.q ?? null,
    p_email_ejecutivo: alcance.email,
  })
  return {
    data: (data ?? []) as MnpProgresoRematriculaRow[],
    error: error?.message ?? null,
  }
}

export async function listarTimelineMolAlumno(
  codcli: string,
  anio: number,
  semestre: number,
): Promise<{ data: VLogMolSesionTimelineRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_timeline_mol_alumno', {
    p_codcli: codcli,
    p_anio: anio,
    p_semestre: semestre,
  })
  return {
    data: (data ?? []) as VLogMolSesionTimelineRow[],
    error: error?.message ?? null,
  }
}
