import { defineStore } from 'pinia'

import {
  activarPeriodo,
  fetchPeriodoActivoVigente,
  fetchPeriodosActivos,
  periodoActivoDesdeEnv,
  periodoActivoLabel,
  setPromediosCerrados as persistPromediosCerrados,
} from '@/services/periodoActivo'
import type { TpPeriodoActivoRow } from '@/types/supabase'

export const usePeriodoActivoStore = defineStore('periodoActivo', {
  state: () => ({
    loading: false,
    error: null as string | null,
    rows: [] as TpPeriodoActivoRow[],
    vigente: null as TpPeriodoActivoRow | null,
    loaded: false,
    /** true si el periodo vigente proviene de variables de entorno (fallback). */
    usaFallbackEnv: false,
  }),

  getters: {
    anio(): number | null {
      if (this.vigente) return this.vigente.anio_periodo
      const { anio } = periodoActivoDesdeEnv()
      return anio ?? null
    },
    semestre(): number | null {
      if (this.vigente) return this.vigente.semestre_periodo
      const { semestre } = periodoActivoDesdeEnv()
      return semestre ?? null
    },
    label(): string | null {
      const anio = this.anio
      const semestre = this.semestre
      if (anio != null && semestre != null) return periodoActivoLabel(anio, semestre)
      return null
    },
    tituloRematricula(): string {
      return this.label ? `Rematrícula ${this.label}` : 'Rematrícula'
    },
    promediosCerrados(): boolean {
      return this.vigente?.promedios_cerrados === true
    },
  },

  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.rows = []
      this.vigente = null
      this.loaded = false
      this.usaFallbackEnv = false
    },

    async ensureLoaded(force = false) {
      if (this.loaded && !force) return
      await this.fetchAll()
    },

    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const [listRes, vigenteRes] = await Promise.all([
          fetchPeriodosActivos(),
          fetchPeriodoActivoVigente(),
        ])

        if (listRes.error) {
          this.error = listRes.error
          this.rows = []
        } else {
          this.rows = listRes.data
        }

        if (vigenteRes.error) {
          this.error = this.error ?? vigenteRes.error
          this.vigente = null
        } else {
          this.vigente = vigenteRes.data
        }

        this.usaFallbackEnv = !this.vigente
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async activar(id: number) {
      this.loading = true
      this.error = null
      try {
        const { error } = await activarPeriodo(id)
        if (error) {
          this.error = error
          return false
        }
        await this.fetchAll()
        return true
      } finally {
        this.loading = false
      }
    },

    async setPromediosCerrados(cerrado: boolean) {
      const id = this.vigente?.id
      if (id == null) {
        this.error = 'No hay periodo vigente para actualizar promedios.'
        return false
      }
      this.loading = true
      this.error = null
      try {
        const { error } = await persistPromediosCerrados(id, cerrado)
        if (error) {
          this.error = error
          return false
        }
        await this.fetchAll()
        return true
      } finally {
        this.loading = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePeriodoActivoStore, import.meta.hot))
}
