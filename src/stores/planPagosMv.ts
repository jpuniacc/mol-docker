import { acceptHMRUpdate, defineStore } from 'pinia'

import { fetchPlanPagosMv } from '@/services/fetchPlanPagosMv'
import type { PlanPagosMvRow } from '@/types/supabase'

export const usePlanPagosMvStore = defineStore('planPagosMv', {
  state: () => ({
    loading: false,
    error: null as string | null,
    rows: [] as PlanPagosMvRow[],
    loaded: false,
    lastAnio: null as number | null,
    lastPeriodo: null as number | null,
  }),

  getters: {
    total(): number {
      return this.rows.length
    },
    estaCargandoPrimeraVez(): boolean {
      return this.loading && this.rows.length === 0
    },
  },

  actions: {
    reset() {
      this.loading = false
      this.error = null
      this.rows = []
      this.loaded = false
      this.lastAnio = null
      this.lastPeriodo = null
    },

    async ensureLoaded(anio?: number | null, periodo?: number | null) {
      const mismoPeriodo = this.lastAnio === (anio ?? null) && this.lastPeriodo === (periodo ?? null)
      if (this.loaded && mismoPeriodo && !this.error) return
      await this.fetchAll(anio, periodo)
    },

    async fetchAll(anio?: number | null, periodo?: number | null) {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await fetchPlanPagosMv({
          anioMatricula: anio ?? undefined,
          periodoMatricula: periodo ?? undefined,
        })
        if (error) {
          this.error = error
          this.rows = []
          this.loaded = false
          return
        }
        this.rows = data
        this.lastAnio = anio ?? null
        this.lastPeriodo = periodo ?? null
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePlanPagosMvStore, import.meta.hot))
}
