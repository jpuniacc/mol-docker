import { defineStore } from 'pinia'

import { supabase } from '@/services/supabaseClient'
import type { MnpDatosAlumnosRow } from '@/types/supabase'

/** Parte local del usuario → correo institucional (minúsculas, alineado al ETL). */
export function emailInstitucionalDesdeUsername(username: string): string {
  return `${username.trim().toLowerCase()}@uniacc.edu`
}

export const useDatosAlumnoMnpStore = defineStore('datosAlumnoMnp', {
  state: () => ({
    loading: false,
    error: null as string | null,
    filas: [] as MnpDatosAlumnosRow[],
  }),
  getters: {
    primeraFila: (s) => s.filas[0] ?? null,
    cantidadRegistros: (s) => s.filas.length,
  },
  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.filas = []
    },

    /**
     * Todas las filas de `mnp_datos_alumnos` con ese `email_institucional`.
     * Solo para usuarios sin fila en `mv_usuario` (p. ej. Pixarron).
     */
    async fetchSiSinMvUsuario(
      username: string | null | undefined,
      tieneMvUsuario: boolean,
    ): Promise<void> {
      if (tieneMvUsuario || !username?.trim()) {
        this.reset()
        return
      }
      this.loading = true
      this.error = null
      const email = emailInstitucionalDesdeUsername(username)
      try {
        const { data, error } = await supabase
          .from('mnp_datos_alumnos')
          .select('*')
          .eq('email_institucional', email)
        //.eq('estado_academico', 'VIGENTE')
        if (error) {
          this.error = error.message
          this.filas = []
          return
        }
        this.filas = (data as MnpDatosAlumnosRow[]) ?? []
      } finally {
        this.loading = false
      }
    },
  },
})
