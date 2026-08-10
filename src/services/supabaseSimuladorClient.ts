import { createClient } from '@supabase/supabase-js'

import type { DatabaseSimulador } from '@/types/supabaseSimulador'

const url = import.meta.env.VITE_SIMULADOR_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SIMULADOR_SUPABASE_ANON_KEY as string | undefined

if (!url || !key) {
  console.warn(
    '[supabase-simulador] Faltan VITE_SIMULADOR_SUPABASE_URL o VITE_SIMULADOR_SUPABASE_ANON_KEY; Uso simulador no cargará datos hasta configurarlas.',
  )
}

/** Proyecto Supabase del simulador (tablas `prospectos`, `carreras_uniacc`, `becas_uniacc`). Distinto del Supabase local (`supabaseClient`). */
export const supabaseSimulador = createClient<DatabaseSimulador>(url ?? '', key ?? '')
export const supabaseSimuladorClient = supabaseSimulador
