import { supabase } from '@/services/supabaseClient'
import { TERMINOS_CONDICIONES_MOL_CODIGO } from '@/constants/terminosCondicionesMol'
import type { TpTerminosCondicionesRow } from '@/types/supabase'

const SELECT_COLS = 'id, codigo, titulo, contenido_html, created_at, updated_at'

export async function fetchTerminosMol(): Promise<{
  data: TpTerminosCondicionesRow | null
  error: string | null
}> {
  const { data, error } = await supabase
    .from('tp_terminos_condiciones')
    .select(SELECT_COLS)
    .eq('codigo', TERMINOS_CONDICIONES_MOL_CODIGO)
    .maybeSingle()

  return {
    data: (data as TpTerminosCondicionesRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function updateTerminosMol(payload: {
  titulo: string
  contenidoHtml: string
}): Promise<{ data: TpTerminosCondicionesRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tp_terminos_condiciones')
    .update({
      titulo: payload.titulo.trim(),
      contenido_html: payload.contenidoHtml,
    })
    .eq('codigo', TERMINOS_CONDICIONES_MOL_CODIGO)
    .select(SELECT_COLS)
    .maybeSingle()

  return {
    data: (data as TpTerminosCondicionesRow | null) ?? null,
    error: error?.message ?? null,
  }
}
