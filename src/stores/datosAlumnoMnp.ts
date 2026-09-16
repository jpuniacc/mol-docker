import { defineStore } from 'pinia'

import { estadoCarteraOficial } from '@/services/carteraOficialApi'
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
    /** true = RUT en consolidado/MOL pero ausente del Excel oficial. */
    fueraCarteraOficial: false,
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
      this.fueraCarteraOficial = false
    },

    async verificarCarteraOficial(): Promise<void> {
      const rut = this.filas[0]?.rut_alumno
      if (!rut) {
        this.fueraCarteraOficial = false
        return
      }
      const estado = await estadoCarteraOficial(rut)
      this.fueraCarteraOficial = estado.carteraCargada && !estado.enCartera
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
        if (this.filas.length > 0) {
          await this.verificarCarteraOficial()
        } else {
          this.fueraCarteraOficial = false
        }
      } finally {
        this.loading = false
      }
    },
  },
})
