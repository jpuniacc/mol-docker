import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

if (!url || !key) {
  console.warn(
    '[supabase] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_KEY; las consultas fallarán hasta configurarlas.',
  )
}

export const supabase = createClient<Database>(url ?? '', key ?? '')
export const supabaseClient = supabase
