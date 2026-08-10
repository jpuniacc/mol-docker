import type { PostgrestError } from '@supabase/supabase-js'

export interface CustomError extends Error {
  customCode?: number
}

/** Alias para errores de PostgREST (auto-import en Vite). */
export type ExtendedPostgresError = PostgrestError
