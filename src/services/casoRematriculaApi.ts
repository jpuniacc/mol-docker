import { supabase } from '@/services/supabaseClient'
import type {
  MnpCasoRematriculaEstado,
  MnpCasoRematriculaRow,
  MnpCasoRematriculaTipo,
} from '@/types/supabase'

export type AbrirCasoPayload = {
  periodo: string
  tipo: MnpCasoRematriculaTipo
  estado: MnpCasoRematriculaEstado
  codcli: string
  titulo: string
  rutAlumno?: string | null
  nombreAlumno?: string | null
  carrera?: string | null
  jornada?: string | null
  detalle?: string | null
  refTipo?: MnpCasoRematriculaRow['ref_tipo']
  refId?: string | null
  esMock?: boolean
  payload?: Record<string, unknown>
}

export async function abrirCasoRematricula(
  input: AbrirCasoPayload,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('abrir_mnp_caso_rematricula', {
    p_periodo: input.periodo,
    p_tipo: input.tipo,
    p_estado: input.estado,
    p_codcli: input.codcli,
    p_titulo: input.titulo,
    p_rut_alumno: input.rutAlumno ?? null,
    p_nombre_alumno: input.nombreAlumno ?? null,
    p_carrera: input.carrera ?? null,
    p_jornada: input.jornada ?? null,
    p_detalle: input.detalle ?? null,
    p_ref_tipo: input.refTipo ?? null,
    p_ref_id: input.refId ?? null,
    p_es_mock: input.esMock ?? false,
    p_payload: input.payload ?? {},
  })
  return { id: (data as string | null) ?? null, error: error?.message ?? null }
}

export async function consultarCasosAlumno(
  codcli: string,
  periodo: string,
): Promise<{ data: MnpCasoRematriculaRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('consultar_casos_alumno', {
    p_codcli: codcli,
    p_periodo: periodo,
  })
  return {
    data: (data ?? []) as MnpCasoRematriculaRow[],
    error: error?.message ?? null,
  }
}

export async function listarCasosRematricula(filtros?: {
  periodo?: string | null
  tipo?: string | null
  estado?: string | null
}): Promise<{ data: MnpCasoRematriculaRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('listar_mnp_casos_rematricula', {
    p_periodo: filtros?.periodo ?? null,
    p_tipo: filtros?.tipo ?? null,
    p_estado: filtros?.estado ?? null,
  })
  return {
    data: (data ?? []) as MnpCasoRematriculaRow[],
    error: error?.message ?? null,
  }
}

export async function resolverCasoRematricula(input: {
  id: string
  estado: 'APROBADO' | 'RECHAZADO' | 'CERRADO'
  resueltoPor: string
  motivo?: string | null
}): Promise<{ data: MnpCasoRematriculaRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc('resolver_mnp_caso_rematricula', {
    p_id: input.id,
    p_estado: input.estado,
    p_resuelto_por: input.resueltoPor,
    p_motivo: input.motivo ?? null,
  })
  return {
    data: (data as MnpCasoRematriculaRow | null) ?? null,
    error: error?.message ?? null,
  }
}
