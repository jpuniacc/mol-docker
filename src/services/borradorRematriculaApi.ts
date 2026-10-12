import { supabase } from '@/services/supabaseClient'
import type { ClaveBorradorRematricula } from '@/utils/borradorRematriculaSync'

export type BorradorRematriculaRemoto = {
  payload: Record<string, unknown>
  actualizadoEn: string
}

export async function consultarMolBorrador(
  clave: ClaveBorradorRematricula,
): Promise<{ ok: true; remoto: BorradorRematriculaRemoto | null } | { ok: false }> {
  const { data, error } = await supabase.rpc('consultar_mol_borrador_rematricula', {
    p_codcli: clave.codcli,
    p_anio_periodo: clave.anio,
    p_semestre_periodo: clave.semestre,
  })
  if (error) return { ok: false }
  if (!data || data.length === 0) return { ok: true, remoto: null }
  const fila = data[0]
  if (!fila || typeof fila.payload !== 'object' || fila.payload === null || Array.isArray(fila.payload)) {
    return { ok: true, remoto: null }
  }
  return {
    ok: true,
    remoto: {
      payload: fila.payload as Record<string, unknown>,
      actualizadoEn: fila.actualizado_en,
    },
  }
}

export async function guardarMolBorrador(
  clave: ClaveBorradorRematricula,
  payload: object,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('guardar_mol_borrador_rematricula', {
    p_codcli: clave.codcli,
    p_anio_periodo: clave.anio,
    p_semestre_periodo: clave.semestre,
    p_payload: payload,
  })
  if (error || typeof data !== 'string' || data.length === 0) return null
  return data
}
